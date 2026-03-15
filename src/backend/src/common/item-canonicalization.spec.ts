import { canonicalizeItemName } from './item-canonicalization';

describe('item canonicalization', () => {
  it('maps spinach aliases to a shared canonical key', () => {
    const variants = ['spinach', 'fresh spinach', 'spinach leaves'];
    const keys = variants.map((name) => canonicalizeItemName(name).canonicalKey);

    expect(new Set(keys)).toEqual(new Set(['spinach']));
  });

  it('falls back to normalized name when no synonym map entry exists', () => {
    const result = canonicalizeItemName('  Smoked-Paprika  ');

    expect(result.normalizedName).toBe('smoked paprika');
    expect(result.canonicalKey).toBe('smoked paprika');
    expect(result.matchedBy).toBe('fallback');
  });
});
