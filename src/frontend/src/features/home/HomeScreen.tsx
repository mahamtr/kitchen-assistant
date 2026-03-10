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
              {data.todayMeals.map((meal, index) => (
                <YStack key={meal.slot}>
                  {index > 0 ? <Divider /> : null}
                  <Pressable onPress={() => router.push(`/recipes/${meal.recipeId}`)}>
                    <XStack justifyContent="space-between" alignItems="center" paddingVertical={12} gap={12}>
                      <Text color={palette.text} fontSize={14} fontWeight="600">
                        {meal.slot[0].toUpperCase() + meal.slot.slice(1)}
                      </Text>
                      <Text color={palette.primary} fontSize={13} fontWeight="700" textAlign="right" flex={1}>
                        {meal.title}
                      </Text>
                    </XStack>
                  </Pressable>
                </YStack>
              ))}
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
