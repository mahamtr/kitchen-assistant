import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Paragraph, Text, XStack, YStack } from 'tamagui';
import { onboardingService } from '../../lib/services';
import type { OnboardingDraft, OnboardingQuestion } from '../../lib/types/entities';
import {
  ActionButton,
  ChoiceChip,
  PillBadge,
  SectionCard,
  SectionHeading,
  StickyFooter,
  palette,
} from '../../components/ui/primitives';
import { useKeyboardMetrics } from '../../hooks/useKeyboardVisible';
import { useUiStore } from '../../lib/store/uiStore';
import { useUserStore } from '../../lib/store/userStore';

function OnboardingFrame({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const { keyboardHeight } = useKeyboardMetrics();

  return (
    <YStack flex={1} backgroundColor={palette.background} paddingBottom={keyboardHeight}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 20,
          paddingBottom: 140,
          gap: 16,
        }}
      >
          <YStack gap="$2">
            <PillBadge label="Onboarding Questionnaire Flow" tone="accent" />
            <Text color={palette.text} fontSize={32} lineHeight={34} fontWeight="800">
              {title}
            </Text>
            <Paragraph color={palette.muted} fontSize={14} lineHeight={21}>
              {subtitle}
            </Paragraph>
          </YStack>
          {children}
      </ScrollView>
      {footer}
    </YStack>
  );
}

function reviewLines(draft: OnboardingDraft) {
  return {
    defaults: [
      `Diet style: ${draft.dietStyle}`,
      `Allergies: ${draft.allergies.length > 0 ? draft.allergies.join(', ') : 'None'}`,
      `Cuisine preferences: ${draft.cuisinePreferences.join(', ')}`,
      `Weekday cooking time: ${draft.cookingTime}`,
      `Weekly structure: ${draft.weeklyStructure.join(', ')}`,
    ],
    intent: [
      `Nutrition target: ${draft.nutritionTarget}`,
      `Focus: ${draft.weeklyIntentFocus}`,
      `Exclude this week: ${draft.weeklyIntentExclude.join(', ')}`,
      `Planner notes: ${draft.weeklyIntentNotes}`,
    ],
  };
}

