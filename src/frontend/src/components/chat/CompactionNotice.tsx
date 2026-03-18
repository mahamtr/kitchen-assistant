import { useState } from 'react';
import { Pressable } from 'react-native';
import { Paragraph, Text, XStack, YStack } from 'tamagui';
import { AppIcon, palette } from '../ui/primitives';

export function CompactionNotice({
  compactedUserMessageCount,
  compactSummary,
  infoToggleTestId,
  summaryToggleTestId,
  summaryDrawerTestId,
}: {
  compactedUserMessageCount: number;
  compactSummary: string;
  infoToggleTestId: string;
  summaryToggleTestId: string;
  summaryDrawerTestId: string;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  if (!compactedUserMessageCount || !compactSummary.trim()) {
    return null;
  }

  return (
    <YStack gap={8}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <XStack
          flex={1}
          backgroundColor={palette.surfaceSoft}
          borderColor={palette.border}
          borderWidth={1}
          borderRadius={999}
          paddingHorizontal={10}
          paddingVertical={6}
          alignItems="center"
          gap={6}
        >
          <AppIcon name="auto-awesome" size={13} color={palette.textMuted} />
          <Text color={palette.textSecondary} fontSize={11} fontWeight="600">
            Context summarized after {compactedUserMessageCount} user turns.
          </Text>
        </XStack>
        <Pressable testID={infoToggleTestId} onPress={() => setShowInfo((current) => !current)}>
          <AppIcon name="info-outline" size={15} color={palette.textMuted} />
        </Pressable>
      </XStack>

      {showInfo ? (
        <YStack
          backgroundColor={palette.surfaceSoft}
          borderColor={palette.border}
          borderWidth={1}
          borderRadius={8}
          paddingHorizontal={10}
          paddingVertical={8}
        >
          <Paragraph color={palette.textSecondary} fontSize={12} lineHeight={18}>
            Older turns are compacted for privacy and faster responses while recent messages stay visible.
          </Paragraph>
        </YStack>
      ) : null}

      <Pressable testID={summaryToggleTestId} onPress={() => setShowSummary((current) => !current)}>
        <XStack alignItems="center" gap={6}>
          <Text color={palette.primaryStrong} fontSize={12} fontWeight="700">
            {showSummary ? 'Hide compact summary' : 'View compact summary'}
          </Text>
          <AppIcon
            name={showSummary ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
            size={16}
            color={palette.primaryStrong}
          />
        </XStack>
      </Pressable>

      {showSummary ? (
        <YStack
          testID={summaryDrawerTestId}
          backgroundColor={palette.surfaceSoft}
          borderColor={palette.border}
          borderWidth={1}
          borderRadius={8}
          padding={10}
        >
          <Paragraph color={palette.textSecondary} fontSize={12} lineHeight={18}>
            {compactSummary}
          </Paragraph>
        </YStack>
      ) : null}
    </YStack>
  );
}
