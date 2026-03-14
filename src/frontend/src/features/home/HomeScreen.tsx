import { Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Paragraph, Text, XStack, YStack } from 'tamagui';
import AppScaffold from '../../components/layout/AppScaffold';
import {
  ActionButton,
  PillBadge,
  SectionCard,
  SectionHeading,
  StickyFooter,
  palette,
} from '../../components/ui/primitives';
import { authService, homeService } from '../../lib/services';
import type { HomeTodayResponse } from '../../lib/types/contracts';

function Divider() {
  return <YStack height={1} backgroundColor={palette.border} />;
}

function formatMealSlot(slot: string | undefined, index: number) {
  if (typeof slot !== 'string' || slot.length === 0) {
    return `Meal ${index + 1}`;
  }

  return slot[0].toUpperCase() + slot.slice(1);
}

export default function HomeScreen() {
  const router = useRouter();
  const [data, setData] = useState<HomeTodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setData(await homeService.getToday());
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to load Home.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const todayMeals = data?.todayMeals ?? [];

  return (
    <AppScaffold
      title="Home"
      subtitle="Today's plan, recipes, and key reminders"
      activeTab="home"
      headerAccessory={
        <ActionButton
          variant="ghost"
          size="sm"
          onPress={async () => {
            await authService.signOut();
            router.replace('/login');
          }}
        >
          Sign out
        </ActionButton>
      }
      footer={
        data ? (
          <StickyFooter>
            <ActionButton onPress={() => router.replace('/planner')}>{data.importantInfo.ctaLabel}</ActionButton>
          </StickyFooter>
        ) : undefined
      }
    >
      {loading ? (
        <SectionCard>
          <Text color={palette.text} fontSize={14} fontWeight="700">
            Loading Home...
          </Text>
        </SectionCard>
      ) : error ? (
        <SectionCard tone="danger">
          <Text color={palette.danger} fontSize={14} fontWeight="700">
            {error}
          </Text>
        </SectionCard>
      ) : data ? (
        <>
          <SectionCard>
            <SectionHeading title="Today's Plan" subtitle={data.todayLabel} />
            <XStack alignItems="flex-end" gap={12}>
              <YStack flex={1} gap={2}>
                <Text color={palette.textStrong} fontSize={30} fontWeight="700">
                  {data.target.calories}
                </Text>
                <Paragraph color={palette.textMuted} fontSize={12}>
                  Daily calorie target
                </Paragraph>
              </YStack>
              <YStack flex={1} gap={2}>
                <Text color={palette.primary} fontSize={18} fontWeight="700">
                  {data.target.macros}
                </Text>
                <Paragraph color={palette.textMuted} fontSize={12}>
                  Macros
                </Paragraph>
              </YStack>
            </XStack>
          </SectionCard>

          <SectionCard>
            <SectionHeading
              title="Today's Recipes"
              accessory={<PillBadge label="tap a meal" tone="success" />}
            />
            <YStack gap={0}>
              {todayMeals.length === 0 ? (
                <Paragraph color={palette.textSecondary} fontSize={13} lineHeight={18}>
                  No meals planned for today yet.
                </Paragraph>
              ) : (
                todayMeals.map((meal, index) => {
                  const slotLabel = formatMealSlot(meal.slot, index);
                  const recipeId =
                    typeof meal.recipeId === 'string' ? meal.recipeId : '';
                  const title =
                    typeof meal.title === 'string' && meal.title.length > 0
                      ? meal.title
                      : 'Untitled recipe';
                  const canOpenRecipe = recipeId.length > 0;

                  return (
                    <YStack key={`${meal.slot ?? 'meal'}-${recipeId || index}`}>
                      {index > 0 ? <Divider /> : null}
                      <Pressable
                        disabled={!canOpenRecipe}
                        onPress={() => {
                          if (canOpenRecipe) {
                            router.push(`/recipes/${recipeId}`);
                          }
                        }}
                      >
                        <XStack justifyContent="space-between" alignItems="center" paddingVertical={12} gap={12}>
                          <Text color={palette.text} fontSize={14} fontWeight="600">
                            {slotLabel}
                          </Text>
                          <Text
                            color={canOpenRecipe ? palette.primary : palette.textSecondary}
                            fontSize={13}
                            fontWeight="700"
                            textAlign="right"
                            flex={1}
                          >
                            {title}
                          </Text>
                        </XStack>
                      </Pressable>
                    </YStack>
                  );
                })
              )}
            </YStack>
          </SectionCard>

          <SectionCard tone="warning">
            <Text color={palette.text} fontSize={16} fontWeight="700">
              {data.importantInfo.title}
            </Text>
            <YStack gap={4}>
              {data.importantInfo.alerts.map((alert) => (
                <Paragraph key={alert} color={palette.textSecondary} fontSize={13} lineHeight={18}>
                  {alert}
                </Paragraph>
              ))}
            </YStack>
          </SectionCard>
        </>
      ) : null}
    </AppScaffold>
  );
}
