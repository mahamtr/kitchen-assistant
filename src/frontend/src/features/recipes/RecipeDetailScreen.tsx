import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Paragraph, Text, XStack, YStack } from 'tamagui';
import AppScaffold from '../../components/layout/AppScaffold';
import {
  ActionButton,
  AppIcon,
  PillBadge,
  SectionCard,
  StickyFooter,
  palette,
} from '../../components/ui/primitives';
import { recipesService } from '../../lib/services';
import { useUiStore } from '../../lib/store/uiStore';
import type { RecipeDetailResponse } from '../../lib/types/contracts';

function estimateMinutes(detail: RecipeDetailResponse) {
  return Math.max(12, detail.recipe.steps.length * 4 + detail.recipe.ingredients.length);
}

export default function RecipeDetailScreen() {
  const router = useRouter();
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const pushToast = useUiStore((state) => state.pushToast);
  const [detail, setDetail] = useState<RecipeDetailResponse | null>(null);
  const [favoriteWorking, setFavoriteWorking] = useState(false);
  const [ratingWorking, setRatingWorking] = useState(false);

  const load = async () => {
    setDetail(await recipesService.getRecipe(recipeId));
  };

  useEffect(() => {
    void load();
  }, [recipeId]);

  return (
    <AppScaffold
      title="Recipe Detail"
      subtitle="Ingredients, steps, and cook tracking"
      activeTab="recipes"
      footer={
        detail ? (
          <StickyFooter>
            <XStack gap={10}>
              <ActionButton
                variant="success"
                fullWidth
                onPress={async () => {
                  const nextDetail = await recipesService.cookRecipe(detail.recipe.id);
                  setDetail(nextDetail);
                  pushToast({
                    title: 'Recipe cooked',
                    description: `${detail.recipe.title} created a recipe history event and inventory usage.`,
                    tone: 'success',
                  });
                }}
              >
                Mark as Cooked
              </ActionButton>
              <ActionButton variant="secondary" fullWidth onPress={() => router.replace('/recipes')}>
                Back to Recipes
              </ActionButton>
            </XStack>
          </StickyFooter>
        ) : undefined
      }
    >
      {detail ? (
        <>
          <SectionCard>
            <XStack justifyContent="space-between" alignItems="flex-start" gap={10}>
              <Text color={palette.textStrong} fontSize={20} fontWeight="700" flex={1}>
                {detail.recipe.title}
              </Text>
              <Text color={palette.primary} fontSize={12} fontWeight="700">
                {estimateMinutes(detail)}m
              </Text>
            </XStack>
            <Paragraph color={palette.textSecondary} fontSize={13}>
              {detail.recipe.weeklyPlanId ? 'Weekly planned' : 'Saved recipe'} • Serves 2 •{' '}
              {detail.recipe.tags?.[0] ?? 'High protein'}
            </Paragraph>
          </SectionCard>

          <SectionCard>
            <Text color={palette.text} fontSize={16} fontWeight="700">
              Ingredients needed
            </Text>
            <YStack gap={6}>
              {detail.recipe.ingredients.map((ingredient) => (
                <XStack key={ingredient.id} justifyContent="space-between" alignItems="center" gap={12}>
                  <Text color={palette.text} fontSize={13} fontWeight="600" flex={1}>
                    {ingredient.name}
                  </Text>
                  <Text color={palette.textStrong} fontSize={13} fontWeight="700">
                    {ingredient.quantity}
                  </Text>
                </XStack>
              ))}
            </YStack>
            <Text color={palette.success} fontSize={13} fontWeight="700">
              Kitchen inventory updates after cooking.
            </Text>
          </SectionCard>

          <SectionCard>
            <Text color={palette.text} fontSize={16} fontWeight="700">
              Cooking steps
            </Text>
            <YStack gap={6}>
              {detail.recipe.steps.map((step) => (
                <Paragraph key={step.id} color={palette.textStrong} fontSize={13} lineHeight={18}>
                  {step.order}. {step.text}
                </Paragraph>
              ))}
            </YStack>
          </SectionCard>

          <SectionCard tone="accent">
            <Text color={palette.primaryStrong} fontSize={13} fontWeight="700">
              Marking this as cooked will deduct ingredient quantities from Kitchen inventory.
            </Text>
          </SectionCard>

          <SectionCard>
            <Text color={palette.text} fontSize={15} fontWeight="700">
              Favorite
            </Text>
            <Paragraph color={palette.textSecondary} fontSize={13} lineHeight={18}>
              Save this recipe separately so it shows up in your Favorites list.
            </Paragraph>
            <ActionButton
              variant={detail.isFavorite ? 'secondary' : 'primary'}
              onPress={async () => {
                setFavoriteWorking(true);
                try {
                  const nextDetail = await recipesService.setFavorite(detail.recipe.id, !detail.isFavorite);
                  setDetail(nextDetail);
                  pushToast({
                    title: nextDetail.isFavorite ? 'Added to favorites' : 'Removed from favorites',
                    description: nextDetail.recipe.title,
                    tone: 'success',
                  });
                } finally {
                  setFavoriteWorking(false);
                }
              }}
              disabled={favoriteWorking}
            >
              {favoriteWorking
                ? 'Saving...'
                : detail.isFavorite
                  ? 'Remove from Favorites'
                  : 'Save to Favorites'}
            </ActionButton>
          </SectionCard>

          <SectionCard>
            <Text color={palette.text} fontSize={15} fontWeight="700">
              Recipe feedback
            </Text>
            <Paragraph color={palette.textSecondary} fontSize={13} lineHeight={18}>
              {detail.latestRating
                ? `Current rating: ${detail.latestRating} / 5. Tap a different score anytime.`
                : 'Rate this recipe after cooking or reviewing it. You can change the score later.'}
            </Paragraph>
            <XStack gap={8} flexWrap="wrap">
              {[1, 2, 3, 4, 5].map((rating) => (
                <Pressable
                  key={rating}
                  accessibilityRole="button"
                  onPress={async () => {
                    setRatingWorking(true);
                    try {
                      const nextDetail = await recipesService.rateRecipe(detail.recipe.id, { rating });
                      setDetail(nextDetail);
                      pushToast({
                        title: `Recipe rated ${rating}/5`,
                        description: detail.recipe.title,
                        tone: 'success',
                      });
                    } finally {
                      setRatingWorking(false);
                    }
                  }}
                  disabled={ratingWorking}
                >
                  <YStack
                    width={52}
                    height={52}
                    alignItems="center"
                    justifyContent="center"
                    gap={4}
                    borderRadius={10}
                    borderWidth={1}
                    borderColor={detail.latestRating === rating ? palette.primaryBorder : palette.border}
                    backgroundColor={detail.latestRating === rating ? palette.primarySoft : palette.surfaceSoft}
                    opacity={ratingWorking ? 0.7 : 1}
                  >
                    <AppIcon
                      name={detail.latestRating != null && rating <= detail.latestRating ? 'star' : 'star-border'}
                      size={18}
                      color={detail.latestRating != null && rating <= detail.latestRating ? palette.warning : palette.textMuted}
                    />
                    <Text color={detail.latestRating === rating ? palette.primaryStrong : palette.textSecondary} fontSize={12} fontWeight="700">
                      {rating}
                    </Text>
                  </YStack>
                </Pressable>
              ))}
            </XStack>
            {ratingWorking ? (
              <Text color={palette.textMuted} fontSize={12} fontWeight="700">
                Saving feedback...
              </Text>
            ) : null}
          </SectionCard>
        </>
      ) : (
        <SectionCard>
          <Text color={palette.text} fontSize={14} fontWeight="700">
            Loading recipe detail...
          </Text>
        </SectionCard>
      )}
    </AppScaffold>
  );
}
