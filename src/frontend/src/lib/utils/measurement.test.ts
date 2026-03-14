import {
  formatMeasurement,
  isSupportedMeasurementUnit,
} from './measurement';

describe('measurement utils', () => {
  it('formats canonical metric quantities with kg and l thresholds', () => {
    expect(formatMeasurement(1500, 'g')).toBe('1.5 kg');
    expect(formatMeasurement(2000, 'ml')).toBe('2 l');
    expect(formatMeasurement(180, 'g')).toBe('180 g');
  });

  it('formats count units and validates supported units', () => {
    expect(formatMeasurement(3, 'clove')).toBe('3 cloves');
    expect(formatMeasurement(1, 'piece')).toBe('1 piece');
    expect(isSupportedMeasurementUnit('kg')).toBe(true);
    expect(isSupportedMeasurementUnit('cup')).toBe(false);
  });
});
