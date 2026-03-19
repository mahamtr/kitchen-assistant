import { Logger } from '@nestjs/common';

export type ItemCanonicalizationMatch = 'synonym_map' | 'fallback';

export interface ItemCanonicalizationResult {
  displayName: string;
  normalizedName: string;
  canonicalKey: string;
  matchedBy: ItemCanonicalizationMatch;
}

const logger = new Logger('ItemCanonicalization');

const CANONICAL_SYNONYM_GROUPS: Record<string, string[]> = {
  onion: ['onions', 'yellow onion', 'yellow onions', 'white onion', 'white onions'],
  'red onion': ['red onions'],
  garlic: ['garlic cloves'],
  shallot: ['shallots'],
  spinach: ['fresh spinach', 'baby spinach', 'spinach leaves'],
  'bell pepper': ['capsicum', 'capsicums', 'bell peppers'],
  'green onion': [
    'green onions',
    'spring onion',
    'spring onions',
    'scallion',
    'scallions',
  ],
  cilantro: ['coriander leaves'],
  arugula: ['rocket'],
  zucchini: ['courgette', 'courgettes'],
  eggplant: ['aubergine', 'aubergines'],
  potato: ['potatoes', 'white potato', 'white potatoes', 'yellow potato', 'yellow potatoes'],
  'sweet potato': ['sweet potatoes'],
  tomato: ['tomatoes', 'roma tomato', 'roma tomatoes'],
  mushroom: ['mushrooms', 'button mushroom', 'button mushrooms'],
  'chili pepper': ['chili peppers', 'chilli pepper', 'chilli peppers'],
  corn: ['sweet corn'],
  yogurt: ['yoghurt', 'plain yoghurt'],
  'greek yogurt': ['greek yoghurt'],
  chickpea: ['chickpeas', 'garbanzo bean', 'garbanzo beans'],
  'black bean': ['black beans'],
  'kidney bean': ['kidney beans'],
  egg: ['eggs'],
  'all purpose flour': ['plain flour', 'ap flour'],
  cornstarch: ['corn starch'],
  'powdered sugar': ['icing sugar', 'confectioners sugar'],
  'baking soda': ['bicarbonate of soda', 'bicarb soda'],
  'rolled oats': ['oats', 'porridge oats'],
  'olive oil': ['extra virgin olive oil', 'evoo'],
  'vegetable oil': ['neutral oil', 'canola oil'],
  'soy sauce': ['light soy sauce'],
  'heavy cream': ['double cream', 'thickened cream'],
  'half and half': ['half-and-half'],
  mozzarella: ['mozzarella cheese'],
  parmesan: ['parmesan cheese', 'parmigiano', 'parmigiano reggiano'],
  cheddar: ['cheddar cheese'],
  'cream cheese': ['soft cheese'],
  parsley: ['flat leaf parsley', 'flat-leaf parsley'],
  oregano: ['dried oregano'],
  cumin: ['ground cumin'],
  'chili powder': ['chilli powder'],
  'chicken breast': ['chicken breasts'],
  'chicken thigh': ['chicken thighs'],
  'salmon fillet': ['salmon fillets'],
  shrimp: ['prawn', 'prawns', 'shrimps'],
  bacon: ['streaky bacon'],
  'ground beef': ['minced beef'],
  'ground chicken': ['minced chicken', 'chicken mince'],
  'ground turkey': ['minced turkey', 'turkey mince'],
  'ground pork': ['minced pork', 'pork mince'],
};

const SYNONYM_MAP = Object.entries(CANONICAL_SYNONYM_GROUPS).reduce<
  Record<string, string>
>((result, [canonicalKey, aliases]) => {
  result[canonicalKey] = canonicalKey;

  for (const alias of aliases) {
    result[alias] = canonicalKey;
  }

  return result;
}, {});

const PREFIX_TOKENS = new Set(['fresh', 'organic']);
const loggedFallbackNames = new Set<string>();

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

  const canonicalKey = cleanedName || normalizedName;

  if (canonicalKey && !loggedFallbackNames.has(normalizedName)) {
    loggedFallbackNames.add(normalizedName);
    logger.warn(
      `No synonym mapping found for "${displayName}". Falling back to "${canonicalKey}".`,
    );
  }

  return {
    displayName,
    normalizedName,
    canonicalKey,
    matchedBy: 'fallback',
  };
}
