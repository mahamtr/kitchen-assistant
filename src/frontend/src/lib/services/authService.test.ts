const promptAsyncMock = jest.fn();
const makeRedirectUriMock = jest.fn(() => 'kitchen-assistant://oauth/google');
const authRequestMock = jest.fn().mockImplementation(() => ({
  promptAsync: promptAsyncMock,
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
  },
}));

jest.mock('expo-auth-session', () => ({
  AuthRequest: authRequestMock,
  ResponseType: {
    IdToken: 'id_token',
  },
  makeRedirectUri: makeRedirectUriMock,
}));

const clearStoredAuthSessionMock = jest.fn();
const setStoredAuthSessionMock = jest.fn();
const getStoredAuthSessionMock = jest.fn();

jest.mock('../authSession', () => ({
  clearStoredAuthSession: clearStoredAuthSessionMock,
  getStoredAuthSession: getStoredAuthSessionMock,
  setStoredAuthSession: setStoredAuthSessionMock,
}));

const apiGetMock = jest.fn();
const apiPostMock = jest.fn();

jest.mock('../api', () => ({
  apiGet: apiGetMock,
  apiPost: apiPostMock,
}));

const getPreferencesMock = jest.fn();
const bootstrapFromSessionMock = jest.fn();

jest.mock('./userService', () => ({
  userService: {
    bootstrapFromSession: bootstrapFromSessionMock,
    getPreferences: getPreferencesMock,
  },
}));

const setAuthenticatedMock = jest.fn();
const setUnauthenticatedMock = jest.fn();

jest.mock('../store/userStore', () => ({
  useUserStore: {
    getState: () => ({
      setAuthenticated: setAuthenticatedMock,
      setUnauthenticated: setUnauthenticatedMock,
    }),
  },
}));

import { authService } from './authService';

describe('authService.signInWithGoogle', () => {
  const originalWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id';

    promptAsyncMock.mockReset();
    makeRedirectUriMock.mockClear();
    authRequestMock.mockClear();
    clearStoredAuthSessionMock.mockReset();
    setStoredAuthSessionMock.mockReset();
    getStoredAuthSessionMock.mockReset();
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    getPreferencesMock.mockReset();
    bootstrapFromSessionMock.mockReset();
    setAuthenticatedMock.mockReset();
    setUnauthenticatedMock.mockReset();

    let storedSession: any = null;
    setStoredAuthSessionMock.mockImplementation(async (session) => {
      storedSession = session;
    });
    getStoredAuthSessionMock.mockImplementation(async () => storedSession);
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = originalWebClientId;
  });

  it('returns null when the Google auth flow is cancelled', async () => {
    promptAsyncMock.mockResolvedValue({ type: 'cancel' });

    const result = await authService.signInWithGoogle();

    expect(result).toBeNull();
    expect(apiPostMock).not.toHaveBeenCalled();
    expect(setStoredAuthSessionMock).not.toHaveBeenCalled();
    expect(setAuthenticatedMock).not.toHaveBeenCalled();
  });

  it('establishes a backend session after successful OAuth', async () => {
    const session = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      tokenType: 'bearer',
    };
    const authUser = { id: 'auth-user-id', email: 'user@example.com' };

    promptAsyncMock.mockResolvedValue({
      type: 'success',
      params: {
        id_token: 'google-id-token',
      },
    });
    apiPostMock.mockResolvedValue(session);
    apiGetMock.mockResolvedValue(authUser);
    bootstrapFromSessionMock.mockResolvedValue({ id: 'app-user-id' });
    getPreferencesMock.mockResolvedValue({ units: 'metric' });

    const result = await authService.signInWithGoogle();

    expect(authRequestMock).toHaveBeenCalledTimes(1);
    expect(makeRedirectUriMock).toHaveBeenCalledTimes(1);
    expect(apiPostMock).toHaveBeenCalledWith(
      '/auth/oauth/google',
      { idToken: 'google-id-token' },
      { skipAuth: true },
    );
    expect(setStoredAuthSessionMock).toHaveBeenCalledWith(session);
    expect(apiGetMock).toHaveBeenCalledWith('/auth/session');
    expect(setAuthenticatedMock).toHaveBeenCalledWith(authUser, 'app-user-id', true);
    expect(result).toEqual(session);
  });

  it('throws when OAuth succeeds without an id token', async () => {
    promptAsyncMock.mockResolvedValue({
      type: 'success',
      params: {},
    });

    await expect(authService.signInWithGoogle()).rejects.toThrow(
      'Google sign-in did not return an id token.',
    );
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it('throws when Google client id is not configured', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = '';

    await expect(authService.signInWithGoogle()).rejects.toThrow(
      'Google sign-in is not configured for this platform.',
    );
    expect(promptAsyncMock).not.toHaveBeenCalled();
    expect(apiPostMock).not.toHaveBeenCalled();
  });
});
