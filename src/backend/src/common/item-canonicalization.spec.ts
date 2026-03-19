import { Logger } from '@nestjs/common';
import { canonicalizeItemName } from './item-canonicalization';

describe('item canonicalization', () => {
  it('maps spinach aliases to a shared canonical key', () => {
    const variants = ['spinach', 'fresh spinach', 'spinach leaves'];
    const keys = variants.map((name) => canonicalizeItemName(name).canonicalKey);

    expect(new Set(keys)).toEqual(new Set(['spinach']));
  });

  it('maps extended alias groups to shared canonical keys', () => {
    expect(canonicalizeItemName('Scallions').canonicalKey).toBe('green onion');
    expect(canonicalizeItemName('Courgette').canonicalKey).toBe('zucchini');
    expect(canonicalizeItemName('Garbanzo beans').canonicalKey).toBe(
      'chickpea',
    );
    expect(canonicalizeItemName('Eggs').canonicalKey).toBe('egg');
    expect(canonicalizeItemName('Organic Greek yoghurt').canonicalKey).toBe(
      'greek yogurt',
    );
    expect(canonicalizeItemName('Capsicum').canonicalKey).toBe('bell pepper');
    expect(canonicalizeItemName('Rocket').canonicalKey).toBe('arugula');
    expect(canonicalizeItemName('Plain flour').canonicalKey).toBe(
      'all purpose flour',
    );
    expect(canonicalizeItemName('Confectioners sugar').canonicalKey).toBe(
      'powdered sugar',
    );
    expect(canonicalizeItemName('Extra virgin olive oil').canonicalKey).toBe(
      'olive oil',
    );
    expect(canonicalizeItemName('Double cream').canonicalKey).toBe(
      'heavy cream',
    );
    expect(canonicalizeItemName('Parmigiano Reggiano').canonicalKey).toBe(
      'parmesan',
    );
    expect(canonicalizeItemName('Chicken breasts').canonicalKey).toBe(
      'chicken breast',
    );
    expect(canonicalizeItemName('Prawns').canonicalKey).toBe('shrimp');
    expect(canonicalizeItemName('Turkey mince').canonicalKey).toBe(
      'ground turkey',
    );
  });

  it('falls back to normalized name when no synonym map entry exists', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const result = canonicalizeItemName('  Smoked-Paprika  ');

    expect(result.normalizedName).toBe('smoked paprika');
    expect(result.canonicalKey).toBe('smoked paprika');
    expect(result.matchedBy).toBe('fallback');
    expect(warnSpy).toHaveBeenCalledWith(
      'No synonym mapping found for "Smoked-Paprika". Falling back to "smoked paprika".',
    );

    warnSpy.mockRestore();
  });

  it('logs fallback mappings only once per normalized item name', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    canonicalizeItemName('Mystery Pantry Staple');
    canonicalizeItemName('mystery pantry staple');

    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });
});
