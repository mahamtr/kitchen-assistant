import {
  deriveRecipeMeasurement,
  formatMeasurement,
  normalizeMeasurementValue,
} from './measurement';

describe('measurement helpers', () => {
  it('normalizes kg and l into canonical storage units', () => {
    expect(normalizeMeasurementValue(1.5, 'kg')).toEqual({
      value: 1500,
      unit: 'g',
    });
    expect(normalizeMeasurementValue(2, 'l')).toEqual({
      value: 2000,
      unit: 'ml',
    });
  });

  it('keeps exact count units', () => {
    expect(normalizeMeasurementValue(3, 'cloves')).toEqual({
      value: 3,
      unit: 'clove',
    });
    expect(formatMeasurement({ value: 2, unit: 'egg' })).toBe('2 eggs');
  });

  it('rejects unsupported units', () => {
    expect(() => normalizeMeasurementValue(1, 'cup')).toThrow(
      'Unsupported measurement unit: cup',
    );
  });

  it('derives curated recipe measurements for legacy seed strings', () => {
    expect(deriveRecipeMeasurement('Spinach', '2 cups')).toEqual({
      value: 60,
      unit: 'g',
    });
    expect(deriveRecipeMeasurement('Crushed tomatoes', '1 can')).toEqual({
      value: 1,
      unit: 'can',
    });
  });
});
