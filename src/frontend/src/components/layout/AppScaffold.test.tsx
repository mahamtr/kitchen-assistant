import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'tamagui';
import AppScaffold from './AppScaffold';
import { renderWithProviders } from '../../test/render';
import { useKeyboardMetrics } from '../../hooks/useKeyboardVisible';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

jest.mock('../../hooks/useKeyboardVisible', () => ({
  useKeyboardMetrics: jest.fn(),
}));

const mockUseKeyboardMetrics = useKeyboardMetrics as jest.MockedFunction<typeof useKeyboardMetrics>;

describe('AppScaffold', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockUseKeyboardMetrics.mockReturnValue({ keyboardHeight: 0, keyboardVisible: false });
  });

  it('renders the shared app shell content', () => {
    renderWithProviders(
      <AppScaffold
        title="Kitchen"
        subtitle="Track what to buy, what is stocked, and what is expiring."
        activeTab="kitchen"
        headerAccessory={<Text>64 in stock</Text>}
        footer={<Text>Footer actions</Text>}
      >
        <Text>Main content block</Text>
      </AppScaffold>,
    );

    expect(screen.getAllByText('Kitchen')).toHaveLength(2);
    expect(screen.getByText('64 in stock')).toBeTruthy();
    expect(screen.getByText('Main content block')).toBeTruthy();
    expect(screen.getByText('Footer actions')).toBeTruthy();
    expect(screen.getByText('Weekly Plan')).toBeTruthy();
  });

  it('routes bottom-tab presses through expo-router replace navigation', () => {
    renderWithProviders(
      <AppScaffold title="Home" subtitle="Today at a glance." activeTab="home">
        <Text>Dashboard</Text>
      </AppScaffold>,
    );

    fireEvent.press(screen.getByText('Recipes'));
    fireEvent.press(screen.getByText('Kitchen'));

    expect(mockReplace).toHaveBeenNthCalledWith(1, '/recipes');
    expect(mockReplace).toHaveBeenNthCalledWith(2, '/kitchen/to-buy');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('hides the bottom tab bar while typing', () => {
    mockUseKeyboardMetrics.mockReturnValue({ keyboardHeight: 280, keyboardVisible: true });

    renderWithProviders(
      <AppScaffold title="Planner" subtitle="Adjust the draft." activeTab="planner">
        <Text>Chat input</Text>
      </AppScaffold>,
    );

    expect(screen.queryByText('Weekly Plan')).toBeNull();
    expect(screen.queryByText('Recipes')).toBeNull();
  });
});
