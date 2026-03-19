import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import KitchenItemScreen from './KitchenItemScreen';
import { renderWithProviders } from '../../test/render';

const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    itemId: 'inventory-1',
  }),
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
  }),
}));

jest.mock('../../lib/services', () => ({
  kitchenService: {
    discardItem: jest.fn(),
    getInventoryItem: jest.fn(),
    getInventoryItems: jest.fn(),
    patchInventoryItem: jest.fn(),
  },
}));

const { kitchenService } = jest.requireMock('../../lib/services') as {
  kitchenService: {
    discardItem: jest.Mock;
    getInventoryItem: jest.Mock;
    getInventoryItems: jest.Mock;
    patchInventoryItem: jest.Mock;
  };
};

describe('KitchenItemScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockReplace.mockClear();
    kitchenService.getInventoryItem.mockResolvedValue({
      item: {
        id: 'inventory-1',
        userId: 'user-1',
        name: 'Greek yogurt',
        category: 'Dairy',
        location: 'fridge',
        quantity: { value: 1500, unit: 'g' },
        freshnessState: 'fresh',
        replenishmentState: 'in_stock',
        source: 'manual',
        createdAt: '2026-03-10T00:00:00.000Z',
        lastUpdatedAt: '2026-03-10T00:00:00.000Z',
      },
      recentEvents: [],
    });
    kitchenService.getInventoryItems.mockResolvedValue({
      total: 1,
      items: [
        {
          id: 'inventory-1',
          userId: 'user-1',
          name: 'Greek yogurt',
          category: 'Dairy',
          location: 'fridge',
          quantity: { value: 1500, unit: 'g' },
          freshnessState: 'fresh',
          replenishmentState: 'in_stock',
          source: 'manual',
          createdAt: '2026-03-10T00:00:00.000Z',
          lastUpdatedAt: '2026-03-10T00:00:00.000Z',
        },
      ],
    });
    kitchenService.patchInventoryItem.mockResolvedValue({});
  });

  it('uses a grouped dropdown for inventory units and excludes egg and slice', async () => {
    renderWithProviders(<KitchenItemScreen />);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeTruthy();
    });

    expect(screen.queryByPlaceholderText('g / kg / ml / l / piece')).toBeNull();

    fireEvent.changeText(screen.getByDisplayValue('1500'), '1.5');
    fireEvent.press(screen.getByLabelText('Inventory unit dropdown'));

    expect(screen.getByText('Mass')).toBeTruthy();
    expect(screen.getByText('Volume')).toBeTruthy();
    expect(screen.getByText('Count')).toBeTruthy();
    expect(screen.queryByText('egg')).toBeNull();
    expect(screen.queryByText('slice')).toBeNull();

    fireEvent.press(screen.getByLabelText('Select unit kg'));
    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(kitchenService.patchInventoryItem).toHaveBeenCalledWith('inventory-1', {
        location: 'fridge',
        quantity: {
          unit: 'kg',
          value: 1.5,
        },
        freshnessState: 'fresh',
        reorderPoint: 1,
        targetOnHand: null,
        dates: {
          expiresAt: null,
        },
      });
    });

    expect(mockBack).toHaveBeenCalled();
  });
});
