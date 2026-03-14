import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import HomeScreen from './HomeScreen';
import { renderWithProviders } from '../../test/render';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

jest.mock('../../lib/services', () => ({
  authService: {
    signOut: jest.fn(),
  },
  homeService: {
    getToday: jest.fn(),
  },
}));

const { homeService } = jest.requireMock('../../lib/services') as {
  homeService: { getToday: jest.Mock };
};

describe('HomeScreen navigation', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    homeService.getToday.mockResolvedValue({
      todayLabel: 'Monday',
      target: {
        calories: '2,100 kcal',
        macros: 'P150 C180 F70',
      },
      todayMeals: [
        {
          slot: 'breakfast',
          recipeId: 'recipe-breakfast',
          title: 'Greek yogurt bowl',
          shortLabel: 'Greek yogurt bowl',
          calories: 420,
          tags: [],
        },
      ],
      importantInfo: {
        title: 'Important Information',
        alerts: ['Use spinach first.'],
        ctaLabel: 'Open Weekly Plan',
      },
      shortcuts: [],
    });
  });

  it('uses replace for main-screen navigation and push for recipe detail substeps', async () => {
    renderWithProviders(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText('Open Weekly Plan')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Open Weekly Plan'));
    fireEvent.press(screen.getByText('Greek yogurt bowl'));

    expect(mockReplace).toHaveBeenCalledWith('/planner');
    expect(mockPush).toHaveBeenCalledWith('/recipes/recipe-breakfast');
  });

  it('renders meals with a missing slot without crashing', async () => {
    homeService.getToday.mockResolvedValueOnce({
      todayLabel: 'Monday',
      target: {
        calories: '2,100 kcal',
        macros: 'P150 C180 F70',
      },
      todayMeals: [
        {
          recipeId: 'recipe-lunch',
          title: 'Fallback lunch',
          shortLabel: 'Fallback lunch',
          calories: 510,
          tags: [],
        },
      ],
      importantInfo: {
        title: 'Important Information',
        alerts: ['Use spinach first.'],
        ctaLabel: 'Open Weekly Plan',
      },
      shortcuts: [],
    });

    renderWithProviders(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText('Meal 1')).toBeTruthy();
      expect(screen.getByText('Fallback lunch')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Fallback lunch'));

    expect(mockPush).toHaveBeenCalledWith('/recipes/recipe-lunch');
  });
});
