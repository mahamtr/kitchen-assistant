import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WEEKLY_PLAN_MODEL,
  WEEKLY_PLAN_REVISION_MODEL,
  WeeklyPlanRecord,
  WeeklyPlanRevisionRecord,
} from '../data/schemas';
import {
  AcceptWeeklyPlanRevisionCommand,
  CreateWeeklyPlanRevisionCommand,
  GenerateCurrentWeeklyPlanCommand,
} from './planner.commands';
import { PlannerAiService } from './planner-ai.service';
import { PlannerDraftContextBuilder } from './planner-draft-context.builder';
import { PlannerDraftMaterializer } from './planner-draft-materializer.service';
import { PlannerGroceryProjector } from './planner-grocery-projector.service';
import { PlannerReadService } from './planner-read.service';
import { PlannerRecipeCatalogService } from './planner-recipe-catalog.service';
import { endOfWeek, startOfCurrentWeek } from './planner.shared';

@Injectable()
@CommandHandler(GenerateCurrentWeeklyPlanCommand)
export class GenerateCurrentWeeklyPlanHandler
  implements ICommandHandler<GenerateCurrentWeeklyPlanCommand>
{
  constructor(
    @InjectModel(WEEKLY_PLAN_MODEL)
    private readonly weeklyPlanModel: Model<WeeklyPlanRecord>,
    @InjectModel(WEEKLY_PLAN_REVISION_MODEL)
    private readonly weeklyPlanRevisionModel: Model<WeeklyPlanRevisionRecord>,
    private readonly plannerReadService: PlannerReadService,
    private readonly plannerRecipeCatalogService: PlannerRecipeCatalogService,
    private readonly plannerAiService: PlannerAiService,
    private readonly plannerDraftContextBuilder: PlannerDraftContextBuilder,
    private readonly plannerDraftMaterializer: PlannerDraftMaterializer,
    private readonly plannerGroceryProjector: PlannerGroceryProjector,
  ) {}

  async execute(command: GenerateCurrentWeeklyPlanCommand) {
    const user = await this.plannerReadService.requireUser(command.authUser);
    const preference =
      await this.plannerReadService.requireCompletedPreferenceDocument(user._id);
    const now = new Date();
    const weekStartAt = startOfCurrentWeek(now);
    const expiresAt = endOfWeek(weekStartAt);
    const existingPlan = await this.weeklyPlanModel.findOne({
      userId: user._id,
      weekStartAt,
    });
    const planId = existingPlan?._id ?? new Types.ObjectId();
    const recipes = await this.plannerRecipeCatalogService.getOrSeedCatalog(
      user._id,
      now,
    );
    const week = this.plannerReadService.getWeekContext(now);
    const latestOutput = await this.plannerAiService.generateDraft(
      this.plannerDraftContextBuilder.buildGenerationContext({
        week,
        preferences: preference.profile,
        allowedRecipes: recipes.map((recipe) =>
          this.plannerRecipeCatalogService.toAllowedRecipe(recipe),
        ),
      }),
      recipes,
      week,
    );
    const revision = await this.weeklyPlanRevisionModel.create({
      weeklyPlanId: planId,
      userId: user._id,
      revisionNumber: await this.getNextRevisionNumber(planId),
      latestOutput,
    });
    const acceptedDays =
      await this.plannerDraftMaterializer.materializeAcceptedOutput(
        user._id,
        planId,
        latestOutput,
      );

    await this.weeklyPlanModel.updateMany(
      {
        userId: user._id,
        status: 'active',
        _id: { $ne: planId },
      },
      {
        $set: {
          status: 'replaced',
        },
      },
    );

    const plan =
      existingPlan ??
      new this.weeklyPlanModel({
        _id: planId,
        userId: user._id,
      });

    plan.weekStartAt = weekStartAt;
    plan.expiresAt = expiresAt;
    plan.status = 'active';
    plan.constraintsSnapshot = this.plannerReadService.cloneProfile(
      preference.profile,
    );
    plan.days = acceptedDays;
    plan.acceptedRevisionId = revision._id;
    await plan.save();

    await this.plannerGroceryProjector.rebuildFromAcceptedPlan(
      user._id,
      plan._id,
      acceptedDays,
    );

    return this.plannerReadService.toWeeklyPlanResponse(plan);
  }

  private async getNextRevisionNumber(weeklyPlanId: Types.ObjectId) {
    const latestRevision = await this.weeklyPlanRevisionModel
      .findOne({ weeklyPlanId })
      .sort({ revisionNumber: -1 });

    return (latestRevision?.revisionNumber ?? 0) + 1;
  }
}

