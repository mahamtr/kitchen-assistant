import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/current-user';
import { InventoryService } from '../inventory/inventory.service';
import { PlannerService } from '../planner/planner.service';

type HomeMeal = {
  slot: string;
  recipeId: string;
  title: string;
  shortLabel: string;
  calories: number;
  tags: string[];
};

@Injectable()
export class HomeService {
  constructor(
    private readonly plannerService: PlannerService,
    private readonly inventoryService: InventoryService,
  ) {}

  async getToday(authUser: AuthenticatedUser) {
    const [plan, summary] = await Promise.all([
      this.plannerService.getCurrentPlan(authUser),
      this.inventoryService.getSummary(authUser),
    ]);

    const today = new Date();
    const weekday = today
      .toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
      .toLowerCase()
      .slice(0, 3);
    const todayMeals = this.normalizeMeals(
      plan.days.find((day: (typeof plan.days)[number]) => day.dayKey === weekday)
        ?.meals ??
        plan.days[0]?.meals ??
        [],
    );

    const alerts = [];
    if (summary.urgentItems[0]) {
      alerts.push(
        `${summary.urgentItems[0].name} expires today or soon. Use it for lunch or dinner.`,
      );
    } else {
      alerts.push('No urgent items today.');
    }

    if (summary.lowStockCount > 0) {
      alerts.push(
        `Low stock items: ${summary.lowStockCount}. Add them to To Buy soon.`,
      );
    } else {
      alerts.push('No low stock alerts at the moment.');
    }

    return {
      todayLabel: new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(today),
      target: plan.target,
      todayMeals,
      importantInfo: {
        title: 'Important Information',
        alerts,
        ctaLabel: 'Open Weekly Plan',
      },
      shortcuts: [
        { label: 'Open Weekly Plan', href: '/planner' },
        { label: 'Open Kitchen', href: '/kitchen/to-buy' },
        { label: 'Browse Recipes', href: '/recipes' },
      ],
    };
  }

  private normalizeMeals(
    meals: Array<Record<string, unknown> | null | undefined>,
  ): HomeMeal[] {
    return meals.flatMap((meal) => {
      if (
        !meal ||
        typeof meal.slot !== 'string' ||
        meal.slot.length === 0 ||
        typeof meal.recipeId !== 'string' ||
        meal.recipeId.length === 0 ||
        typeof meal.title !== 'string' ||
        meal.title.length === 0
      ) {
        return [];
      }

      return [
        {
          slot: meal.slot,
          recipeId: meal.recipeId,
          title: meal.title,
          shortLabel:
            typeof meal.shortLabel === 'string' && meal.shortLabel.length > 0
              ? meal.shortLabel
              : meal.title,
          calories: typeof meal.calories === 'number' ? meal.calories : 0,
          tags: Array.isArray(meal.tags)
            ? meal.tags.filter((tag): tag is string => typeof tag === 'string')
            : [],
        },
      ];
    });
  }
}
