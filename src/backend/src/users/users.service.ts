import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuthenticatedUser } from '../common/current-user';
import { getDisplayName } from '../common/current-user';
import { DefaultDataFactory } from '../data/default-data.factory';
import {
  USER_MODEL,
  USER_PREFERENCE_MODEL,
  UserRecord,
  UserPreferenceRecord,
  WEEKLY_PLAN_MODEL,
  WeeklyPlanRecord,
} from '../data/schemas';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(USER_MODEL)
    private readonly userModel: Model<UserRecord>,
    @InjectModel(USER_PREFERENCE_MODEL)
    private readonly preferenceModel: Model<UserPreferenceRecord>,
    @InjectModel(WEEKLY_PLAN_MODEL)
    private readonly weeklyPlanModel: Model<WeeklyPlanRecord>,
    private readonly defaultDataFactory: DefaultDataFactory,
  ) {}

  async ensureUser(authUser: AuthenticatedUser) {
    const email = authUser.email ?? null;
    const displayName = getDisplayName(authUser);
    const now = new Date();

    const user = await this.userModel.findOneAndUpdate(
      { supabaseUserId: authUser.sub },
      {
        $set: {
          email,
          displayName,
          status: 'active',
          lastSeenAt: now,
        },
      },
      {
        returnDocument: 'after',
        upsert: true,
      },
    );

    await this.ensureDraftPreference(user._id);

    return user;
  }

  async getMe(authUser: AuthenticatedUser) {
    const user = await this.ensureUser(authUser);

    return {
      id: user._id.toString(),
      supabaseUserId: user.supabaseUserId,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      status: user.status,
    };
  }

  async getPreferenceDocument(authUser: AuthenticatedUser) {
    const user = await this.ensureUser(authUser);

    return this.preferenceModel.findOne({ userId: user._id });
  }

  async getCompletedPreference(authUser: AuthenticatedUser) {
    const preference = await this.getPreferenceDocument(authUser);

    if (!preference) {
      return null;
    }

    const metadata = preference.metadata ?? {};

    if (metadata.onboardingCompleted !== true) {
      return null;
    }

    return this.toPreferenceResponse(preference);
  }

  async replacePreferences(
    authUser: AuthenticatedUser,
    profile: UserPreferenceRecord['profile'],
  ) {
    const user = await this.ensureUser(authUser);
    const existing = await this.preferenceModel.findOne({ userId: user._id });
    const nextVersion = (existing?.version ?? 0) + 1;
    const metadata = {
      ...(existing?.metadata ?? {}),
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
    };

    const preference = await this.preferenceModel.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          profile,
          source: 'manual_edit',
          version: nextVersion,
          updatedBy: user._id,
          metadata,
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      },
    );

    return this.toPreferenceResponse(preference);
  }

  async patchPreferences(
    authUser: AuthenticatedUser,
    patch: Partial<UserPreferenceRecord['profile']>,
  ) {
    const user = await this.ensureUser(authUser);
    const preference = await this.preferenceModel.findOne({ userId: user._id });

    if (!preference) {
      throw new NotFoundException('Preference document not found');
    }

    preference.profile = {
      ...preference.profile,
      ...patch,
    };
    preference.source = 'manual_edit';
    preference.version += 1;
    preference.updatedBy = user._id;
    preference.metadata = {
      ...(preference.metadata ?? {}),
      onboardingCompleted: true,
      onboardingCompletedAt:
        (preference.metadata as Record<string, unknown>)
          ?.onboardingCompletedAt ?? new Date(),
    };

    await preference.save();

    return this.toPreferenceResponse(preference);
  }

  async getBootstrapSummary(authUser: AuthenticatedUser) {
    const user = await this.ensureUser(authUser);
    const preference = await this.preferenceModel.findOne({ userId: user._id });
    const currentPlan = await this.weeklyPlanModel
      .findOne({ userId: user._id, status: 'active' })
      .sort({ weekStartAt: -1 });

    const metadata = preference?.metadata ?? {};

    return {
      user: {
        id: user._id.toString(),
        supabaseUserId: user.supabaseUserId,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
        status: user.status,
        lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      preference:
        preference && metadata.onboardingCompleted === true
          ? {
              id: preference._id.toString(),
              userId: preference.userId.toString(),
              profile: preference.profile,
              source: preference.source,
              version: preference.version,
              updatedBy: preference.updatedBy?.toString() ?? null,
              metadata: preference.metadata ?? {},
              createdAt: preference.createdAt.toISOString(),
              updatedAt: preference.updatedAt.toISOString(),
            }
          : undefined,
      currentPlan: currentPlan
        ? {
            id: currentPlan._id.toString(),
            userId: currentPlan.userId.toString(),
            weekStartAt: currentPlan.weekStartAt.toISOString(),
            expiresAt: currentPlan.expiresAt.toISOString(),
            status: currentPlan.status,
            constraintsSnapshot: currentPlan.constraintsSnapshot ?? {},
            days: currentPlan.days.map((day) => ({
              ...day,
              meals: day.meals.map((meal) => ({
                ...meal,
                recipeId: meal.recipeId.toString(),
              })),
            })),
            acceptedRevisionId:
              currentPlan.acceptedRevisionId?.toString() ?? null,
            createdAt: currentPlan.createdAt.toISOString(),
            updatedAt: currentPlan.updatedAt.toISOString(),
          }
        : undefined,
    };
  }

  private async ensureDraftPreference(userId: UserRecord['_id']) {
    const existing = await this.preferenceModel.findOne({ userId });

    if (existing) {
      return existing;
    }

    return this.preferenceModel.create({
      userId,
      profile: this.defaultDataFactory.createDefaultProfile(),
      source: 'onboarding',
      version: 0,
      updatedBy: userId,
      metadata: {
        onboardingCompleted: false,
      },
    });
  }

  private toPreferenceResponse(preference: UserPreferenceRecord) {
    return {
      id: preference._id.toString(),
      version: preference.version,
      source: preference.source,
      profile: preference.profile,
    };
  }
}
