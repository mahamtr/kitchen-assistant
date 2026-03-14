const SUPPORTED_EDITABLE_UNITS = [
  'g',
  'kg',
  'ml',
  'l',
  'piece',
  'clove',
  'egg',
  'can',
  'jar',
  'pack',
  'fillet',
  'slice',
] as const;

const COUNT_UNITS = [
  'piece',
  'clove',
  'egg',
  'can',
  'jar',
  'pack',
  'fillet',
  'slice',
] as const;

const COUNT_LABELS: Record<string, { singular: string; plural: string }> = {
  piece: { singular: 'piece', plural: 'pieces' },
  clove: { singular: 'clove', plural: 'cloves' },
  egg: { singular: 'egg', plural: 'eggs' },
  can: { singular: 'can', plural: 'cans' },
  jar: { singular: 'jar', plural: 'jars' },
  pack: { singular: 'pack', plural: 'packs' },
  fillet: { singular: 'fillet', plural: 'fillets' },
  slice: { singular: 'slice', plural: 'slices' },
};

function formatNumber(value: number) {
  const rendered =
    value % 1 === 0 ? value.toFixed(0) : value.toFixed(value < 10 ? 2 : 1);
  return rendered.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

export function isSupportedMeasurementUnit(unit: string) {
  return SUPPORTED_EDITABLE_UNITS.includes(
    unit.trim().toLowerCase() as (typeof SUPPORTED_EDITABLE_UNITS)[number],
  );
}

export function isCountMeasurementUnit(unit: string | null | undefined) {
  return COUNT_UNITS.includes(
    (unit ?? '').trim().toLowerCase() as (typeof COUNT_UNITS)[number],
  );
}

export function normalizeEditableMeasurementUnit(
  unit: string | null | undefined,
  fallback: (typeof SUPPORTED_EDITABLE_UNITS)[number] = 'piece',
) {
  const normalizedUnit = (unit ?? '').trim().toLowerCase();
  return isSupportedMeasurementUnit(normalizedUnit) ? normalizedUnit : fallback;
}

export function formatMeasurement(
  value: number | null | undefined,
  unit: string | null | undefined,
  fallback = '1 piece',
) {
  if (value == null || !unit) {
    return fallback;
  }

  const normalizedUnit = unit.trim().toLowerCase();

  if (normalizedUnit === 'g' && value >= 1000) {
    return `${formatNumber(value / 1000)} kg`;
  }

  if (normalizedUnit === 'ml' && value >= 1000) {
    return `${formatNumber(value / 1000)} l`;
  }

  if (normalizedUnit === 'g' || normalizedUnit === 'ml') {
    return `${formatNumber(value)} ${normalizedUnit}`;
  }

  const labels = COUNT_LABELS[normalizedUnit];
  if (labels) {
    return `${formatNumber(value)} ${
      value === 1 ? labels.singular : labels.plural
    }`;
  }

  return `${formatNumber(value)} ${unit}`;
}

export const supportedMeasurementUnits = SUPPORTED_EDITABLE_UNITS;

export const supportedMeasurementUnitGroups = [
  {
    label: 'Mass',
    units: ['g', 'kg'],
  },
  {
    label: 'Volume',
    units: ['ml', 'l'],
  },
  {
    label: 'Count',
    units: [...COUNT_UNITS],
  },
] as const;
