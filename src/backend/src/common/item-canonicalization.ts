export type ItemCanonicalizationMatch = 'synonym_map' | 'fallback';

export interface ItemCanonicalizationResult {
  displayName: string;
  normalizedName: string;
  canonicalKey: string;
  matchedBy: ItemCanonicalizationMatch;
}

const SYNONYM_MAP: Record<string, string> = {
  'fresh spinach': 'spinach',
  'baby spinach': 'spinach',
  'spinach leaves': 'spinach',
  'spring onion': 'green onion',
  'spring onions': 'green onion',
  scallions: 'green onion',
};

const PREFIX_TOKENS = new Set(['fresh']);

export function normalizeItemName(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function canonicalizeItemName(value: string): ItemCanonicalizationResult {
  const displayName = value.trim();
  const normalizedName = normalizeItemName(displayName);
  const tokens = normalizedName.split(' ').filter(Boolean);
  const cleanedTokens = [...tokens];

  while (cleanedTokens.length > 1 && PREFIX_TOKENS.has(cleanedTokens[0])) {
    cleanedTokens.shift();
  }

  const cleanedName = cleanedTokens.join(' ');
  const synonymHit = SYNONYM_MAP[cleanedName] ?? SYNONYM_MAP[normalizedName];

  if (synonymHit) {
    return {
      displayName,
      normalizedName,
      canonicalKey: synonymHit,
      matchedBy: 'synonym_map',
    };
  }

  return {
    displayName,
    normalizedName,
    canonicalKey: cleanedName || normalizedName,
    matchedBy: 'fallback',
  };
}
