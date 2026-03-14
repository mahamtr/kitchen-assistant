import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DefaultDataFactory } from './default-data.factory';
import {
  GROCERY_LIST_MODEL,
  GroceryListSchema,
  INVENTORY_EVENT_MODEL,
  INVENTORY_ITEM_MODEL,
  InventoryEventSchema,
  InventoryItemSchema,
  ONBOARDING_QUESTION_MODEL,
  OnboardingQuestionSchema,
  RECIPE_GENERATION_MODEL,
  RECIPE_GENERATION_REVISION_MODEL,
  RECIPE_HISTORY_EVENT_MODEL,
  RECIPE_MODEL,
  RecipeGenerationRevisionSchema,
  RecipeGenerationSchema,
  RecipeHistoryEventSchema,
  RecipeSchema,
  USER_MODEL,
  USER_PREFERENCE_MODEL,
  UserPreferenceSchema,
  UserSchema,
  WEEKLY_PLAN_MODEL,
  WEEKLY_PLAN_REVISION_MODEL,
  WeeklyPlanRevisionSchema,
  WeeklyPlanSchema,
} from './schemas';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: USER_MODEL, schema: UserSchema },
      { name: USER_PREFERENCE_MODEL, schema: UserPreferenceSchema },
      { name: ONBOARDING_QUESTION_MODEL, schema: OnboardingQuestionSchema },
      { name: WEEKLY_PLAN_MODEL, schema: WeeklyPlanSchema },
      { name: WEEKLY_PLAN_REVISION_MODEL, schema: WeeklyPlanRevisionSchema },
      { name: GROCERY_LIST_MODEL, schema: GroceryListSchema },
      { name: RECIPE_MODEL, schema: RecipeSchema },
      { name: RECIPE_GENERATION_MODEL, schema: RecipeGenerationSchema },
      {
        name: RECIPE_GENERATION_REVISION_MODEL,
        schema: RecipeGenerationRevisionSchema,
      },
      { name: RECIPE_HISTORY_EVENT_MODEL, schema: RecipeHistoryEventSchema },
      { name: INVENTORY_ITEM_MODEL, schema: InventoryItemSchema },
      { name: INVENTORY_EVENT_MODEL, schema: InventoryEventSchema },
    ]),
  ],
  providers: [DefaultDataFactory],
  exports: [MongooseModule, DefaultDataFactory],
})
export class DataModule {}
