import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import RecipesScreen from './RecipesScreen';
import { renderWithProviders } from '../../test/render';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('../../lib/services', () => ({
  recipesService: {
    listRecipes: jest.fn(),
    setFavorite: jest.fn(),
    startGeneration: jest.fn(),
  },
}));

const { recipesService } = jest.requireMock('../../lib/services') as {
  recipesService: {
    listRecipes: jest.Mock;
    setFavorite: jest.Mock;
    startGeneration: jest.Mock;
  };
};

describe('RecipesScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    recipesService.listRecipes.mockResolvedValue({
      scope: 'weekly_planned',
      items: [],
    });
    recipesService.startGeneration.mockResolvedValue({
      generation: {
        id: 'generation-1',
        userId: 'user-1',
        weeklyPlanId: 'plan-1',
        status: 'active',
        latestRevisionId: 'revision-1',
        acceptedRecipeId: null,
        contextSnapshot: {},
        createdAt: '2026-03-14T00:00:00.000Z',
        updatedAt: '2026-03-14T00:00:00.000Z',
      },
      latestRevision: {
        id: 'revision-1',
        generationId: 'generation-1',
        userId: 'user-1',
        revisionNumber: 1,
        chat: [
          {
            id: 'chat-1',
            role: 'assistant',
            content: 'What would you like to eat?',
            timestamp: '2026-03-14T00:00:00.000Z',
          },
        ],
        latestOutput: null,
        createdAt: '2026-03-14T00:00:00.000Z',
        updatedAt: '2026-03-14T00:00:00.000Z',
      },
    });
  });

  it('starts chef chat without a seeded prompt or initial draft', async () => {
    renderWithProviders(<RecipesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Chat with Chef')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Chat with Chef'));

    await waitFor(() => {
      expect(recipesService.startGeneration).toHaveBeenCalledWith();
    });

    expect(mockPush).toHaveBeenCalledWith('/recipes/chat/generation-1');
  });
});
