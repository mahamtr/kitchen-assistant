import { apiDelete, apiGet, apiPost } from '../api';
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
  return apiGet(`/recipes?scope=${scope}&search=${encodeURIComponent(search)}`);
}

async function getRecipe(recipeId: string): Promise<RecipeDetailResponse> {
  return apiGet(`/recipes/${recipeId}`);
}

async function getActiveGeneration(): Promise<RecipeGenerationResponse | null> {
  return apiGet('/recipes/generations/active');
}

async function startGeneration(userMessage?: string): Promise<RecipeGenerationResponse> {
  return apiPost(
    '/recipes/generations',
    userMessage?.trim() ? { userMessage } : undefined,
  );
}

async function getGeneration(generationId: string): Promise<RecipeGenerationResponse> {
  return apiGet(`/recipes/generations/${generationId}`);
}

async function getGenerationRevisions(generationId: string): Promise<RecipeGenerationRevisionResponse[]> {
  return apiGet(`/recipes/generations/${generationId}/revisions`);
}

async function createGenerationRevision(
  generationId: string,
  payload: CreateRecipeRevisionPayload,
): Promise<RecipeGenerationRevisionResponse> {
  return apiPost(`/recipes/generations/${generationId}/revisions`, payload);
}

async function acceptGeneration(generationId: string, revisionId: string): Promise<RecipeDetailResponse> {
  return apiPost(`/recipes/generations/${generationId}/revisions/${revisionId}/accept`);
}

async function setFavorite(recipeId: string, isFavorite: boolean): Promise<RecipeDetailResponse> {
  if (isFavorite) {
    return apiPost(`/recipes/${recipeId}/favorite`);
  }

  return apiDelete(`/recipes/${recipeId}/favorite`);
}

async function cookRecipe(recipeId: string): Promise<RecipeDetailResponse> {
  return apiPost(`/recipes/${recipeId}/cooked`);
}

async function rateRecipe(recipeId: string, payload: RecipeRatingPayload): Promise<RecipeDetailResponse> {
  return apiPost(`/recipes/${recipeId}/rate`, payload);
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
