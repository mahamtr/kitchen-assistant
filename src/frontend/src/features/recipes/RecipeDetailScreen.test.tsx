import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import RecipeDetailScreen from './RecipeDetailScreen';
import { renderWithProviders } from '../../test/render';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    recipeId: 'recipe-1',
  }),
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock('../../lib/services', () => ({
  recipesService: {
    cookRecipe: jest.fn(),
    getRecipe: jest.fn(),
    rateRecipe: jest.fn(),
    setFavorite: jest.fn(),
  },
}));

const { recipesService } = jest.requireMock('../../lib/services') as {
  recipesService: {
    cookRecipe: jest.Mock;
    getRecipe: jest.Mock;
    rateRecipe: jest.Mock;
    setFavorite: jest.Mock;
  };
};

describe('RecipeDetailScreen', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    recipesService.getRecipe.mockResolvedValue({
      recipe: {
        id: 'recipe-1',
        weeklyPlanId: 'plan-1',
        title: 'Chicken Veggie Stir Fry',
        summary: 'Quick dinner',
        status: 'published',
        ingredients: [
          {
            id: 'ingredient-1',
            name: 'Chicken breast',
            quantity: '300 g',
            measurement: { value: 300, unit: 'g' },
          },
        ],
        steps: [
          { id: 'step-1', order: 1, text: 'Cook the chicken.' },
        ],
        tags: ['High protein'],
        isPublic: false,
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: '2026-03-10T00:00:00.000Z',
      },
      isFavorite: false,
      latestRating: 3,
      cookedAt: null,
    });
    recipesService.setFavorite.mockResolvedValue({
      recipe: {
        id: 'recipe-1',
        weeklyPlanId: 'plan-1',
        title: 'Chicken Veggie Stir Fry',
        summary: 'Quick dinner',
        status: 'published',
        ingredients: [
          {
            id: 'ingredient-1',
            name: 'Chicken breast',
            quantity: '300 g',
            measurement: { value: 300, unit: 'g' },
          },
        ],
        steps: [
          { id: 'step-1', order: 1, text: 'Cook the chicken.' },
        ],
        tags: ['High protein'],
        isPublic: false,
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: '2026-03-10T00:00:00.000Z',
      },
      isFavorite: true,
      latestRating: 3,
      cookedAt: null,
    });
    recipesService.rateRecipe.mockResolvedValue({
      recipe: {
        id: 'recipe-1',
        weeklyPlanId: 'plan-1',
        title: 'Chicken Veggie Stir Fry',
        summary: 'Quick dinner',
        status: 'published',
        ingredients: [
          {
            id: 'ingredient-1',
            name: 'Chicken breast',
            quantity: '300 g',
            measurement: { value: 300, unit: 'g' },
          },
        ],
        steps: [
          { id: 'step-1', order: 1, text: 'Cook the chicken.' },
        ],
        tags: ['High protein'],
        isPublic: false,
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: '2026-03-10T00:00:00.000Z',
      },
      isFavorite: false,
      latestRating: 4,
      cookedAt: null,
    });
    recipesService.cookRecipe.mockResolvedValue({
      recipe: {
        id: 'recipe-1',
        weeklyPlanId: 'plan-1',
        title: 'Chicken Veggie Stir Fry',
        summary: 'Quick dinner',
        status: 'published',
        ingredients: [
          {
            id: 'ingredient-1',
            name: 'Chicken breast',
            quantity: '300 g',
            measurement: { value: 300, unit: 'g' },
          },
        ],
        steps: [
          { id: 'step-1', order: 1, text: 'Cook the chicken.' },
        ],
        tags: ['High protein'],
        isPublic: false,
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: '2026-03-10T00:00:00.000Z',
      },
      isFavorite: false,
      latestRating: 3,
      cookedAt: '2026-03-10T00:00:00.000Z',
    });
  });

  it('renders separate favorite and feedback sections and allows rating changes', async () => {
    renderWithProviders(<RecipeDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Favorite')).toBeTruthy();
    });

    expect(screen.getByText('Recipe feedback')).toBeTruthy();
    expect(screen.getByText('Save to Favorites')).toBeTruthy();
    expect(screen.getByText('Current rating: 3 / 5. Tap a different score anytime.')).toBeTruthy();

    fireEvent.press(screen.getByText('Save to Favorites'));
    fireEvent.press(screen.getByText('4'));

    await waitFor(() => {
      expect(recipesService.setFavorite).toHaveBeenCalledWith('recipe-1', true);
      expect(recipesService.rateRecipe).toHaveBeenCalledWith('recipe-1', { rating: 4 });
    });
  });
});
