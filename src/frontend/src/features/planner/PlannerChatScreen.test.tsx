import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import PlannerChatScreen from './PlannerChatScreen';
import { renderWithProviders } from '../../test/render';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
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
    mockReplace.mockClear();
    plannerService.getLatestRevision.mockReset();
    plannerService.createRevision.mockReset();
    plannerService.acceptRevision.mockReset();

    plannerService.getLatestRevision.mockResolvedValue({
      id: 'revision-1',
      weeklyPlanId: 'plan-1',
      userId: 'user-1',
      revisionNumber: 1,
      chat: [
        {
          id: 'legacy-chat-1',
          role: 'assistant',
          content: 'Persisted planner transcript from backend',
          timestamp: '2026-03-14T00:00:00.000Z',
        },
      ],
      latestOutput: {
        rationale: 'Kept calories balanced through the week.',
        days: [
          {
            dayKey: 'mon',
            label: 'Monday',
            meals: [],
          },
        ],
      },
      createdAt: '2026-03-14T00:00:00.000Z',
      updatedAt: '2026-03-14T00:00:00.000Z',
    });

    plannerService.createRevision.mockResolvedValue({
      id: 'revision-2',
      weeklyPlanId: 'plan-1',
      userId: 'user-1',
      revisionNumber: 2,
      latestOutput: {
        rationale: 'Applied your updates for lighter dinners.',
        days: [
          {
            dayKey: 'mon',
            label: 'Monday',
            meals: [],
          },
        ],
      },
      createdAt: '2026-03-14T00:01:00.000Z',
      updatedAt: '2026-03-14T00:01:00.000Z',
    });
  });

  it('keeps planner chat session-local and uses planner-specific placeholder text', async () => {
    renderWithProviders(<PlannerChatScreen />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("How should I adjust this week's plan?")).toBeTruthy();
    });

    expect(
      screen.queryByText('Please make Tue-Thu dinners lighter and add more high-protein lunches.'),
    ).toBeNull();
    expect(screen.queryByText('Persisted planner transcript from backend')).toBeNull();

    fireEvent.changeText(
      screen.getByPlaceholderText("How should I adjust this week's plan?"),
      'Make Tuesday dinner lighter.',
    );
    fireEvent.press(screen.getByText('Update Draft'));

    await waitFor(() => {
      expect(plannerService.createRevision).toHaveBeenCalledWith({
        userMessage: 'Make Tuesday dinner lighter.',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Make Tuesday dinner lighter.')).toBeTruthy();
      expect(screen.getByText('Applied your updates for lighter dinners.')).toBeTruthy();
    });
  });
});
