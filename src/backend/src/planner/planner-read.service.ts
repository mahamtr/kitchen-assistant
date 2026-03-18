import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AuthenticatedUser } from '../common/current-user';
import { formatMeasurement } from '../common/measurement';
import { DefaultDataFactory } from '../data/default-data.factory';
import {
  GROCERY_LIST_MODEL,
  GroceryListRecord,
  OnboardingProfileValue,
  USER_PREFERENCE_MODEL,
  UserPreferenceRecord,
  WEEKLY_PLAN_MODEL,
  WEEKLY_PLAN_REVISION_MODEL,
  WeeklyPlanRecord,
  WeeklyPlanRevisionRecord,
} from '../data/schemas';
import { UsersService } from '../users/users.service';
import {
  DraftWeekContext,
  cloneProfile,
  serializeAcceptedDays,
  serializeRevisionOutput,
} from './planner.shared';

@Injectable()
export class PlannerReadService {
  constructor(
    @InjectModel(WEEKLY_PLAN_MODEL)
    private readonly weeklyPlanModel: Model<WeeklyPlanRecord>,
    @InjectModel(WEEKLY_PLAN_REVISION_MODEL)
    private readonly weeklyPlanRevisionModel: Model<WeeklyPlanRevisionRecord>,
    @InjectModel(GROCERY_LIST_MODEL)
    private readonly groceryListModel: Model<GroceryListRecord>,
    @InjectModel(USER_PREFERENCE_MODEL)
    private readonly preferenceModel: Model<UserPreferenceRecord>,
    private readonly usersService: UsersService,
    private readonly defaultDataFactory: DefaultDataFactory,
  ) {}

  async requireUser(authUser: AuthenticatedUser) {
    return this.usersService.ensureUser(authUser);
  }

  async requireCurrentPlanDocument(userId: Types.ObjectId) {
    const plan = await this.weeklyPlanModel
      .findOne({ userId, status: 'active' })
      .sort({ weekStartAt: -1 });

    if (!plan) {
      throw new NotFoundException('No weekly plan found.');
    }

    return plan;
  }

  async requirePlanDocument(userId: Types.ObjectId, weeklyPlanId: string) {
    const plan = await this.weeklyPlanModel.findOne({
      _id: weeklyPlanId,
      userId,
    });

    if (!plan) {
      throw new NotFoundException('No weekly plan found.');
    }

    return plan;
  }

  async requireCompletedPreferenceDocument(userId: Types.ObjectId) {
    const preference = await this.preferenceModel.findOne({ userId });

    if (!preference) {
      throw new BadRequestException(
        'Complete onboarding before generating a weekly plan.',
      );
    }

    const metadata = preference.metadata ?? {};
    if (metadata.onboardingCompleted !== true) {
      throw new BadRequestException(
        'Complete onboarding before generating a weekly plan.',
      );
    }

    return preference;
  }

  async getCurrentPlanResponse(authUser: AuthenticatedUser) {
    const user = await this.requireUser(authUser);
    const plan = await this.requireCurrentPlanDocument(user._id);
    return this.toWeeklyPlanResponse(plan);
  }

  async getRevisionsResponse(authUser: AuthenticatedUser, weeklyPlanId: string) {
    const user = await this.requireUser(authUser);
    const plan = await this.requirePlanDocument(user._id, weeklyPlanId);
    const revisions = await this.weeklyPlanRevisionModel
      .find({ weeklyPlanId: plan._id })
      .sort({ revisionNumber: -1 });

    return revisions.map((revision) => this.toRevisionResponse(revision));
  }

  async getLatestRevisionResponse(
    authUser: AuthenticatedUser,
    weeklyPlanId: string,
  ) {
    const user = await this.requireUser(authUser);
    const plan = await this.requirePlanDocument(user._id, weeklyPlanId);
    const latestRevision = await this.weeklyPlanRevisionModel
      .findOne({ weeklyPlanId: plan._id })
      .sort({ revisionNumber: -1 });

    if (!latestRevision) {
      throw new NotFoundException('No planner revisions found.');
    }

    return this.toRevisionResponse(latestRevision);
  }

  async getGroceryPreviewResponse(
    authUser: AuthenticatedUser,
    weeklyPlanId: string,
  ) {
    const user = await this.requireUser(authUser);
    const plan = await this.requirePlanDocument(user._id, weeklyPlanId);
    const groceryList = await this.groceryListModel.findOne({
      userId: user._id,
      weeklyPlanId: plan._id,
    });

    if (!groceryList) {
      throw new NotFoundException('No grocery list found.');
    }

    return {
      weeklyPlanId: plan._id.toString(),
      items: groceryList.items.map((item) => ({
        itemId: item.itemId.toString(),
        name: item.name,
        quantity: formatMeasurement(item.quantity),
        measurement: {
          value: item.quantity.value,
          unit: item.quantity.unit,
        },
        note: item.notes ?? 'Needed for this week',
      })),
    };
  }

  getWeekContext(now: Date): DraftWeekContext {
    return this.defaultDataFactory.createWeekScaffold(now);
  }

  getWeekContextFromPlan(plan: WeeklyPlanRecord): DraftWeekContext {
    if (Array.isArray(plan.days) && plan.days.length === 7) {
      return plan.days.map((day) => ({
        dayKey: day.dayKey,
        label: day.label,
      }));
    }

    return this.getWeekContext(new Date(plan.weekStartAt));
  }

  cloneProfile(profile: OnboardingProfileValue) {
    return cloneProfile(profile);
  }

  async toWeeklyPlanResponse(plan: WeeklyPlanRecord) {
    const preference = await this.preferenceModel.findOne({
      userId: plan.userId,
    });
    const acceptedRevision = plan.acceptedRevisionId
      ? await this.weeklyPlanRevisionModel.findById(plan.acceptedRevisionId)
      : await this.weeklyPlanRevisionModel
          .findOne({ weeklyPlanId: plan._id })
          .sort({ revisionNumber: -1 });
    const snapshotCandidate = plan.constraintsSnapshot as
      | Record<string, unknown>
      | undefined;
    const snapshotProfile =
      plan.constraintsSnapshot &&
      typeof plan.constraintsSnapshot === 'object' &&
      typeof snapshotCandidate?.nutritionTarget === 'string'
        ? (plan.constraintsSnapshot as unknown as OnboardingProfileValue)
        : ((preference?.profile ??
            this.defaultDataFactory.createDefaultProfile()) as OnboardingProfileValue);
    const target = this.defaultDataFactory.getPlanTarget(snapshotProfile);

    return {
      id: plan._id.toString(),
      title: 'Weekly Meal Planner',
      subtitle:
        'Autogenerated from goals, allergies, time limits, and planning mode',
      target,
      badge: acceptedRevision?.latestOutput.badge ?? 'batch-cooking',
      days: serializeAcceptedDays(plan.days),
    };
  }

  toRevisionResponse(revision: WeeklyPlanRevisionRecord) {
    return {
      id: revision._id.toString(),
      revisionNumber: revision.revisionNumber,
      chat: revision.chat.map((entry) => ({
        id: entry._id?.toString() ?? '',
        role: entry.role,
        content: entry.content,
        timestamp: entry.timestamp.toISOString(),
      })),
      latestOutput: serializeRevisionOutput(revision.latestOutput),
      conversationSummary: revision.conversationSummary ?? '',
      compactedUserMessageCount: revision.compactedUserMessageCount ?? 0,
    };
  }
}
