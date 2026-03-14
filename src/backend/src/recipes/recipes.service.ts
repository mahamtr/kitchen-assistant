import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuthenticatedUser } from '../common/current-user';
import {
  deriveRecipeMeasurement,
  formatMeasurement,
} from '../common/measurement';
import {
  INVENTORY_EVENT_MODEL,
  INVENTORY_ITEM_MODEL,
  InventoryEventRecord,
  InventoryItemRecord,
  RECIPE_GENERATION_MODEL,
  RECIPE_GENERATION_REVISION_MODEL,
  RECIPE_HISTORY_EVENT_MODEL,
  RECIPE_MODEL,
  RecipeGenerationRecord,
  RecipeGenerationRevisionRecord,
  RecipeHistoryEventRecord,
  RecipeIngredientValue,
  RecipeRecord,
  USER_PREFERENCE_MODEL,
  UserPreferenceRecord,
  WEEKLY_PLAN_MODEL,
  WeeklyPlanRecord,
} from '../data/schemas';
import { UsersService } from '../users/users.service';
import {
  RecipeAiService,
  type RecipePromptInventoryItem,
  type RecipePromptRecipe,
  type RecipeSerializedDraft,
} from './recipe-ai.service';

function estimateMinutes(recipe: RecipeRecord) {
  return Math.max(12, recipe.steps.length * 4 + recipe.ingredients.length);
}

type RecipeScope = 'weekly_planned' | 'favorites' | 'history';

@Injectable()
export class RecipesService {
  constructor(
    @InjectModel(RECIPE_MODEL)
    private readonly recipeModel: Model<RecipeRecord>,
    @InjectModel(RECIPE_GENERATION_MODEL)
    private readonly recipeGenerationModel: Model<RecipeGenerationRecord>,
    @InjectModel(RECIPE_GENERATION_REVISION_MODEL)
    private readonly recipeGenerationRevisionModel: Model<RecipeGenerationRevisionRecord>,
    @InjectModel(RECIPE_HISTORY_EVENT_MODEL)
    private readonly recipeHistoryEventModel: Model<RecipeHistoryEventRecord>,
    @InjectModel(WEEKLY_PLAN_MODEL)
    private readonly weeklyPlanModel: Model<WeeklyPlanRecord>,
    @InjectModel(INVENTORY_EVENT_MODEL)
    private readonly inventoryEventModel: Model<InventoryEventRecord>,
    @InjectModel(INVENTORY_ITEM_MODEL)
    private readonly inventoryItemModel: Model<InventoryItemRecord>,
    @InjectModel(USER_PREFERENCE_MODEL)
    private readonly preferenceModel: Model<UserPreferenceRecord>,
    private readonly usersService: UsersService,
    private readonly recipeAiService: RecipeAiService,
  ) {}

