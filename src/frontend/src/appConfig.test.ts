import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Expo app config', () => {
  it('defines native identifiers and a linking scheme for production builds', () => {
    const appConfig = JSON.parse(readFileSync(join(__dirname, '..', 'app.json'), 'utf8')) as {
      expo?: {
        scheme?: string;
        ios?: { bundleIdentifier?: string };
        android?: { package?: string; softwareKeyboardLayoutMode?: string };
      };
    };

    expect(appConfig.expo?.scheme).toBe('kitchen-assistant');
    expect(appConfig.expo?.ios?.bundleIdentifier).toBe('com.kitchenassistant.app');
    expect(appConfig.expo?.android?.package).toBe('com.kitchenassistant.app');
    expect(appConfig.expo?.android?.softwareKeyboardLayoutMode).toBe('resize');
  });
});
