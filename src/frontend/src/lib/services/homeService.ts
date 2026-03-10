import { getCurrentPlanTarget, getMockDataSnapshot, getUrgentInventoryItems } from '../mock/mockStore';
import { requireAppUserId, withDelay } from './utils';
import type { HomeTodayResponse } from '../types/contracts';

async function getToday(): Promise<HomeTodayResponse> {
  const userId = requireAppUserId();
  const snapshot = getMockDataSnapshot();
  const currentPlan = snapshot.currentWeeklyPlanByUserId[userId]
    ? snapshot.weeklyPlans[snapshot.currentWeeklyPlanByUserId[userId]]
    : null;

  if (!currentPlan) {
    throw new Error('No weekly plan found.');
  }

  const todayMeals = currentPlan.days.find((day) => day.dayKey === 'mon')?.meals ?? [];
  const urgentItems = getUrgentInventoryItems(userId);
  const lowStockItems = Object.values(snapshot.inventoryItems)
    .filter((item) => item.userId === userId && item.status === 'low_stock')
    .slice(0, 3)
    .map((item) => item.name.toLowerCase());

  return withDelay({
    todayLabel: 'Monday, March 9',
    target: getCurrentPlanTarget(currentPlan),
    todayMeals,
    importantInfo: {
      title: 'Important Information',
      alerts: [
        urgentItems[0]
          ? `${urgentItems[0].name} expires today: use it for lunch or dinner.`
          : 'No urgent items today.',
        lowStockItems.length > 0
          ? `Low stock: ${lowStockItems.join(', ')}.`
          : 'No low stock alerts at the moment.',
      ],
      ctaLabel: 'Open Weekly Plan',
    },
    shortcuts: [
      { label: 'Open Weekly Plan', href: '/planner' },
      { label: 'Open Kitchen', href: '/kitchen/to-buy' },
      { label: 'Browse Recipes', href: '/recipes' },
    ],
  });
}

export const homeService = {
  getToday,
};

export default homeService;
