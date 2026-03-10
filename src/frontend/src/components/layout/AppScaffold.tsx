import type { ComponentProps, ReactNode } from 'react';
import { Platform, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Paragraph, Text, XStack, YStack } from 'tamagui';
import { AppIcon, palette } from '../ui/primitives';
import { useKeyboardMetrics } from '../../hooks/useKeyboardVisible';

export type AppTabKey = 'home' | 'planner' | 'kitchen' | 'recipes';

const TAB_CONFIG: Array<{ key: AppTabKey; label: string; href: string }> = [
  { key: 'home', label: 'Home', href: '/home' },
  { key: 'planner', label: 'Weekly Plan', href: '/planner' },
  { key: 'kitchen', label: 'Kitchen', href: '/kitchen/to-buy' },
  { key: 'recipes', label: 'Recipes', href: '/recipes' },
];

const TAB_ICONS: Record<AppTabKey, ComponentProps<typeof AppIcon>['name']> = {
  home: 'home',
  planner: 'calendar-today',
  kitchen: 'kitchen',
  recipes: 'menu-book',
};

export function AppTabBar({ activeTab }: { activeTab: AppTabKey }) {
  const router = useRouter();

  return (
    <XStack
      borderTopWidth={1}
      borderColor={palette.border}
      backgroundColor={palette.surface}
      paddingHorizontal={20}
      paddingTop={10}
      paddingBottom={20}
      gap={8}
    >
      {TAB_CONFIG.map((tab) => {
        const selected = tab.key === activeTab;
        return (
          <Pressable key={tab.key} onPress={() => router.replace(tab.href)} style={{ flex: 1 }}>
            <YStack
              alignItems="center"
              justifyContent="center"
              gap={3}
              paddingVertical={2}
            >
              <AppIcon
                name={TAB_ICONS[tab.key]}
                size={20}
                color={selected ? palette.primary : palette.textMuted}
              />
              <Text color={selected ? palette.primary : palette.textMuted} fontWeight={selected ? '700' : '400'} fontSize={10}>
                {tab.label}
              </Text>
            </YStack>
          </Pressable>
        );
      })}
    </XStack>
  );
}

export default function AppScaffold({
  title,
  subtitle,
  activeTab,
  children,
  footer,
  headerAccessory,
  compactHeader = false,
}: {
  title: string;
  subtitle: string;
  activeTab: AppTabKey;
  children: ReactNode;
  footer?: ReactNode;
  headerAccessory?: ReactNode;
  compactHeader?: boolean;
}) {
  const { keyboardHeight, keyboardVisible } = useKeyboardMetrics();
  const contentBottomPadding = (footer ? 136 : 32) + (keyboardVisible ? 0 : 84);

  return (
    <YStack flex={1} backgroundColor={palette.background} paddingBottom={keyboardHeight}>
      <YStack paddingHorizontal={20} paddingTop={compactHeader ? 14 : 20} paddingBottom={compactHeader ? 8 : 12} gap={compactHeader ? 4 : 6}>
        <XStack justifyContent="space-between" alignItems="flex-start" gap="$3">
          <YStack flex={1} gap="$2">
            <Text color={palette.text} fontSize={compactHeader ? 28 : 34} lineHeight={compactHeader ? 30 : 36} fontWeight="700">
              {title}
            </Text>
            <Paragraph color={palette.textSecondary} fontSize={compactHeader ? 12 : 14} fontStyle="italic" lineHeight={compactHeader ? 18 : 20}>
              {subtitle}
            </Paragraph>
          </YStack>
          {headerAccessory}
        </XStack>
      </YStack>

      <ScrollView
        style={{ flex: 1 }}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: compactHeader ? 12 : 20,
          paddingBottom: contentBottomPadding,
          gap: compactHeader ? 8 : 10,
        }}
      >
        {children}
      </ScrollView>

      {footer}
      {!keyboardVisible ? <AppTabBar activeTab={activeTab} /> : null}
    </YStack>
  );
}
