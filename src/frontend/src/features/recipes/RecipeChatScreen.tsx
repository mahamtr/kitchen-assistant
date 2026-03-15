import { useEffect, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Paragraph, Text, XStack, YStack } from 'tamagui';
import AppScaffold from '../../components/layout/AppScaffold';
import {
  ActionButton,
  SectionCard,
  StickyFooter,
  TextField,
  palette,
} from '../../components/ui/primitives';
import { recipesService } from '../../lib/services';
import { useUiStore } from '../../lib/store/uiStore';
import type { RecipeGenerationResponse } from '../../lib/types/contracts';

export default function RecipeChatScreen() {
  const router = useRouter();
  const { generationId } = useLocalSearchParams<{ generationId: string }>();
  const pushToast = useUiStore((state) => state.pushToast);
  const [data, setData] = useState<RecipeGenerationResponse | null>(null);
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  const load = async () => {
    setData(await recipesService.getGeneration(generationId));
  };

  useEffect(() => {
    void load();
  }, [generationId]);

  const latestRevision = data?.latestRevision;
  const latestOutput = latestRevision?.latestOutput ?? null;
  const chatMessages = useMemo(() => latestRevision?.chat ?? [], [latestRevision]);
  const latestUserMessage = [...chatMessages].reverse().find((entry) => entry.role === 'user');

  return (
    <AppScaffold
      title="Recipes AI Chat"
      subtitle="Generate recipes from your weekly plan, favorites, and in-stock items"
      activeTab="recipes"
      footer={
        data && latestRevision && latestOutput ? (
          <StickyFooter>
            <XStack gap={10}>
              <ActionButton
                fullWidth
                onPress={async () => {
                  const detail = await recipesService.acceptGeneration(data.generation.id, latestRevision.id);
                  pushToast({
                    title: 'Draft accepted',
                    description: `${detail.recipe.title} is now saved in Recipes.`,
                    tone: 'success',
                  });
                  router.replace(`/recipes/${detail.recipe.id}`);
                }}
              >
                Accept Draft
              </ActionButton>
              <ActionButton variant="secondary" fullWidth onPress={() => router.replace('/recipes')}>
                Back to Recipes
              </ActionButton>
            </XStack>
          </StickyFooter>
        ) : undefined
      }
    >
      {data && latestRevision ? (
        <>
          <SectionCard>
            <Text color={palette.text} fontSize={16} fontWeight="700">
              Recipe request context
            </Text>
            <Paragraph color={palette.textSecondary} fontSize={13}>
              From weekly plan + favorites + inventory
            </Paragraph>
          </SectionCard>

          {latestOutput ? (
            <SectionCard>
              <XStack justifyContent="space-between" alignItems="center" gap={10}>
                <Text color={palette.text} fontSize={16} fontWeight="700">
                  Draft Recipe
                </Text>
                <Text color={palette.primary} fontSize={12} fontWeight="700">
                  Revision {latestRevision.revisionNumber}
                </Text>
              </XStack>
              <Text color={palette.textStrong} fontSize={15} fontWeight="700">
                {latestOutput.title}
              </Text>
              <Paragraph color={palette.textSecondary} fontSize={13}>
                {latestOutput.metadata.readyInMinutes} min • {latestOutput.metadata.calories} kcal •{' '}
                {latestOutput.metadata.highlight}
              </Paragraph>
              <Paragraph color={palette.textSecondary} fontSize={13}>
                Ingredients: {latestOutput.ingredients.map((ingredient) => ingredient.name).join(', ')}
              </Paragraph>
              {latestUserMessage ? (
                <SectionCard tone="muted">
                  <Paragraph color={palette.textSecondary} fontSize={13}>
                    Requested edits applied: {latestUserMessage.content}
                  </Paragraph>
                </SectionCard>
              ) : null}
            </SectionCard>
          ) : (
            <SectionCard tone="muted">
              <Text color={palette.text} fontSize={16} fontWeight="700">
                Start with a craving
              </Text>
              <Paragraph color={palette.textSecondary} fontSize={13}>
                Chef will create the first draft after your first message.
              </Paragraph>
            </SectionCard>
          )}

          <SectionCard>
            <Text color={palette.text} fontSize={15} fontWeight="700">
              Chef chat
            </Text>
            <ScrollView
              testID="recipe-chat-scroll"
              style={{ maxHeight: 260 }}
              contentContainerStyle={{ gap: 8 }}
              nestedScrollEnabled
            >
              <YStack gap={8}>
                {chatMessages.map((entry) => (
                  <YStack
                    key={entry.id}
                    alignSelf={entry.role === 'user' ? 'flex-end' : 'flex-start'}
                    maxWidth="90%"
                    borderRadius={8}
                    padding={8}
                    backgroundColor={entry.role === 'assistant' ? palette.primarySoft : palette.successSoft}
                  >
                    <Text
                      color={entry.role === 'assistant' ? palette.primaryStrong : palette.success}
                      fontSize={12}
                      fontWeight="700"
                    >
                      {entry.role === 'assistant' ? 'Chef' : 'You'}
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
              placeholder="What would you like to eat?"
              multiline
            />
            <ActionButton
              variant="secondary"
              onPress={async () => {
                setWorking(true);
                try {
                  await recipesService.createGenerationRevision(data.generation.id, { userMessage: message });
                  setMessage('');
                  await load();
                } finally {
                  setWorking(false);
                }
              }}
              disabled={working || !message.trim()}
            >
              {working
                ? 'Updating...'
                : latestOutput
                  ? 'Ask for another variation'
                  : 'Generate first draft'}
            </ActionButton>
            <SectionCard tone="muted">
              <Paragraph color={palette.textSecondary} fontSize={13}>
                {latestOutput
                  ? 'Accept Draft to save this recipe, or go back and ask for another variation.'
                  : 'Tell Chef what you want to eat, then the first recipe draft will appear here.'}
              </Paragraph>
            </SectionCard>
          </SectionCard>
        </>
      ) : (
        <SectionCard>
          <Text color={palette.text} fontSize={14} fontWeight="700">
            Loading recipe chat...
          </Text>
        </SectionCard>
      )}
    </AppScaffold>
  );
}
