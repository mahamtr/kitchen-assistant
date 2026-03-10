import { recipesService } from './recipesService';
import { userService } from './userService';
import { useMockAppStore } from '../mock/mockStore';
import { useUserStore } from '../store/userStore';

let userCounter = 0;

function authenticateTestUser() {
  userCounter += 1;
  const authUser = {
    supabaseUserId: `recipe-test-user-${userCounter}`,
    email: `recipe-test-${userCounter}@example.com`,
    displayName: `Recipe Test ${userCounter}`,
  };
  const appUserId = userService.bootstrapFromSession(authUser);
  useMockAppStore.getState().completeOnboarding(appUserId);
  useUserStore.getState().setAuthenticated(authUser, appUserId);
  return appUserId;
}

describe('recipesService', () => {
  afterEach(() => {
    useUserStore.getState().setUnauthenticated();
  });

  it('keeps the latest rating when a user changes recipe feedback', async () => {
    const userId = authenticateTestUser();
    const recipeId = `${userId}_recipe_salmon_rice_bowl`;

    const firstRating = await recipesService.rateRecipe(recipeId, { rating: 2 });
    const updatedRating = await recipesService.rateRecipe(recipeId, { rating: 5 });
    const detail = await recipesService.getRecipe(recipeId);

    expect(firstRating.latestRating).toBe(2);
    expect(updatedRating.latestRating).toBe(5);
    expect(detail.latestRating).toBe(5);
  });

  it('keeps the latest favorite state when a user toggles it repeatedly', async () => {
    const userId = authenticateTestUser();
    const recipeId = `${userId}_recipe_greek_yogurt_power_bowl`;

    const removed = await recipesService.setFavorite(recipeId, false);
    const restored = await recipesService.setFavorite(recipeId, true);
    const detail = await recipesService.getRecipe(recipeId);

    expect(removed.isFavorite).toBe(false);
    expect(restored.isFavorite).toBe(true);
    expect(detail.isFavorite).toBe(true);
  });
});
