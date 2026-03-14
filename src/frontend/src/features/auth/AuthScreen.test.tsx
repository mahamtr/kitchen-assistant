import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import AuthScreen from './AuthScreen';
import { renderWithProviders } from '../../test/render';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockLocalSearchParams(),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

jest.mock('../../hooks/useKeyboardVisible', () => ({
  useKeyboardMetrics: () => ({
    keyboardHeight: 0,
    keyboardVisible: false,
  }),
}));

jest.mock('../../lib/services', () => ({
  authService: {
    requestPasswordReset: jest.fn(),
    signIn: jest.fn(),
    signInWithGoogle: jest.fn(),
    signUp: jest.fn(),
    updatePassword: jest.fn(),
  },
}));

const { authService } = jest.requireMock('../../lib/services') as {
  authService: {
    requestPasswordReset: jest.Mock;
    signIn: jest.Mock;
    signInWithGoogle: jest.Mock;
    signUp: jest.Mock;
    updatePassword: jest.Mock;
  };
};

describe('AuthScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockLocalSearchParams.mockReturnValue({});
    authService.requestPasswordReset.mockReset();
    authService.signIn.mockReset();
    authService.signInWithGoogle.mockReset();
    authService.signUp.mockReset();
    authService.updatePassword.mockReset();
  });

  it('submits the recovery token when resetting a password', async () => {
    mockLocalSearchParams.mockReturnValue({
      resetToken: 'token-from-link',
    });
    authService.updatePassword.mockResolvedValue({
      message: 'Password updated successfully.',
    });

    renderWithProviders(<AuthScreen mode="reset" />);

    fireEvent.changeText(
      screen.getByPlaceholderText('you@example.com'),
      'user@example.com',
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('New password'),
      'NewStrongPassword123!',
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('Repeat password'),
      'NewStrongPassword123!',
    );
    fireEvent.press(screen.getByText('Send / Update password'));

    await waitFor(() => {
      expect(authService.updatePassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        newPassword: 'NewStrongPassword123!',
        confirmPassword: 'NewStrongPassword123!',
        resetToken: 'token-from-link',
      });
    });
  });

  it('hides the unavailable Google sign-in CTA on login', () => {
    renderWithProviders(<AuthScreen mode="login" />);

    expect(screen.queryByText('Continue with Google')).toBeNull();
    expect(
      screen.getByText(
        'Email and password sign-in is currently the supported login flow.',
      ),
    ).toBeTruthy();
  });
});
