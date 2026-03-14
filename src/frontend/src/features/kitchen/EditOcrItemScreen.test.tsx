import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import EditOcrItemScreen from './EditOcrItemScreen';
import { renderWithProviders } from '../../test/render';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    lineId: 'line-1',
  }),
  useRouter: () => ({
    back: mockBack,
  }),
}));

jest.mock('../../lib/services', () => ({
  kitchenService: {
    getOcrReview: jest.fn(),
    updateOcrLine: jest.fn(),
  },
}));

const { kitchenService } = jest.requireMock('../../lib/services') as {
  kitchenService: {
    getOcrReview: jest.Mock;
    updateOcrLine: jest.Mock;
  };
};

describe('EditOcrItemScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    kitchenService.getOcrReview.mockResolvedValue({
      eventId: 'event-1',
      confidence: 0.92,
      receiptLabel: 'Receipt',
      lines: [
        {
          id: 'line-1',
          rawText: 'Greek Yogurt 500g',
          name: 'Greek yogurt',
          quantityValue: 500,
          quantityUnit: 'g',
          confidence: 0.92,
          accepted: true,
        },
      ],
    });
    kitchenService.updateOcrLine.mockResolvedValue({});
  });

  it('forces unit selection through the picker before saving', async () => {
    renderWithProviders(<EditOcrItemScreen />);

    await waitFor(() => {
      expect(screen.getByText('Save & Apply')).toBeTruthy();
    });

    expect(screen.queryByPlaceholderText('g / kg / ml / l / piece')).toBeNull();
    fireEvent.press(screen.getByText('kg'));
    fireEvent.press(screen.getByText('Save & Apply'));

    await waitFor(() => {
      expect(kitchenService.updateOcrLine).toHaveBeenCalledWith('line-1', {
        accepted: true,
        name: 'Greek yogurt',
        note: '',
        quantityUnit: 'kg',
        quantityValue: 500,
      });
    });
    expect(mockBack).toHaveBeenCalled();
  });
});
