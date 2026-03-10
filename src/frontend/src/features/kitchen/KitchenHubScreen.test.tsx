import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import KitchenHubScreen from './KitchenHubScreen';
import { renderWithProviders } from '../../test/render';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

jest.mock('../../lib/services', () => ({
  kitchenService: {
    getSummary: jest.fn(),
    getCurrentGroceryList: jest.fn(),
    getInventoryItems: jest.fn(),
    markAllPurchased: jest.fn(),
    markPurchased: jest.fn(),
    markPurchasedBulk: jest.fn(),
    moveLowStockToBuy: jest.fn(),
    moveUrgentToBuy: jest.fn(),
  },
}));

const { kitchenService } = jest.requireMock('../../lib/services') as {
  kitchenService: {
    getSummary: jest.Mock;
    getCurrentGroceryList: jest.Mock;
    getInventoryItems: jest.Mock;
  };
};

describe('KitchenHubScreen navigation', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    kitchenService.getSummary.mockResolvedValue({
      toBuyCount: 12,
      inStockCount: 64,
      expiringCount: 5,
      lowStockCount: 3,
      urgentItems: [],
    });
    kitchenService.getCurrentGroceryList.mockResolvedValue({
      id: 'list-1',
      weeklyPlanId: 'plan-1',
      status: 'active',
      items: [],
    });
    kitchenService.getInventoryItems.mockImplementation(async (view: 'in-stock' | 'expiring') => ({
      total: 1,
      items: [
        {
          id: view === 'expiring' ? 'inventory-2' : 'inventory-1',
          userId: 'user-1',
          name: view === 'expiring' ? 'Spinach' : 'Greek yogurt',
          category: view === 'expiring' ? 'Produce' : 'Dairy',
          location: view === 'expiring' ? 'fridge' : 'fridge',
          quantity: { value: view === 'expiring' ? 1 : 2, unit: view === 'expiring' ? 'bag' : 'tubs' },
          status: view === 'expiring' ? 'use_soon' : 'fresh',
          source: 'kitchen_hub',
          createdAt: '2026-03-10T00:00:00.000Z',
          lastUpdatedAt: '2026-03-10T00:00:00.000Z',
        },
      ],
    }));
  });

  it('switches kitchen views in place and keeps push for item detail substeps', async () => {
    renderWithProviders(<KitchenHubScreen view="in-stock" />);

    await waitFor(() => {
      expect(screen.getByText('Greek yogurt')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Expiring'));

    await waitFor(() => {
      expect(screen.getByText('Spinach')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Spinach'));

    expect(mockReplace).not.toHaveBeenCalled();
    expect(kitchenService.getInventoryItems).toHaveBeenNthCalledWith(1, 'in-stock', '');
    expect(kitchenService.getInventoryItems).toHaveBeenNthCalledWith(2, 'expiring', '');
    expect(mockPush).toHaveBeenCalledWith('/kitchen/item/inventory-2');
  });
});
