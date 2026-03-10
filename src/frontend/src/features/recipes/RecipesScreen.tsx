import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Paragraph, Text, XStack, YStack } from 'tamagui';
import AppScaffold from '../../components/layout/AppScaffold';
import {
  ActionButton,
  EmptyState,
  PillBadge,
  SearchField,
  SectionCard,
  SegmentedControl,
  StickyFooter,
  palette,
} from '../../components/ui/primitives';
import { recipesService } from '../../lib/services';
import { useUiStore } from '../../lib/store/uiStore';
import type { RecipeListResponse, RecipeScope } from '../../lib/types/contracts';

const RECIPE_SEGMENTS: Array<{ label: string; value: RecipeScope }> = [
  { label: 'Weekly Planned', value: 'weekly_planned' },
  { label: 'Favorites', value: 'favorites' },
  { label: 'History', value: 'history' },
];

function relationshipTone(label: string) {
  if (label.toLowerCase().includes('favorite')) {
    return 'danger' as const;
  }

  if (label.toLowerCase().includes('history') || label.toLowerCase().includes('cooked')) {
    return 'muted' as const;
  }

  return 'accent' as const;
}

export default function RecipesScreen() {
  const router = useRouter();
  const pushToast = useUiStore((state) => state.pushToast);
  const [scope, setScope] = useState<RecipeScope>('weekly_planned');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<RecipeListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (nextScope = scope, nextSearch = search) => {
    setLoading(true);
    setData(await recipesService.listRecipes(nextScope, nextSearch));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [scope]);

  return (
    <AppScaffold
      title="Recipes"
      subtitle="Weekly planned, favorites, and cooked history"
      activeTab="recipes"
      footer={
        <StickyFooter>
          <ActionButton
            onPress={async () => {
              const activeGeneration = await recipesService.getActiveGeneration();
              if (activeGeneration) {
                router.push(`/recipes/chat/${activeGeneration.generation.id}`);
                return;
              }

              const generation = await recipesService.startGeneration('I want a high-protein dinner under 30 minutes.');
              pushToast({
                title: 'Chef chat started',
                description: 'A draft recipe was created from the current weekly plan and inventory.',
                tone: 'success',
              });
              router.push(`/recipes/chat/${generation.generation.id}`);
            }}
          >
            Chat with Chef
          </ActionButton>
        </StickyFooter>
      }
    >
      <SearchField
        value={search}
        onChangeText={(nextValue) => {
          setSearch(nextValue);
          void load(scope, nextValue);
        }}
        placeholder="Search recipes..."
      />

      <SegmentedControl
        options={RECIPE_SEGMENTS}
        value={scope}
        onValueChange={(value) => setScope(value as RecipeScope)}
      />

      <Paragraph color={palette.textSecondary} fontSize={12} lineHeight={18}>
        History tab adds a quick Mark Favorite button for cooked recipes.
      </Paragraph>

      {loading ? (
        <SectionCard>
          <Text color={palette.text} fontSize={14} fontWeight="700">
            Loading recipes...
          </Text>
        </SectionCard>
      ) : data && data.items.length > 0 ? (
        <YStack gap={10}>
          {data.items.map((item) => (
            <SectionCard key={item.id}>
              <Pressable onPress={() => router.push(`/recipes/${item.id}`)}>
                <YStack gap={6}>
                  <XStack justifyContent="space-between" alignItems="flex-start" gap={10}>
                    <Text color={palette.textStrong} fontSize={16} fontWeight="700" flex={1}>
                      {item.title}
                    </Text>
                    <PillBadge label={item.relationshipLabel} tone={relationshipTone(item.relationshipLabel)} />
                  </XStack>
                  <Paragraph color={palette.textSecondary} fontSize={13}>
                    {item.metadata}
                  </Paragraph>
                  <Paragraph color={palette.textSecondary} fontSize={13}>
                    {item.usageHint}
                  </Paragraph>
                  <Text color={palette.primary} fontSize={13} fontWeight="700">
                    Tap to view steps + ingredients
                  </Text>
                </YStack>
              </Pressable>
              {scope === 'history' ? (
                <XStack justifyContent="flex-end">
                  <ActionButton
                    variant={item.isFavorite ? 'secondary' : 'success'}
                    size="sm"
                    onPress={async () => {
                      await recipesService.setFavorite(item.id, !item.isFavorite);
                      pushToast({
                        title: item.isFavorite ? 'Removed from favorites' : 'Added to favorites',
                        description: item.title,
                        tone: 'success',
                      });
                      await load();
                    }}
                  >
                    {item.isFavorite ? 'Favorited' : 'Mark favorite'}
                  </ActionButton>
                </XStack>
              ) : null}
            </SectionCard>
          ))}
        </YStack>
      ) : (
        <EmptyState
          title="No recipes in this segment"
          description="Change the segment or start a new Chef chat to generate another draft."
        />
      )}
    </AppScaffold>
  );
}
