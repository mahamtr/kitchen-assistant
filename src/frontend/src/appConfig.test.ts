import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Expo app config', () => {
  it('defines a linking scheme for production builds', () => {
    const appConfig = JSON.parse(readFileSync(join(__dirname, '..', 'app.json'), 'utf8')) as {
      expo?: { scheme?: string; android?: { softwareKeyboardLayoutMode?: string } };
    };

    expect(appConfig.expo?.scheme).toBe('kitchen-assistant');
    expect(appConfig.expo?.android?.softwareKeyboardLayoutMode).toBe('resize');
  });
});