@Injectable()
@CommandHandler(CreateWeeklyPlanRevisionCommand)
export class CreateWeeklyPlanRevisionHandler
  implements ICommandHandler<CreateWeeklyPlanRevisionCommand>
{
  constructor(
    @InjectModel(WEEKLY_PLAN_REVISION_MODEL)
    private readonly weeklyPlanRevisionModel: Model<WeeklyPlanRevisionRecord>,
    private readonly plannerReadService: PlannerReadService,
    private readonly plannerRecipeCatalogService: PlannerRecipeCatalogService,
    private readonly plannerAiService: PlannerAiService,
    private readonly plannerDraftContextBuilder: PlannerDraftContextBuilder,
  ) {}

  async execute(command: CreateWeeklyPlanRevisionCommand) {
    const trimmedMessage = command.userMessage.trim();
    if (!trimmedMessage) {
      throw new BadRequestException('Planner revision message is required.');
    }

    const user = await this.plannerReadService.requireUser(command.authUser);
    const preference =
      await this.plannerReadService.requireCompletedPreferenceDocument(user._id);
    const plan = await this.plannerReadService.requirePlanDocument(
      user._id,
      command.weeklyPlanId,
    );
    const latestRevision = await this.weeklyPlanRevisionModel
      .findOne({ weeklyPlanId: plan._id })
      .sort({ revisionNumber: -1 });

    if (!latestRevision) {
      throw new NotFoundException('No planner revision found.');
    }

    const recipes = await this.plannerRecipeCatalogService.getOrSeedCatalog(
      user._id,
      new Date(),
    );
    const week = this.plannerReadService.getWeekContextFromPlan(plan);
    const latestOutput = await this.plannerAiService.reviseDraft(
      this.plannerDraftContextBuilder.buildRevisionContext({
        week,
        preferences: preference.profile,
        allowedRecipes: recipes.map((recipe) =>
          this.plannerRecipeCatalogService.toAllowedRecipe(recipe),
        ),
        plan,
        latestRevision,
        userMessage: trimmedMessage,
      }),
      recipes,
      week,
    );

    const revision = await this.weeklyPlanRevisionModel.create({
      weeklyPlanId: plan._id,
      userId: user._id,
      revisionNumber: latestRevision.revisionNumber + 1,
      latestOutput,
    });

    return this.plannerReadService.toRevisionResponse(revision);
  }
}

@Injectable()
@CommandHandler(AcceptWeeklyPlanRevisionCommand)
export class AcceptWeeklyPlanRevisionHandler
  implements ICommandHandler<AcceptWeeklyPlanRevisionCommand>
{
  constructor(
    @InjectModel(WEEKLY_PLAN_REVISION_MODEL)
    private readonly weeklyPlanRevisionModel: Model<WeeklyPlanRevisionRecord>,
    private readonly plannerReadService: PlannerReadService,
    private readonly plannerDraftMaterializer: PlannerDraftMaterializer,
    private readonly plannerGroceryProjector: PlannerGroceryProjector,
  ) {}

  async execute(command: AcceptWeeklyPlanRevisionCommand) {
    const user = await this.plannerReadService.requireUser(command.authUser);
    const plan = await this.plannerReadService.requirePlanDocument(
      user._id,
      command.weeklyPlanId,
    );
    const revision = await this.weeklyPlanRevisionModel.findOne({
      _id: command.revisionId,
      weeklyPlanId: plan._id,
    });

    if (!revision) {
      throw new NotFoundException('Planner revision not found.');
    }

    const acceptedDays =
      await this.plannerDraftMaterializer.materializeAcceptedOutput(
        user._id,
        plan._id,
        revision.latestOutput,
      );

    plan.days = acceptedDays;
    plan.acceptedRevisionId = revision._id;
    plan.status = 'active';
    await plan.save();

    await this.plannerGroceryProjector.rebuildFromAcceptedPlan(
      user._id,
      plan._id,
      acceptedDays,
    );

    return this.plannerReadService.toWeeklyPlanResponse(plan);
  }
}
