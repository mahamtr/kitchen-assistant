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
    recipesService.getGeneration.mockResolvedValue({
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
        conversationSummary: 'User requested quick high-protein dinners with simple ingredients.',
        compactedUserMessageCount: 3,
        createdAt: '2026-03-14T00:00:00.000Z',
        updatedAt: '2026-03-14T00:00:00.000Z',
      },
    });
    recipesService.createGenerationRevision.mockResolvedValue({});
  });

  it('renders empty-start chef chat before the first draft exists', async () => {
    renderWithProviders(<RecipeChatScreen />);

    await waitFor(() => {
      expect(screen.getByText('What would you like to eat?')).toBeTruthy();
    });

    expect(screen.getByTestId('recipe-chat-scroll')).toBeTruthy();
    expect(screen.queryByText('Accept Draft')).toBeNull();
    expect(screen.getByText('Generate first draft')).toBeTruthy();
    expect(screen.getByText('Context summarized after 3 user turns.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('recipe-compaction-info-toggle'));
    expect(screen.getByText(/privacy and faster responses/i)).toBeTruthy();

    fireEvent.press(screen.getByTestId('recipe-compact-summary-toggle'));
    expect(screen.getByTestId('recipe-compact-summary-drawer')).toBeTruthy();
    expect(screen.getByText('User requested quick high-protein dinners with simple ingredients.')).toBeTruthy();

    const recipeInput = screen.getByPlaceholderText('What would you like to eat?');
    expect(recipeInput).toHaveProp('multiline', true);

    fireEvent.changeText(
      recipeInput,
      'I want a high-protein dinner under 30 minutes.',
    );
    fireEvent.press(screen.getByText('Generate first draft'));

    await waitFor(() => {
      expect(recipesService.createGenerationRevision).toHaveBeenCalledWith(
        'generation-1',
        { userMessage: 'I want a high-protein dinner under 30 minutes.' },
      );
    });
  });
});