  async listRecipes(
    authUser: AuthenticatedUser,
    scope: RecipeScope,
    search = '',
  ) {
    const user = await this.usersService.ensureUser(authUser);
    await this.backfillRecipeOwnershipForUser(user._id);
    const plan = await this.weeklyPlanModel
      .findOne({ userId: user._id, status: 'active' })
      .sort({ weekStartAt: -1 });

    if (!plan && scope === 'weekly_planned') {
      throw new NotFoundException('No weekly plan found.');
    }

    const historyEvents = await this.recipeHistoryEventModel
      .find({ userId: user._id })
      .sort({ occurredAt: -1 });
    const historyByRecipeId = this.groupHistoryByRecipe(historyEvents);
    const normalizedSearch = search.toLowerCase().trim();
    const weeklyRecipeIds = new Set(
      plan?.days.flatMap((day) =>
        day.meals.map((meal) => meal.recipeId.toString()),
      ) ?? [],
    );
    const recipeIdsForScope =
      scope === 'weekly_planned'
        ? Array.from(weeklyRecipeIds)
        : Array.from(
            new Set(historyEvents.map((event) => event.recipeId.toString())),
          );
    const recipes = await this.recipeModel.find({
      ...(recipeIdsForScope.length > 0
        ? { _id: { $in: recipeIdsForScope } }
        : { userId: user._id }),
      userId: user._id,
    });

    const filtered = recipes
      .filter((recipe) =>
        scope === 'weekly_planned'
          ? weeklyRecipeIds.has(recipe._id.toString())
          : scope === 'favorites'
            ? this.isFavorite(
                historyByRecipeId.get(recipe._id.toString()) ?? [],
              )
            : Boolean(
                this.latestByType(
                  historyByRecipeId.get(recipe._id.toString()) ?? [],
                  ['cooked'],
                ),
              ),
      )
      .filter((recipe) =>
        normalizedSearch
          ? recipe.title.toLowerCase().includes(normalizedSearch)
          : true,
      );

    return {
      scope,
      items: filtered.map((recipe) => ({
        id: recipe._id.toString(),
        title: recipe.title,
        subtitle:
          scope === 'weekly_planned'
            ? 'From weekly plan'
            : scope === 'favorites'
              ? 'Favorite'
              : 'Cooked recently',
        metadata: `${estimateMinutes(recipe)} min • ${recipe.tags?.[0] ?? 'High protein'} • ${
          recipe.summary ?? 'Saved recipe'
        }`,
        usageHint:
          scope === 'history'
            ? 'Cooked recently and available for reruns.'
            : scope === 'favorites'
              ? 'Saved separately from weekly plans.'
              : 'Included in the current weekly plan.',
        relationshipLabel:
          scope === 'history'
            ? 'History item'
            : scope === 'favorites'
              ? 'Favorite'
              : 'Weekly planned',
        isFavorite: this.isFavorite(
          historyByRecipeId.get(recipe._id.toString()) ?? [],
        ),
      })),
    };
  }

  async getRecipe(authUser: AuthenticatedUser, recipeId: string) {
    const user = await this.usersService.ensureUser(authUser);
    const recipe = await this.findOwnedRecipeOrThrow(user._id, recipeId);

    await this.ensureRecipeMeasurements(recipe);

    const historyEvents = await this.recipeHistoryEventModel
      .find({ userId: user._id, recipeId: recipe._id })
      .sort({ occurredAt: -1 });

    return {
      recipe: this.toRecipe(recipe),
      isFavorite: this.isFavorite(historyEvents),
      latestRating: this.latestByType(historyEvents, ['rated'])?.rating ?? null,
      cookedAt:
        this.latestByType(historyEvents, [
          'cooked',
        ])?.occurredAt.toISOString() ?? null,
    };
  }

  async getActiveGeneration(authUser: AuthenticatedUser) {
    const user = await this.usersService.ensureUser(authUser);
    const generation = await this.recipeGenerationModel
      .findOne({ userId: user._id, status: 'active' })
      .sort({ createdAt: -1 });

    if (!generation) {
      return null;
    }

    return this.getGeneration(authUser, generation._id.toString());
  }

  async startGeneration(authUser: AuthenticatedUser, userMessage?: string) {
    const user = await this.usersService.ensureUser(authUser);
    const plan = await this.weeklyPlanModel
      .findOne({ userId: user._id, status: 'active' })
      .sort({ weekStartAt: -1 });
    const trimmedMessage = userMessage?.trim();
    const initialDraft = trimmedMessage
      ? await this.generateRecipeDraftFromAi({
          userId: user._id,
          weeklyPlanId: plan?._id ?? null,
          latestRevision: null,
          userMessage: trimmedMessage,
        })
      : null;

    await this.recipeGenerationModel.updateMany(
      { userId: user._id, status: 'active' },
      { $set: { status: 'discarded' } },
    );

    const generation = await this.recipeGenerationModel.create({
      userId: user._id,
      weeklyPlanId: plan?._id ?? null,
      status: 'active',
      latestRevisionId: null,
      acceptedRecipeId: null,
      contextSnapshot: {
        weeklyPlanId: plan?._id?.toString() ?? null,
      },
    });

    const revision = await this.recipeGenerationRevisionModel.create({
      generationId: generation._id,
      userId: user._id,
      revisionNumber: 1,
      latestOutput: initialDraft,
    });

    generation.latestRevisionId = revision._id;
    await generation.save();

    return {
      generation: this.toGeneration(generation),
      latestRevision: this.toGenerationRevision(revision),
    };
  }