export default function OnboardingScreen({ step }: { step: number }) {
  const router = useRouter();
  const pushToast = useUiStore((state) => state.pushToast);
  const setOnboardingCompleted = useUserStore(
    (state) => state.setOnboardingCompleted,
  );
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const nextState = await onboardingService.getState();
        setQuestions(nextState.questions);
        setDraft(nextState.draft);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to load onboarding.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const question = questions[Math.max(0, Math.min(step - 1, questions.length - 1))];

  const updateSingle = async (value: string) => {
    if (!question) {
      return;
    }
    const nextDraft = await onboardingService.saveAnswer(question.key, value);
    setDraft(nextDraft);
  };

  const updateMulti = async (value: string) => {
    if (!question || !draft) {
      return;
    }
    const currentValues =
      question.key === 'allergies_avoids'
        ? draft.allergies
        : question.key === 'cuisine_preferences'
          ? draft.cuisinePreferences
          : draft.weeklyStructure;

    let nextValues = currentValues.includes(value)
      ? currentValues.filter((entry) => entry !== value)
      : [...currentValues, value];

    if (question.key === 'allergies_avoids' && value === 'None') {
      nextValues = [];
    }

    const nextDraft = await onboardingService.saveAnswer(question.key, nextValues);
    setDraft(nextDraft);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onboardingService.complete();
      setOnboardingCompleted(true);
      pushToast({
        title: 'Profile saved',
        description: 'Your weekly plan and kitchen data are now ready.',
        tone: 'success',
      });
      router.replace('/home');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to finish onboarding.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !draft || (!question && step < 7)) {
    return (
      <OnboardingFrame
        title="Onboarding Questionnaire Flow"
        subtitle="Loading your profile defaults..."
        footer={<StickyFooter><Text color={palette.muted}>Loading...</Text></StickyFooter>}
      >
        <SectionCard>
          <Text color={palette.text} fontSize={16} fontWeight="700">
            Preparing the onboarding flow...
          </Text>
        </SectionCard>
      </OnboardingFrame>
    );
  }

  if (step >= 7) {
    const lines = reviewLines(draft);
    return (
      <OnboardingFrame
        title="Review Your Profile"
        subtitle="Check defaults and this week's intent before generating your plan."
        footer={
          <StickyFooter>
            <YStack gap="$2">
              {error ? (
                <Text color={palette.danger} fontSize={13} fontWeight="700">
                  {error}
                </Text>
              ) : null}
              <ActionButton onPress={submit} disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile and Build Plan'}
              </ActionButton>
              <XStack gap="$2">
                <ActionButton variant="secondary" onPress={() => router.push('/onboarding/6')} fullWidth>
                  &lt; Back
                </ActionButton>
                <ActionButton variant="ghost" onPress={() => router.push('/onboarding/1')} fullWidth>
                  Edit answers
                </ActionButton>
              </XStack>
            </YStack>
          </StickyFooter>
        }
      >
        <SectionCard>
          <SectionHeading title="Persistent defaults" subtitle="Saved to your profile for future weekly plans." />
          {lines.defaults.map((line) => (
            <Text key={line} color={palette.text} fontSize={14} lineHeight={22}>
              {line}
            </Text>
          ))}
        </SectionCard>
        <SectionCard tone="accent">
          <SectionHeading title="Session intent (this week)" subtitle="Only affects this week's generated plan." />
          {lines.intent.map((line) => (
            <Text key={line} color={palette.text} fontSize={14} lineHeight={22}>
              {line}
            </Text>
          ))}
        </SectionCard>
        <SectionCard tone="muted">
          <SectionHeading
            title="How this is applied"
            subtitle="Your defaults stay saved while the weekly intent only shapes the current generation."
          />
        </SectionCard>
      </OnboardingFrame>
    );
  }

  const isMultiSelect = question.answerType === 'multi_select';
  const selectedValues =
    question.key === 'allergies_avoids'
      ? draft.allergies
      : question.key === 'cuisine_preferences'
        ? draft.cuisinePreferences
        : draft.weeklyStructure;
  const selectedValue =
    question.key === 'diet_style'
      ? draft.dietStyle
      : question.key === 'cooking_time'
        ? draft.cookingTime
        : draft.nutritionTarget;

  return (
    <OnboardingFrame
      title="Onboarding Questionnaire Flow"
      subtitle={question.prompt}
      footer={
        <StickyFooter>
          <YStack gap="$2">
            {error ? (
              <Text color={palette.danger} fontSize={13} fontWeight="700">
                {error}
              </Text>
            ) : null}
            <ActionButton onPress={() => router.push(`/onboarding/${step + 1}`)}>
              Continue
            </ActionButton>
            <ActionButton
              variant="ghost"
              onPress={() => {
                if (step > 1) {
                  router.push(`/onboarding/${step - 1}`);
                }
              }}
              disabled={step === 1}
            >
              Back
            </ActionButton>
          </YStack>
        </StickyFooter>
      }
    >
      <SectionCard tone="muted">
        <SectionHeading title={`Step ${step} of 7`} subtitle="Build the defaults that drive weekly plans and kitchen alerts." />
      </SectionCard>
      <SectionCard>
        <SectionHeading title={question.prompt} subtitle={question.hint} />
        <YStack gap="$3">
          {question.options?.map((option) => {
            const selected =
              isMultiSelect
                ? option.value === 'None'
                  ? selectedValues.length === 0
                  : selectedValues.includes(option.value)
                : selectedValue === option.value;

            return (
              <ChoiceChip
                key={option.value}
                label={option.label}
                description={option.description}
                selected={selected}
                onPress={() => {
                  if (isMultiSelect) {
                    void updateMulti(option.value);
                    return;
                  }

                  void updateSingle(option.value);
                }}
              />
            );
          })}
        </YStack>
      </SectionCard>
      <SectionCard tone="accent">
        <SectionHeading
          title={String(question.metadata?.tipTitle ?? 'Tip')}
          subtitle={String(question.metadata?.tipBody ?? 'These answers shape the next screens.')}
        />
      </SectionCard>
    </OnboardingFrame>
  );
}
