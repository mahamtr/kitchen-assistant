import { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Paragraph, Text, XStack, YStack } from 'tamagui';
import AppScaffold from '../../components/layout/AppScaffold';
import {
  ActionButton,
  SectionCard,
  StickyFooter,
  TextField,
  palette,
} from '../../components/ui/primitives';
import { plannerService } from '../../lib/services';
import { useUiStore } from '../../lib/store/uiStore';
import type { WeeklyPlanRevisionResponse } from '../../lib/types/contracts';
import type { ChatMessage } from '../../lib/types/entities';

function Divider() {
  return <YStack height={1} backgroundColor={palette.border} />;
}

export default function PlannerChatScreen() {
  const router = useRouter();
  const pushToast = useUiStore((state) => state.pushToast);
  const [revision, setRevision] = useState<WeeklyPlanRevisionResponse | null>(null);
  const [sessionChat, setSessionChat] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatScrollRef = useRef<ScrollView | null>(null);

  const load = async () => {
    try {
      const latestRevision = await plannerService.getLatestRevision();
      setRevision(latestRevision);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load planner chat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();

    return () => {
      setSessionChat([]);
    };
  }, []);

  const createRevision = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    setWorking(true);
    setError(null);
    try {
      const nextRevision = await plannerService.createRevision({ userMessage: trimmedMessage });
      setRevision(nextRevision);
      setSessionChat((currentChat) => [
        ...currentChat,
        {
          id: `planner-user-${Date.now()}`,
          role: 'user',
          content: trimmedMessage,
          timestamp: new Date().toISOString(),
        },
        {
          id: `planner-assistant-${Date.now()}`,
          role: 'assistant',
          content: nextRevision.latestOutput.rationale,
          timestamp: new Date().toISOString(),
        },
      ]);
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

  const chatMessages = sessionChat.slice(-6);

  useEffect(() => {
    if (!chatMessages.length) {
      return;
    }

    chatScrollRef.current?.scrollToEnd({ animated: true });
  }, [chatMessages.length]);

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
            <ScrollView
              ref={chatScrollRef}
              style={{ maxHeight: 260 }}
              contentContainerStyle={{ gap: 8 }}
              keyboardShouldPersistTaps="handled"
            >
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
            </ScrollView>
            <TextField
              value={message}
              onChangeText={setMessage}
              placeholder="How should I adjust this week's plan?"
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