  async getGeneration(authUser: AuthenticatedUser, generationId: string) {
    const user = await this.usersService.ensureUser(authUser);
    const generation = await this.findOwnedGenerationOrThrow(
      user._id,
      generationId,
    );

    const latestRevision = generation.latestRevisionId
      ? await this.recipeGenerationRevisionModel.findOne({
          _id: generation.latestRevisionId,
          generationId: generation._id,
          userId: user._id,
        })
      : await this.recipeGenerationRevisionModel
          .findOne({
            generationId: generation._id,
            userId: user._id,
          })
          .sort({ revisionNumber: -1 });

    if (!latestRevision) {
      throw new NotFoundException('Recipe generation revision not found.');
    }

    return {
      generation: this.toGeneration(generation),
      latestRevision: this.toGenerationRevision(latestRevision),
    };
  }

  async getGenerationRevisions(
    authUser: AuthenticatedUser,
    generationId: string,
  ) {
    const user = await this.usersService.ensureUser(authUser);
    const generation = await this.findOwnedGenerationOrThrow(
      user._id,
      generationId,
    );
    const revisions = await this.recipeGenerationRevisionModel
      .find({ generationId: generation._id, userId: user._id })
      .sort({ revisionNumber: -1 });

    return revisions.map((revision) => ({
      generationId: generation._id.toString(),
      revision: this.toGenerationRevision(revision),
    }));
  }

  async createGenerationRevision(
    authUser: AuthenticatedUser,
    generationId: string,
    userMessage: string,
  ) {
    const user = await this.usersService.ensureUser(authUser);
    const trimmedMessage = userMessage.trim();
    if (!trimmedMessage) {
      throw new BadRequestException('Recipe revision message is required.');
    }

    const generation = await this.findOwnedGenerationOrThrow(
      user._id,
      generationId,
    );

    const latestRevision = await this.recipeGenerationRevisionModel
      .findOne({ generationId: generation._id, userId: user._id })
      .sort({ revisionNumber: -1 });

    if (!latestRevision) {
      throw new NotFoundException('Recipe generation revision not found.');
    }

    const revisionNumber = latestRevision.revisionNumber + 1;
    const nextDraft = await this.generateRecipeDraftFromAi({
      userId: user._id,
      weeklyPlanId: generation.weeklyPlanId ?? null,
      latestRevision,
      userMessage: trimmedMessage,
    });
    const revision = await this.recipeGenerationRevisionModel.create({
      generationId: generation._id,
      userId: user._id,
      revisionNumber,
      latestOutput: nextDraft,
    });

    generation.latestRevisionId = revision._id;
    await generation.save();

    return {
      generationId,
      revision: this.toGenerationRevision(revision),
    };
  }

  async acceptGeneration(
    authUser: AuthenticatedUser,
    generationId: string,
    revisionId: string,
  ) {
    const user = await this.usersService.ensureUser(authUser);
    const generation = await this.findOwnedGenerationOrThrow(
      user._id,
      generationId,
    );
    const revision = await this.recipeGenerationRevisionModel.findOne({
      _id: revisionId,
      generationId: generation._id,
      userId: user._id,
    });

    if (!revision) {
      throw new NotFoundException('Recipe draft not found.');
    }

    if (!revision.latestOutput) {
      throw new BadRequestException(
        'No recipe draft exists for this revision yet.',
      );
    }

    const normalizedIngredients = revision.latestOutput.ingredients.map(
      (ingredient) => this.normalizeRecipeIngredient(ingredient),
    );

    const recipe = await this.recipeModel.create({
      userId: user._id,
      weeklyPlanId: generation.weeklyPlanId ?? null,
      sourceGenerationId: generation._id,
      sourceRevisionId: revision._id,
      title: revision.latestOutput.title,
      summary: revision.latestOutput.summary,
      status: 'published',
      ingredients: normalizedIngredients,
      steps: revision.latestOutput.steps,
      tags: revision.latestOutput.tags,
      isPublic: false,
    });

    generation.status = 'accepted';
    generation.acceptedRecipeId = recipe._id;
    generation.latestRevisionId = revision._id;
    await generation.save();

    await this.recipeHistoryEventModel.create({
      userId: user._id,
      recipeId: recipe._id,
      weeklyPlanId: generation.weeklyPlanId ?? null,
      eventType: 'accepted_draft',
      source: 'ai_chat',
      rating: null,
      feedback: '',
      inventoryEventId: null,
      occurredAt: new Date(),
      metadata: {},
    });

    return this.getRecipe(authUser, recipe._id.toString());
  }

