import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Paragraph, Text, XStack, YStack } from 'tamagui';
import AppScaffold from '../../components/layout/AppScaffold';
import { ActionButton, SectionCard, StickyFooter, palette } from '../../components/ui/primitives';
import { kitchenService } from '../../lib/services';
import { useUiStore } from '../../lib/store/uiStore';
import type { OcrReviewResponse } from '../../lib/types/contracts';

function Divider() {
  return <YStack height={1} backgroundColor={palette.border} />;
}

export default function OcrReviewScreen() {
  const router = useRouter();
  const pushToast = useUiStore((state) => state.pushToast);
  const [review, setReview] = useState<OcrReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setReview(await kitchenService.getOcrReview());
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to load OCR review.');
      }
    };

    void load();
  }, []);

  return (
    <AppScaffold
      title="Inventory OCR Review"
      subtitle="Review extracted items before adding to inventory"
      activeTab="kitchen"
      footer={
        review ? (
          <StickyFooter>
            <XStack gap={10}>
              <ActionButton variant="secondary" fullWidth onPress={() => router.replace('/kitchen/to-buy')}>
                Discard
              </ActionButton>
              <ActionButton
                fullWidth
                onPress={async () => {
                  await kitchenService.applyOcrReview();
                  pushToast({
                    title: 'OCR applied',
                    description: 'Accepted receipt lines were added into Kitchen inventory.',
                    tone: 'success',
                  });
                  router.replace('/kitchen/in-stock');
                }}
              >
                Apply to Inventory
              </ActionButton>
            </XStack>
          </StickyFooter>
        ) : undefined
      }
    >
      {review ? (
        <>
          <SectionCard>
            <Text color={palette.text} fontSize={16} fontWeight="700">
              Scanned Receipt
            </Text>
            <YStack
              height={96}
              borderRadius={8}
              borderWidth={1}
              borderColor={palette.border}
              backgroundColor={palette.surfaceSoft}
              alignItems="center"
              justifyContent="center"
            >
              <Text color={palette.textMuted} fontSize={13}>
                Receipt image + OCR overlay
              </Text>
            </YStack>
          </SectionCard>

          <SectionCard>
            <XStack justifyContent="space-between" alignItems="center" gap={10}>
              <Text color={palette.text} fontSize={16} fontWeight="700">
                Extracted Items
              </Text>
              <Text color={palette.textMuted} fontSize={12}>
                {review.lines.length} lines
              </Text>
            </XStack>
            <YStack gap={0}>
              {review.lines.map((line, index) => (
                <YStack key={line.id}>
                  {index > 0 ? <Divider /> : null}
                  <Pressable onPress={() => router.push(`/kitchen/ocr/item/${line.id}`)}>
                    <XStack justifyContent="space-between" alignItems="center" gap={10} paddingVertical={10}>
                      <Text color={palette.text} fontSize={13} fontWeight="600" flex={1}>
                        {line.name}
                      </Text>
                      <Text color={palette.textStrong} fontSize={13}>
                        x{line.quantityValue}
                      </Text>
                      <Text color={line.accepted ? palette.success : palette.primary} fontSize={12} fontWeight="700">
                        {line.accepted ? 'add' : 'match'}
                      </Text>
                    </XStack>
                  </Pressable>
                </YStack>
              ))}
            </YStack>
          </SectionCard>

          <SectionCard tone="muted">
            <Paragraph color={palette.textSecondary} fontSize={13} textAlign="center">
              OCR confidence {Math.round(review.confidence * 100)}% • tap line to edit
            </Paragraph>
          </SectionCard>
        </>
      ) : (
        <SectionCard tone={error ? 'danger' : 'default'}>
          <Text color={error ? palette.danger : palette.text} fontSize={14} fontWeight="700">
            {error ?? 'Loading OCR review...'}
          </Text>
        </SectionCard>
      )}
    </AppScaffold>
  );
}
