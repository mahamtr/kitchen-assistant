describe('supacase auth storage', () => {
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
    const createClient = jest.fn(() => ({ auth: {} }));
    let moduleRef: typeof import('./supacase');

    jest.isolateModules(() => {
      jest.doMock('react-native', () => ({
        Platform: {
          OS: os,
        },
      }));
      jest.doMock('expo-secure-store', () => secureStore);
      jest.doMock('@supabase/supabase-js', () => ({
        createClient,
      }));

      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

      moduleRef = require('./supacase') as typeof import('./supacase');
    });

    return {
      createClient,
      module: moduleRef!,
      secureStore,
      secureStoreState,
    };
  }

  it('creates the Supabase client with the shared auth storage adapter', () => {
    const { createClient, module } = loadModule();

    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          detectSessionInUrl: false,
          storage: module.authStorage,
        }),
      }),
    );
  });

  it('chunks large native auth payloads and reassembles them on read', async () => {
    const { module, secureStoreState } = loadModule();
    const value = 'session-payload-'.repeat(400);

    await module.authStorage.setItem('session', value);

    expect(secureStoreState.get('session')).toBeUndefined();
    expect(Array.from(secureStoreState.keys()).filter((key) => key.startsWith('session.chunk_')).length).toBeGreaterThan(1);
    await expect(module.authStorage.getItem('session')).resolves.toBe(value);
  });

  it('clears old chunks when replacing a large value with a small value', async () => {
    const { module, secureStoreState } = loadModule();

    await module.authStorage.setItem('session', 'session-payload-'.repeat(400));
    await module.authStorage.setItem('session', 'small-session');

    expect(Array.from(secureStoreState.keys()).filter((key) => key.startsWith('session.chunk_'))).toHaveLength(0);
    expect(secureStoreState.get('session')).toBe('small-session');
    await expect(module.authStorage.getItem('session')).resolves.toBe('small-session');
  });
});