  async setFavorite(
    authUser: AuthenticatedUser,
    recipeId: string,
    isFavorite: boolean,
  ) {
    const user = await this.usersService.ensureUser(authUser);
    const recipe = await this.findOwnedRecipeOrThrow(user._id, recipeId);

    await this.recipeHistoryEventModel.create({
      userId: user._id,
      recipeId: recipe._id,
      weeklyPlanId: recipe.weeklyPlanId ?? null,
      eventType: isFavorite ? 'favorited' : 'unfavorited',
      source: 'recipes',
      rating: null,
      feedback: '',
      inventoryEventId: null,
      occurredAt: new Date(),
      metadata: {},
    });

    return this.getRecipe(authUser, recipeId);
  }

  async cookRecipe(authUser: AuthenticatedUser, recipeId: string) {
    const user = await this.usersService.ensureUser(authUser);
    const recipe = await this.findOwnedRecipeOrThrow(user._id, recipeId);

    const inventoryEvent = await this.inventoryEventModel.create({
      userId: user._id,
      type: 'USE',
      source: 'recipe',
      items: recipe.ingredients.slice(0, 3).map((ingredient) => {
        const normalizedIngredient = this.normalizeRecipeIngredient(ingredient);

        return {
          inventoryItemId: null,
          name: ingredient.name,
          quantityDelta: normalizedIngredient.measurement,
        };
      }),
      weeklyPlanId: recipe.weeklyPlanId ?? null,
      recipeId: recipe._id,
      metadata: {},
      createdAt: new Date(),
    });

    for (const ingredient of recipe.ingredients.slice(0, 3)) {
      const normalizedIngredient = this.normalizeRecipeIngredient(ingredient);
      const inventoryItem = await this.inventoryItemModel.findOne({
        userId: user._id,
        normalizedName: ingredient.name.toLowerCase(),
      });

      if (!inventoryItem) {
        continue;
      }

      if (
        inventoryItem.quantity?.value != null &&
        inventoryItem.quantity.unit != null &&
        inventoryItem.quantity.unit !== normalizedIngredient.measurement.unit
      ) {
        throw new BadRequestException(
          `Cannot deduct incompatible units for ${ingredient.name}.`,
        );
      }

      inventoryItem.quantity = {
        value: Math.max(
          0,
          (inventoryItem.quantity?.value ?? 0) -
            normalizedIngredient.measurement.value,
        ),
        unit:
          inventoryItem.quantity?.unit ?? normalizedIngredient.measurement.unit,
      };
      inventoryItem.lastEventId = inventoryEvent._id;
      inventoryItem.dates = {
        ...(inventoryItem.dates ?? {}),
        lastUsedAt: new Date(),
      };
      await inventoryItem.save();
    }

    await this.recipeHistoryEventModel.create({
      userId: user._id,
      recipeId: recipe._id,
      weeklyPlanId: recipe.weeklyPlanId ?? null,
      eventType: 'cooked',
      source: 'recipes',
      rating: null,
      feedback: '',
      inventoryEventId: inventoryEvent._id,
      occurredAt: new Date(),
      metadata: {},
    });

    return this.getRecipe(authUser, recipeId);
  }

  async rateRecipe(
    authUser: AuthenticatedUser,
    recipeId: string,
    rating: number,
    feedback?: string,
  ) {
    const user = await this.usersService.ensureUser(authUser);
    const recipe = await this.findOwnedRecipeOrThrow(user._id, recipeId);

    await this.recipeHistoryEventModel.create({
      userId: user._id,
      recipeId: recipe._id,
      weeklyPlanId: recipe.weeklyPlanId ?? null,
      eventType: 'rated',
      source: 'recipes',
      rating,
      feedback: feedback ?? '',
      inventoryEventId: null,
      occurredAt: new Date(),
      metadata: {},
    });

    return this.getRecipe(authUser, recipeId);
  }

