import { screen, waitFor } from '@testing-library/react-native';
import PlannerChatScreen from './PlannerChatScreen';
import { renderWithProviders } from '../../test/render';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: jest.fn(),
  }),
}));

jest.mock('../../lib/services', () => ({
  plannerService: {
    getLatestRevision: jest.fn(),
    createRevision: jest.fn(),
    acceptRevision: jest.fn(),
  },
}));

const { plannerService } = jest.requireMock('../../lib/services') as {
  plannerService: {
    getLatestRevision: jest.Mock;
    createRevision: jest.Mock;
    acceptRevision: jest.Mock;
  };
};

describe('PlannerChatScreen', () => {
  beforeEach(() => {
    plannerService.getLatestRevision.mockResolvedValue({
      id: 'revision-1',
      weeklyPlanId: 'plan-1',
      revisionNumber: 2,
      chat: [
        {
          id: 'chat-1',
          role: 'assistant',
          content: 'Updated plan draft.',
          timestamp: '2026-03-14T00:00:00.000Z',
        },
      ],
      latestOutput: {
        badge: 'High protein',
        rationale: 'Adjusted for lighter dinners.',
        draftRecipes: [],
        days: [
          { dayKey: 'mon', label: 'Monday', meals: [] },
          { dayKey: 'tue', label: 'Tuesday', meals: [] },
          { dayKey: 'wed', label: 'Wednesday', meals: [] },
          { dayKey: 'thu', label: 'Thursday', meals: [] },
          { dayKey: 'fri', label: 'Friday', meals: [] },
          { dayKey: 'sat', label: 'Saturday', meals: [] },
          { dayKey: 'sun', label: 'Sunday', meals: [] },
        ],
      },
      createdAt: '2026-03-14T00:00:00.000Z',
      updatedAt: '2026-03-14T00:00:00.000Z',
    });
  });

  it('renders planner chat inside a bounded scroll container', async () => {
    renderWithProviders(<PlannerChatScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('planner-chat-scroll')).toBeTruthy();
    });
  });
});
