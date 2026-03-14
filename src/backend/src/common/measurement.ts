export const CANONICAL_MEASUREMENT_UNITS = [
  'g',
  'ml',
  'piece',
  'clove',
  'egg',
  'can',
  'jar',
  'pack',
  'fillet',
  'slice',
] as const;

export type CanonicalMeasurementUnit =
  (typeof CANONICAL_MEASUREMENT_UNITS)[number];

export type MeasurementValue = {
  value: number;
  unit: CanonicalMeasurementUnit;
};

type MeasurementInput = {
  value: number;
  unit: string;
};

const EXACT_UNIT_ALIASES: Record<string, string> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  piece: 'piece',
  pieces: 'piece',
  item: 'piece',
  items: 'piece',
  pc: 'piece',
  pcs: 'piece',
  clove: 'clove',
  cloves: 'clove',
  egg: 'egg',
  eggs: 'egg',
  can: 'can',
  cans: 'can',
  jar: 'jar',
  jars: 'jar',
  pack: 'pack',
  packs: 'pack',
  fillet: 'fillet',
  fillets: 'fillet',
  slice: 'slice',
  slices: 'slice',
};

const COUNT_UNIT_LABELS: Record<
  Exclude<CanonicalMeasurementUnit, 'g' | 'ml'>,
  { singular: string; plural: string }
> = {
  piece: { singular: 'piece', plural: 'pieces' },
  clove: { singular: 'clove', plural: 'cloves' },
  egg: { singular: 'egg', plural: 'eggs' },
  can: { singular: 'can', plural: 'cans' },
  jar: { singular: 'jar', plural: 'jars' },
  pack: { singular: 'pack', plural: 'packs' },
  fillet: { singular: 'fillet', plural: 'fillets' },
  slice: { singular: 'slice', plural: 'slices' },
};

const LEGACY_RECIPE_MEASUREMENT_OVERRIDES: Record<string, MeasurementInput> = {
  'rolled oats::1 cup': { value: 90, unit: 'g' },
  'frozen berries::1 cup': { value: 140, unit: 'g' },
  'chia seeds::2 tbsp': { value: 24, unit: 'g' },
  'honey::1 tsp': { value: 5, unit: 'ml' },
  'spinach::2 cups': { value: 60, unit: 'g' },
  'quinoa::1 cup cooked': { value: 185, unit: 'g' },
  'jasmine rice::1 cup cooked': { value: 180, unit: 'g' },
  'rice::1 cup cooked': { value: 180, unit: 'g' },
  'cherry tomatoes::1 cup': { value: 150, unit: 'g' },
  'broccoli::2 cups': { value: 180, unit: 'g' },
  'sesame soy glaze::2 tbsp': { value: 30, unit: 'ml' },
  'black beans::1/2 cup': { value: 120, unit: 'g' },
  'avocado::1/2': { value: 100, unit: 'g' },
  'red lentils::1 cup': { value: 190, unit: 'g' },
  'banana::1': { value: 1, unit: 'piece' },
  'eggs::3': { value: 3, unit: 'egg' },
  'tortilla wrap::1': { value: 1, unit: 'piece' },
  'lemon::1': { value: 1, unit: 'piece' },
  'carrot::2': { value: 2, unit: 'piece' },
};

function normalizeUnit(unit: string) {
  return unit.trim().toLowerCase();
}

function formatNumber(value: number) {
  const rendered =
    value % 1 === 0 ? value.toFixed(0) : value.toFixed(value < 10 ? 2 : 1);
  return rendered.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function legacyMeasurementKey(name: string, quantity: string) {
  return `${name.trim().toLowerCase()}::${quantity.trim().toLowerCase()}`;
}

export function formatMeasurement(measurement: {
  value: number;
  unit: string;
}) {
  const normalizedUnit = normalizeUnit(measurement.unit);

  if (normalizedUnit === 'g' && measurement.value >= 1000) {
    return `${formatNumber(measurement.value / 1000)} kg`;
  }

  if (normalizedUnit === 'ml' && measurement.value >= 1000) {
    return `${formatNumber(measurement.value / 1000)} l`;
  }

  if (normalizedUnit === 'g' || normalizedUnit === 'ml') {
    return `${formatNumber(measurement.value)} ${normalizedUnit}`;
  }

  const labels =
    COUNT_UNIT_LABELS[
    normalizedUnit as Exclude<CanonicalMeasurementUnit, 'g' | 'ml'>
    ];
  if (!labels) {
    return `${formatNumber(measurement.value)} ${measurement.unit}`;
  }

  const label =
    measurement.value === 1 ? labels.singular : labels.plural;
  return `${formatNumber(measurement.value)} ${label}`;
}

export function normalizeMeasurementValue(
  value: number,
  unit: string,
): MeasurementValue {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Measurement value must be a finite number greater than or equal to zero.');
  }

  const alias = EXACT_UNIT_ALIASES[normalizeUnit(unit)];
  if (!alias) {
    throw new Error(`Unsupported measurement unit: ${unit}`);
  }

  if (alias === 'kg') {
    return {
      value: Number((value * 1000).toFixed(2)),
      unit: 'g',
    };
  }

  if (alias === 'l') {
    return {
      value: Number((value * 1000).toFixed(2)),
      unit: 'ml',
    };
  }

  return {
    value: Number(value.toFixed(2)),
    unit: alias as CanonicalMeasurementUnit,
  };
}

export function normalizeOptionalMeasurement(
  quantity?:
    | {
      value: number | null;
      unit: string | null;
    }
    | null,
) {
  if (quantity?.value == null || quantity.unit == null) {
    return {
      value: null,
      unit: null,
    };
  }

  return normalizeMeasurementValue(quantity.value, quantity.unit);
}

export function parseExactMeasurementString(quantity: string) {
  const normalized = quantity.trim();
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/);

  if (!match) {
    return null;
  }

  try {
    return normalizeMeasurementValue(Number(match[1]), match[2]);
  } catch {
    return null;
  }
}

export function deriveRecipeMeasurement(name: string, quantity: string) {
  const exactMeasurement = parseExactMeasurementString(quantity);
  if (exactMeasurement) {
    return exactMeasurement;
  }

  const override = LEGACY_RECIPE_MEASUREMENT_OVERRIDES[
    legacyMeasurementKey(name, quantity)
  ];
  if (!override) {
    throw new Error(
      `Unsupported recipe quantity "${quantity}" for ingredient "${name}".`,
    );
  }

  return normalizeMeasurementValue(override.value, override.unit);
}