  private groupHistoryByRecipe(history: RecipeHistoryEventRecord[]) {
    const grouped = new Map<string, RecipeHistoryEventRecord[]>();

    for (const event of history) {
      const key = event.recipeId.toString();
      const current = grouped.get(key) ?? [];
      current.push(event);
      grouped.set(key, current);
    }

    return grouped;
  }

  private latestByType(
    events: RecipeHistoryEventRecord[],
    eventTypes: RecipeHistoryEventRecord['eventType'][],
  ) {
    return events.find((event) => eventTypes.includes(event.eventType)) ?? null;
  }

  private isFavorite(events: RecipeHistoryEventRecord[]) {
    const favoriteEvent = this.latestByType(events, [
      'favorited',
      'unfavorited',
    ]);
    return favoriteEvent?.eventType === 'favorited';
  }

  private toRecipe(recipe: RecipeRecord) {
    return {
      id: recipe._id.toString(),
      weeklyPlanId: recipe.weeklyPlanId?.toString() ?? null,
      sourceGenerationId: recipe.sourceGenerationId?.toString() ?? null,
      sourceRevisionId: recipe.sourceRevisionId?.toString() ?? null,
      title: recipe.title,
      summary: recipe.summary,
      status: recipe.status,
      ingredients: recipe.ingredients.map((ingredient) =>
        this.serializeRecipeIngredient(ingredient),
      ),
      steps: recipe.steps.map((step) => ({
        id: step.id.toString(),
        order: step.order,
        text: step.text,
      })),
      tags: recipe.tags ?? [],
      isPublic: recipe.isPublic,
      createdAt: recipe.createdAt.toISOString(),
      updatedAt: recipe.updatedAt.toISOString(),
    };
  }

  private toGeneration(generation: RecipeGenerationRecord) {
    return {
      id: generation._id.toString(),
      userId: generation.userId.toString(),
      weeklyPlanId: generation.weeklyPlanId?.toString() ?? null,
      status: generation.status,
      latestRevisionId: generation.latestRevisionId?.toString() ?? null,
      acceptedRecipeId: generation.acceptedRecipeId?.toString() ?? null,
      contextSnapshot: generation.contextSnapshot ?? {},
      createdAt: generation.createdAt.toISOString(),
      updatedAt: generation.updatedAt.toISOString(),
    };
  }

  private toGenerationRevision(revision: RecipeGenerationRevisionRecord) {
    return {
      id: revision._id.toString(),
      generationId: revision.generationId.toString(),
      userId: revision.userId.toString(),
      revisionNumber: revision.revisionNumber,
      chat: (revision.chat ?? []).map((entry) => ({
        id: entry._id?.toString() ?? '',
        role: entry.role,
        content: entry.content,
        timestamp: entry.timestamp.toISOString(),
      })),
      latestOutput: revision.latestOutput
        ? {
            title: revision.latestOutput.title,
            summary: revision.latestOutput.summary,
            metadata: revision.latestOutput.metadata,
            ingredients: revision.latestOutput.ingredients.map((ingredient) =>
              this.serializeRecipeIngredient(ingredient),
            ),
            steps: revision.latestOutput.steps.map((step) => ({
              id: step.id.toString(),
              order: step.order,
              text: step.text,
            })),
            tags: revision.latestOutput.tags,
          }
        : null,
      createdAt: revision.createdAt.toISOString(),
      updatedAt: revision.updatedAt.toISOString(),
    };
  }

  private normalizeRecipeIngredient(ingredient: RecipeIngredientValue) {
    const measurement =
      ingredient.measurement ??
      deriveRecipeMeasurement(ingredient.name, ingredient.quantity);

    return {
      id: ingredient.id,
      name: ingredient.name,
      quantity: formatMeasurement(measurement),
      measurement,
      note: ingredient.note,
    } satisfies RecipeIngredientValue;
  }

  private serializeRecipeIngredient(ingredient: RecipeIngredientValue) {
    const normalized = this.normalizeRecipeIngredient(ingredient);

    return {
      id: normalized.id.toString(),
      name: normalized.name,
      quantity: normalized.quantity,
      measurement: normalized.measurement,
      note: normalized.note,
    };
  }

