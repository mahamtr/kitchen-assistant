import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Paragraph, Text, XStack, YStack } from 'tamagui';
import AppScaffold from '../../components/layout/AppScaffold';
import {
  ActionButton,
  AppIcon,
  SectionCard,
  StickyFooter,
  TextField,
  palette,
} from '../../components/ui/primitives';
import { plannerService } from '../../lib/services';
import { useUiStore } from '../../lib/store/uiStore';
import type { WeeklyPlanRevisionResponse } from '../../lib/types/contracts';

function Divider() {
  return <YStack height={1} backgroundColor={palette.border} />;
}

export default function PlannerChatScreen() {
  const router = useRouter();
  const pushToast = useUiStore((state) => state.pushToast);
  const [revision, setRevision] = useState<WeeklyPlanRevisionResponse | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCompactionInfo, setShowCompactionInfo] = useState(false);
  const [showCompactSummary, setShowCompactSummary] = useState(false);

  const load = async () => {
    try {
      setRevision(await plannerService.getLatestRevision());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load planner chat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createRevision = async () => {
    setWorking(true);
    setError(null);
    try {
      const nextRevision = await plannerService.createRevision({ userMessage: message });
      setRevision(nextRevision);
      pushToast({
        title: 'Revision created',
        description: 'The planner draft was refreshed with your latest note.',
        tone: 'success',
      });
      setMessage('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to create revision.');
    } finally {
      setWorking(false);
    }
  };

  const acceptRevision = async () => {
    if (!revision) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await plannerService.acceptRevision(revision.id);
      pushToast({
        title: 'Plan updated',
        description: 'The accepted revision is now the active weekly plan.',
        tone: 'success',
      });
      router.replace('/planner');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to accept revision.');
    } finally {
      setWorking(false);
    }
  };

  const chatMessages = useMemo(() => revision?.chat.slice(-3) ?? [], [revision]);
  const compactedUserMessageCount = revision?.compactedUserMessageCount ?? 0;
  const compactSummary = revision?.conversationSummary?.trim() ?? '';
  const hasCompactedContext = compactedUserMessageCount > 0 && compactSummary.length > 0;

  return (
    <AppScaffold
      title="Weekly Plan AI Chat"
      subtitle="Edit draft until you accept this week plan"
      activeTab="planner"
      compactHeader
      footer={
        revision ? (
          <StickyFooter>
            {error ? (
              <Text color={palette.danger} fontSize={12} fontWeight="700">
                {error}
              </Text>
            ) : null}
            <ActionButton onPress={acceptRevision} disabled={working}>
              Accept Draft
            </ActionButton>
            <ActionButton variant="secondary" onPress={() => router.replace('/planner')} disabled={working}>
              Back to Planner
            </ActionButton>
          </StickyFooter>
        ) : undefined
      }
    >
      {loading ? (
        <SectionCard>
          <Text color={palette.text} fontSize={14} fontWeight="700">
            Loading planner revision...
          </Text>
        </SectionCard>
      ) : revision ? (
        <>
          <SectionCard>
            <XStack justifyContent="space-between" alignItems="center" gap={10}>
              <Text color={palette.text} fontSize={15} fontWeight="700">
                7-Day Draft (Mini Day Cards)
              </Text>
              <Text color={palette.primary} fontSize={11} fontWeight="700">
                Revision {revision.revisionNumber}
              </Text>
            </XStack>
            <YStack gap={0}>
              {revision.latestOutput.days.map((day, index) => (
                <YStack key={day.dayKey}>
                  {index > 0 ? <Divider /> : null}
                  <YStack paddingVertical={8} gap={2}>
                    <Text color={palette.text} fontSize={12} fontWeight="700">
                      {day.label}
                    </Text>
                    <Paragraph color={palette.textSecondary} fontSize={11} lineHeight={16}>
                      {day.meals.map((meal) => `${meal.shortLabel} ${meal.calories} kcal`).join(' • ')}
                    </Paragraph>
                  </YStack>
                </YStack>
              ))}
            </YStack>
          </SectionCard>

          <SectionCard>
            <Text color={palette.primaryStrong} fontSize={14} fontWeight="700">
              Assistant
            </Text>
            {hasCompactedContext ? (
              <YStack gap={8}>
                <XStack
                  backgroundColor={palette.surfaceSoft}
                  borderColor={palette.border}
                  borderWidth={1}
                  borderRadius={8}
                  paddingHorizontal={10}
                  paddingVertical={8}
                  alignItems="center"
                  justifyContent="space-between"
                  gap={10}
                >
                  <XStack alignItems="center" gap={6} flex={1}>
                    <AppIcon name="auto-awesome" size={14} color={palette.textMuted} />
                    <Text color={palette.textSecondary} fontSize={11} fontWeight="600">
                      Context summarized after {compactedUserMessageCount} user turns.
                    </Text>
                  </XStack>
                  <Pressable
                    testID="planner-compaction-info-toggle"
                    onPress={() => setShowCompactionInfo((current) => !current)}
                  >
                    <AppIcon name="info-outline" size={15} color={palette.textMuted} />
                  </Pressable>
                </XStack>
                {showCompactionInfo ? (
                  <Paragraph color={palette.textSecondary} fontSize={12} lineHeight={18}>
                    To keep responses concise, fast, and privacy-minded, older turns are compacted into a short system
                    summary while your latest messages stay in chat.
                  </Paragraph>
                ) : null}
                <Pressable
                  testID="planner-compact-summary-toggle"
                  onPress={() => setShowCompactSummary((current) => !current)}
                >
                  <XStack alignItems="center" gap={6}>
                    <Text color={palette.primaryStrong} fontSize={12} fontWeight="700">
                      {showCompactSummary ? 'Hide compact summary' : 'View compact summary'}
                    </Text>
                    <AppIcon
                      name={showCompactSummary ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                      size={16}
                      color={palette.primaryStrong}
                    />
                  </XStack>
                </Pressable>
                {showCompactSummary ? (
                  <YStack
                    testID="planner-compact-summary-drawer"
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
            ) : null}
            <ScrollView
              testID="planner-chat-scroll"
              style={{ maxHeight: 220 }}
              contentContainerStyle={{ gap: 8 }}
              nestedScrollEnabled
            >
              <YStack gap={8}>
                {chatMessages.map((entry) => (
                  <YStack
                    key={entry.id}
                    alignSelf={entry.role === 'user' ? 'flex-end' : 'flex-start'}
                    maxWidth="92%"
                    borderRadius={8}
                    padding={8}
                    backgroundColor={entry.role === 'assistant' ? palette.primarySoft : palette.surfaceSoft}
                  >
                    <Text
                      color={entry.role === 'assistant' ? palette.primaryStrong : palette.success}
                      fontSize={12}
                      fontWeight="700"
                    >
                      {entry.role === 'assistant' ? 'Assistant' : 'You'}
                    </Text>
                    <Paragraph color={palette.textStrong} fontSize={13} lineHeight={18}>
                      {entry.content}
                    </Paragraph>
                  </YStack>
                ))}
              </YStack>
            </ScrollView>
            <TextField
              value={message}
              onChangeText={setMessage}
              placeholder="What should we adjust in this weekly plan?"
              multiline
            />
            <ActionButton variant="secondary" onPress={createRevision} disabled={working || !message.trim()}>
              {working ? 'Updating...' : 'Update Draft'}
            </ActionButton>
          </SectionCard>

          <SectionCard tone="warning">
            <Text color={palette.warning} fontSize={12} fontWeight="700">
              Disclaimer
            </Text>
            <Paragraph color={palette.textSecondary} fontSize={12} lineHeight={18}>
              AI may miss preferences. Review calorie, ingredient, and timing assumptions before accepting.
            </Paragraph>
          </SectionCard>
        </>
      ) : null}
    </AppScaffold>
  );
}
