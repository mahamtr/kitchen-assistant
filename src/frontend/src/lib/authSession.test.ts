describe('authSession storage', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  function loadModule(os: 'ios' | 'web' = 'ios') {
    const secureStoreState = new Map<string, string>();
    const secureStore = {
      deleteItemAsync: jest.fn(async (key: string) => {
        secureStoreState.delete(key);
      }),
      getItemAsync: jest.fn(async (key: string) => secureStoreState.get(key) ?? null),
      setItemAsync: jest.fn(async (key: string, value: string) => {
        secureStoreState.set(key, value);
      }),
    };
    let moduleRef: typeof import('./authSession');

    jest.isolateModules(() => {
      jest.doMock('react-native', () => ({
        Platform: {
          OS: os,
        },
      }));
      jest.doMock('expo-secure-store', () => secureStore);

      moduleRef = require('./authSession') as typeof import('./authSession');
    });

    return {
      module: moduleRef!,
      secureStoreState,
    };
  }

  it('chunks large native auth payloads and reassembles them on read', async () => {
    const { module, secureStoreState } = loadModule();
    const largeToken = 'session-token-'.repeat(400);

    await module.setStoredAuthSession({
      accessToken: largeToken,
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });

    expect(secureStoreState.get('kitchen_assistant.auth_session')).toBeUndefined();
    expect(
      Array.from(secureStoreState.keys()).filter((key) =>
        key.startsWith('kitchen_assistant.auth_session.chunk_'),
      ).length,
    ).toBeGreaterThan(1);
    await expect(module.getStoredAuthSession()).resolves.toEqual({
      accessToken: largeToken,
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
  });

  it('clears old chunks when replacing a large value with a small value', async () => {
    const { module, secureStoreState } = loadModule();

    await module.setStoredAuthSession({
      accessToken: 'session-token-'.repeat(400),
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
    await module.setStoredAuthSession({
      accessToken: 'small-access-token',
      refreshToken: 'small-refresh-token',
      expiresIn: 1800,
      tokenType: 'Bearer',
    });

    expect(
      Array.from(secureStoreState.keys()).filter((key) =>
        key.startsWith('kitchen_assistant.auth_session.chunk_'),
      ),
    ).toHaveLength(0);
    await expect(module.getStoredAuthSession()).resolves.toEqual({
      accessToken: 'small-access-token',
      refreshToken: 'small-refresh-token',
      expiresIn: 1800,
      tokenType: 'Bearer',
    });
  });

  it('removes the stored session completely', async () => {
    const { module } = loadModule();

    await module.setStoredAuthSession({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
    await module.clearStoredAuthSession();

    await expect(module.getStoredAuthSession()).resolves.toBeNull();
  });
});