  private async ensureRecipeMeasurements(recipe: RecipeRecord) {
    let changed = false;

    recipe.ingredients = recipe.ingredients.map((ingredient) => {
      const normalized = this.normalizeRecipeIngredient(ingredient);

      if (
        !ingredient.measurement ||
        ingredient.measurement.value !== normalized.measurement.value ||
        ingredient.measurement.unit !== normalized.measurement.unit ||
        ingredient.quantity !== normalized.quantity
      ) {
        changed = true;
      }

      return normalized;
    });

    const save = (recipe as { save?: () => Promise<unknown> }).save;
    if (changed && typeof save === 'function') {
      await save.call(recipe);
    }
  }

  private async backfillRecipeOwnershipForUser(userId: RecipeGenerationRecord['userId']) {
    const [plans, generations] = await Promise.all([
      this.weeklyPlanModel.find({ userId }).select('_id'),
      this.recipeGenerationModel.find({ userId }).select('_id'),
    ]);
    const planIds = plans.map((plan) => plan._id);
    const generationIds = generations.map((generation) => generation._id);

    if (planIds.length > 0) {
      await this.recipeModel.updateMany(
        {
          userId: null,
          weeklyPlanId: { $in: planIds },
        },
        {
          $set: {
            userId,
          },
        },
      );
    }

    if (generationIds.length > 0) {
      await this.recipeModel.updateMany(
        {
          userId: null,
          sourceGenerationId: { $in: generationIds },
        },
        {
          $set: {
            userId,
          },
        },
      );
    }
  }

