import {
  buildRecipeCardMetadata,
  buildRecipeUsageHint,
  getLatestCookedAt,
  getLatestRecipeRating,
  getMockDataSnapshot,
  getRecipeFavoriteState,
  useMockAppStore,
} from '../mock/mockStore';
import { requireAppUserId, withDelay } from './utils';
import type {
  CreateRecipeRevisionPayload,
  RecipeDetailResponse,
  RecipeGenerationResponse,
  RecipeGenerationRevisionResponse,
  RecipeListResponse,
  RecipeRatingPayload,
  RecipeScope,
} from '../types/contracts';

async function listRecipes(scope: RecipeScope, search = ''): Promise<RecipeListResponse> {
  const userId = requireAppUserId();
  const snapshot = getMockDataSnapshot();
  const normalized = search.toLowerCase().trim();
  const currentPlanId = snapshot.currentWeeklyPlanByUserId[userId];
  const currentPlan = snapshot.weeklyPlans[currentPlanId];
  const weeklyRecipeIds = new Set(currentPlan.days.flatMap((day) => day.meals.map((meal) => meal.recipeId)));

  let recipes = Object.values(snapshot.recipes).filter((recipe) => recipe.weeklyPlanId === currentPlanId);
  if (scope === 'weekly_planned') {
    recipes = recipes.filter((recipe) => weeklyRecipeIds.has(recipe.id));
  }

  if (scope === 'favorites') {
    recipes = recipes.filter((recipe) => getRecipeFavoriteState(userId, recipe.id));
  }

  if (scope === 'history') {
    recipes = recipes.filter((recipe) => Boolean(getLatestCookedAt(userId, recipe.id)));
  }

  if (normalized) {
    recipes = recipes.filter((recipe) => recipe.title.toLowerCase().includes(normalized));
  }

  return withDelay({
    scope,
    items: recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      subtitle:
        scope === 'weekly_planned'
          ? 'From weekly plan'
          : scope === 'favorites'
            ? 'Favorite'
            : 'Cooked recently',
      metadata: buildRecipeCardMetadata(recipe),
      usageHint: buildRecipeUsageHint(recipe),
      relationshipLabel:
        scope === 'history'
          ? 'History item'
          : scope === 'favorites'
            ? 'Favorite'
            : 'Weekly planned',
      isFavorite: getRecipeFavoriteState(userId, recipe.id),
    })),
  });
}

async function getRecipe(recipeId: string): Promise<RecipeDetailResponse> {
  const userId = requireAppUserId();
  const snapshot = getMockDataSnapshot();
  const recipe = snapshot.recipes[recipeId];
  if (!recipe) {
    throw new Error('Recipe not found.');
  }

  return withDelay({
    recipe,
    isFavorite: getRecipeFavoriteState(userId, recipe.id),
    latestRating: getLatestRecipeRating(userId, recipe.id),
    cookedAt: getLatestCookedAt(userId, recipe.id),
  });
}

async function getActiveGeneration(): Promise<RecipeGenerationResponse | null> {
  const userId = requireAppUserId();
  const snapshot = getMockDataSnapshot();
  const generationId = snapshot.activeRecipeGenerationByUserId[userId];
  if (!generationId) {
    return withDelay(null);
  }
  const generation = snapshot.recipeGenerations[generationId];
  const latestRevision =
    snapshot.recipeGenerationRevisionsByGenerationId[generationId]?.find(
      (revision) => revision.id === generation.latestRevisionId,
    ) ?? snapshot.recipeGenerationRevisionsByGenerationId[generationId]?.slice(-1)[0];

  if (!generation || !latestRevision) {
    return withDelay(null);
  }

  return withDelay({
    generation,
    latestRevision,
  });
}

async function startGeneration(userMessage: string): Promise<RecipeGenerationResponse> {
  const userId = requireAppUserId();
  const snapshot = getMockDataSnapshot();
  const currentPlanId = snapshot.currentWeeklyPlanByUserId[userId];
  const result = useMockAppStore.getState().startRecipeGeneration(userId, userMessage, currentPlanId);

  return withDelay({
    generation: result.generation,
    latestRevision: result.revision,
  });
}

async function getGeneration(generationId: string): Promise<RecipeGenerationResponse> {
  const snapshot = getMockDataSnapshot();
  const generation = snapshot.recipeGenerations[generationId];
  const latestRevision =
    snapshot.recipeGenerationRevisionsByGenerationId[generationId]?.find(
      (revision) => revision.id === generation?.latestRevisionId,
    ) ?? snapshot.recipeGenerationRevisionsByGenerationId[generationId]?.slice(-1)[0];

  if (!generation || !latestRevision) {
    throw new Error('Recipe generation not found.');
  }

  return withDelay({
    generation,
    latestRevision,
  });
}

async function getGenerationRevisions(generationId: string): Promise<RecipeGenerationRevisionResponse[]> {
  const snapshot = getMockDataSnapshot();
  return withDelay(
    (snapshot.recipeGenerationRevisionsByGenerationId[generationId] ?? [])
      .slice()
      .sort((left, right) => right.revisionNumber - left.revisionNumber)
      .map((revision) => ({
        generationId,
        revision,
      })),
  );
}

async function createGenerationRevision(
  generationId: string,
  payload: CreateRecipeRevisionPayload,
): Promise<RecipeGenerationRevisionResponse> {
  const userId = requireAppUserId();
  const revision = useMockAppStore
    .getState()
    .createRecipeGenerationRevision(userId, generationId, payload.userMessage);

  return withDelay({
    generationId,
    revision,
  });
}

async function acceptGeneration(generationId: string, revisionId: string): Promise<RecipeDetailResponse> {
  const userId = requireAppUserId();
  const recipe = useMockAppStore.getState().acceptRecipeGeneration(userId, generationId, revisionId);
  return getRecipe(recipe.id);
}

async function setFavorite(recipeId: string, isFavorite: boolean): Promise<RecipeDetailResponse> {
  const userId = requireAppUserId();
  useMockAppStore.getState().setRecipeFavorite(userId, recipeId, isFavorite);
  return getRecipe(recipeId);
}

async function cookRecipe(recipeId: string): Promise<RecipeDetailResponse> {
  const userId = requireAppUserId();
  useMockAppStore.getState().cookRecipe(userId, recipeId);
  return getRecipe(recipeId);
}

async function rateRecipe(recipeId: string, payload: RecipeRatingPayload): Promise<RecipeDetailResponse> {
  const userId = requireAppUserId();
  useMockAppStore.getState().rateRecipe(userId, recipeId, payload.rating, payload.feedback);
  return getRecipe(recipeId);
}

export const recipesService = {
  acceptGeneration,
  cookRecipe,
  createGenerationRevision,
  getActiveGeneration,
  getGeneration,
  getGenerationRevisions,
  getRecipe,
  listRecipes,
  rateRecipe,
  setFavorite,
  startGeneration,
};

export default recipesService;
