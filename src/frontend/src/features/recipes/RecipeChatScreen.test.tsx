import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import RecipeChatScreen from './RecipeChatScreen';
import { renderWithProviders } from '../../test/render';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    generationId: 'generation-1',
  }),
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock('../../lib/services', () => ({
  recipesService: {
    acceptGeneration: jest.fn(),
    createGenerationRevision: jest.fn(),
    getGeneration: jest.fn(),
  },
}));

const { recipesService } = jest.requireMock('../../lib/services') as {
  recipesService: {
    acceptGeneration: jest.Mock;
    createGenerationRevision: jest.Mock;
    getGeneration: jest.Mock;
  };
};

describe('RecipeChatScreen', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    recipesService.getGeneration.mockReset();
    recipesService.getGeneration
      .mockResolvedValueOnce({
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
              content: 'Persisted chef transcript from backend',
              timestamp: '2026-03-14T00:00:00.000Z',
            },
          ],
          latestOutput: null,
          createdAt: '2026-03-14T00:00:00.000Z',
          updatedAt: '2026-03-14T00:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        generation: {
          id: 'generation-1',
          userId: 'user-1',
          weeklyPlanId: 'plan-1',
          status: 'active',
          latestRevisionId: 'revision-2',
          acceptedRecipeId: null,
          contextSnapshot: {},
          createdAt: '2026-03-14T00:00:00.000Z',
          updatedAt: '2026-03-14T00:01:00.000Z',
        },
        latestRevision: {
          id: 'revision-2',
          generationId: 'generation-1',
          userId: 'user-1',
          revisionNumber: 2,
          chat: [],
          latestOutput: {
            title: 'Fast Chicken Bowl',
            summary: 'A quick high-protein bowl with chicken and rice.',
            metadata: {
              readyInMinutes: 25,
              calories: 620,
              highlight: 'High protein',
            },
            ingredients: [],
            steps: [],
            tags: ['high-protein'],
          },
          createdAt: '2026-03-14T00:01:00.000Z',
          updatedAt: '2026-03-14T00:01:00.000Z',
        },
      });
    recipesService.createGenerationRevision.mockResolvedValue({});
  });

  it('renders empty-start chef chat before the first draft exists', async () => {
    renderWithProviders(<RecipeChatScreen />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('What would you like to eat?')).toBeTruthy();
    });

    expect(screen.queryByText('Persisted chef transcript from backend')).toBeNull();
    expect(screen.queryByText('Accept Draft')).toBeNull();
    expect(screen.getByText('Generate first draft')).toBeTruthy();

    fireEvent.changeText(
      screen.getByPlaceholderText('What would you like to eat?'),
      'I want a high-protein dinner under 30 minutes.',
    );
    fireEvent.press(screen.getByText('Generate first draft'));

    await waitFor(() => {
      expect(recipesService.createGenerationRevision).toHaveBeenCalledWith(
        'generation-1',
        { userMessage: 'I want a high-protein dinner under 30 minutes.' },
      );
    });

    await waitFor(() => {
      expect(screen.getByText('I want a high-protein dinner under 30 minutes.')).toBeTruthy();
      expect(screen.getByText('A quick high-protein bowl with chicken and rice.')).toBeTruthy();
    });
  });
});