  private async findOwnedRecipeOrThrow(
    userId: RecipeGenerationRecord['userId'],
    recipeId: string,
  ) {
    await this.backfillRecipeOwnershipForUser(userId);
    const recipe = await this.recipeModel.findOne({
      _id: recipeId,
      userId,
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found.');
    }

    return recipe;
  }

  private async findOwnedGenerationOrThrow(
    userId: RecipeGenerationRecord['userId'],
    generationId: string,
  ) {
    const generation = await this.recipeGenerationModel.findOne({
      _id: generationId,
      userId,
    });

    if (!generation) {
      throw new NotFoundException('Recipe generation not found.');
    }

    return generation;
  }

  private async generateRecipeDraftFromAi(params: {
    userId: RecipeGenerationRecord['userId'];
    weeklyPlanId?: RecipeGenerationRecord['weeklyPlanId'] | null;
    latestRevision: RecipeGenerationRevisionRecord | null;
    userMessage: string;
  }) {
    const context = await this.buildRecipeAiContext(params);

    if (params.latestRevision?.latestOutput) {
      return this.recipeAiService.reviseDraft(context);
    }

    return this.recipeAiService.generateDraft(context);
  }

  private async buildRecipeAiContext(params: {
    userId: RecipeGenerationRecord['userId'];
    weeklyPlanId?: RecipeGenerationRecord['weeklyPlanId'] | null;
    latestRevision: RecipeGenerationRevisionRecord | null;
    userMessage: string;
  }) {
    const [preference, plan, historyEvents, inventoryItems] = await Promise.all([
      this.preferenceModel.findOne({ userId: params.userId }),
      params.weeklyPlanId
        ? this.weeklyPlanModel.findOne({
            _id: params.weeklyPlanId,
            userId: params.userId,
          })
        : Promise.resolve(null),
      this.recipeHistoryEventModel
        .find({ userId: params.userId })
        .sort({ occurredAt: -1 }),
      this.inventoryItemModel.find({ userId: params.userId }),
    ]);

    const historyByRecipeId = this.groupHistoryByRecipe(historyEvents);
    const planRecipeIds = this.uniqueRecipeIdsFromPlan(plan);
    const favoriteRecipeIds = Array.from(historyByRecipeId.entries())
      .filter(([, events]) => this.isFavorite(events))
      .map(([recipeId]) => recipeId)
      .slice(0, 6);
    const recentRecipeIds = Array.from(historyByRecipeId.entries())
      .filter(([, events]) =>
        Boolean(this.latestByType(events, ['cooked', 'accepted_draft'])),
      )
      .map(([recipeId]) => recipeId)
      .slice(0, 6);

    const contextualRecipeIds = Array.from(
      new Set([...planRecipeIds, ...favoriteRecipeIds, ...recentRecipeIds]),
    );
    const contextualRecipes: RecipeRecord[] =
      contextualRecipeIds.length > 0
        ? ((await this.recipeModel.find({
            _id: { $in: contextualRecipeIds },
            userId: params.userId,
          })) as RecipeRecord[])
        : [];
    const recipeById = new Map(
      contextualRecipes.map((recipe) => [recipe._id.toString(), recipe]),
    );

    return {
      preferences: preference?.profile ?? null,
      weeklyPlanRecipes: this.buildPromptRecipeList(planRecipeIds, recipeById),
      favoriteRecipes: this.buildPromptRecipeList(favoriteRecipeIds, recipeById),
      recentRecipes: this.buildPromptRecipeList(recentRecipeIds, recipeById),
      inventoryItems: inventoryItems
        .filter(
          (item) =>
            item.status !== 'expired' &&
            item.quantity?.value != null &&
            item.quantity.unit != null &&
            item.quantity.value > 0,
        )
        .sort((left, right) => left.name.localeCompare(right.name))
        .slice(0, 20)
        .map((item) => this.toPromptInventoryItem(item)),
      currentDraft: params.latestRevision?.latestOutput
        ? this.serializeDraftForAi(params.latestRevision.latestOutput)
        : null,
      chat: [],
      userMessage: params.userMessage,
    };
  }

  private uniqueRecipeIdsFromPlan(plan: WeeklyPlanRecord | null) {
    return Array.from(
      new Set(
        plan?.days.flatMap((day) =>
          day.meals.map((meal) => meal.recipeId.toString()),
        ) ?? [],
      ),
    );
  }

  private toPromptRecipe(recipe: RecipeRecord): RecipePromptRecipe {
    return {
      title: recipe.title,
      summary: recipe.summary ?? 'Saved recipe',
      readyInMinutes: estimateMinutes(recipe),
      tags: recipe.tags ?? [],
      ingredients: recipe.ingredients.map((ingredient) =>
        this.toPromptIngredientLabel(ingredient),
      ),
    };
  }

  private buildPromptRecipeList(
    recipeIds: string[],
    recipeById: Map<string, RecipeRecord>,
  ) {
    return recipeIds.reduce<RecipePromptRecipe[]>((items, recipeId) => {
      const recipe = recipeById.get(recipeId);
      if (!recipe) {
        return items;
      }

      items.push(this.toPromptRecipe(recipe));
      return items;
    }, []);
  }

  private toPromptIngredientLabel(ingredient: RecipeIngredientValue) {
    try {
      const normalized = this.normalizeRecipeIngredient(ingredient);
      return `${normalized.quantity} ${normalized.name}`;
    } catch {
      return ingredient.quantity
        ? `${ingredient.quantity} ${ingredient.name}`
        : ingredient.name;
    }
  }

  private toPromptInventoryItem(
    item: InventoryItemRecord,
  ): RecipePromptInventoryItem {
    return {
      name: item.name,
      quantity: {
        value: item.quantity?.value ?? 0,
        unit: item.quantity?.unit ?? 'piece',
      },
      quantityLabel:
        item.quantity?.value != null && item.quantity.unit != null
          ? formatMeasurement({
              value: item.quantity.value,
              unit: item.quantity.unit,
            })
          : 'Unknown quantity',
      location: item.location,
      status: item.status,
    };
  }

  private serializeDraftForAi(
    draft: NonNullable<RecipeGenerationRevisionRecord['latestOutput']>,
  ): RecipeSerializedDraft {
    return {
      title: draft.title,
      summary: draft.summary,
      metadata: {
        readyInMinutes: draft.metadata.readyInMinutes,
        calories: draft.metadata.calories,
        highlight: draft.metadata.highlight,
      },
      ingredients: draft.ingredients.map((ingredient) => {
        const normalized = this.normalizeRecipeIngredient(ingredient);
        return {
          name: normalized.name,
          quantity: normalized.quantity,
          measurement: normalized.measurement,
          note: normalized.note ?? null,
        };
      }),
      steps: draft.steps.map((step) => ({
        order: step.order,
        text: step.text,
      })),
      tags: draft.tags ?? [],
    };
  }

}
