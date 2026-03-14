import { Injectable } from '@nestjs/common';
import type {
  OnboardingProfileValue,
  RecipeRecord,
  WeeklyPlanRecord,
  WeeklyPlanRevisionOutputValue,
  WeeklyPlanRevisionRecord,
} from '../data/schemas';
import {
  DraftWeekContext,
  serializeRevisionOutput,
  toHybridAcceptedDays,
} from './planner.shared';

@Injectable()
export class PlannerDraftContextBuilder {
  buildGenerationContext(params: {
    week: DraftWeekContext;
    preferences: OnboardingProfileValue;
    allowedRecipes: Array<{
      recipeId: string;
      title: string;
      summary: string;
      calories: number;
      tags: string[];
    }>;
  }) {
    return {
      week: params.week,
      preferences: params.preferences,
      allowedRecipes: params.allowedRecipes,
    };
  }

  buildRevisionContext(params: {
    week: DraftWeekContext;
    preferences: OnboardingProfileValue;
    allowedRecipes: Array<{
      recipeId: string;
      title: string;
      summary: string;
      calories: number;
      tags: string[];
    }>;
    plan: WeeklyPlanRecord;
    latestRevision: WeeklyPlanRevisionRecord;
    userMessage: string;
  }) {
    return {
      week: params.week,
      preferences: params.preferences,
      allowedRecipes: params.allowedRecipes,
      currentDraft: this.getBaseDraft(params.plan, params.latestRevision),
      chat: [],
      userMessage: params.userMessage,
    };
  }

  private getBaseDraft(
    plan: WeeklyPlanRecord,
    latestRevision: WeeklyPlanRevisionRecord,
  ) {
    const acceptedRevisionId = plan.acceptedRevisionId?.toString() ?? null;
    const latestRevisionId = latestRevision._id.toString();

    if (!acceptedRevisionId || acceptedRevisionId !== latestRevisionId) {
      return serializeRevisionOutput(latestRevision.latestOutput);
    }

    const acceptedDraft: WeeklyPlanRevisionOutputValue = {
      badge: latestRevision.latestOutput.badge,
      rationale: latestRevision.latestOutput.rationale,
      draftRecipes: [],
      days: toHybridAcceptedDays(plan.days),
    };

    return serializeRevisionOutput(acceptedDraft);
  }
}
