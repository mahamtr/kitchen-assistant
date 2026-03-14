import { useEffect, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Paragraph, Text, XStack, YStack } from 'tamagui';
import { AppTabBar } from '../../components/layout/AppScaffold';
import {
  ActionButton,
  SearchField,
  SectionCard,
  TextField,
  palette,
} from '../../components/ui/primitives';
import { MeasurementUnitPicker } from './components/MeasurementUnitPicker';
import { useKeyboardMetrics } from '../../hooks/useKeyboardVisible';
import { kitchenService } from '../../lib/services';
import { useUiStore } from '../../lib/store/uiStore';
import type { OcrReviewResponse } from '../../lib/types/contracts';
import {
  isCountMeasurementUnit,
  isSupportedMeasurementUnit,
  normalizeEditableMeasurementUnit,
} from '../../lib/utils/measurement';

export default function EditOcrItemScreen() {
  const router = useRouter();
  const { lineId } = useLocalSearchParams<{ lineId: string }>();
  const pushToast = useUiStore((state) => state.pushToast);
  const [review, setReview] = useState<OcrReviewResponse | null>(null);
  const [name, setName] = useState('');
  const [quantityValue, setQuantityValue] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('');
  const [note, setNote] = useState('');
  const { keyboardHeight, keyboardVisible } = useKeyboardMetrics();

  useEffect(() => {
    const load = async () => {
      const nextReview = await kitchenService.getOcrReview();
      const line = nextReview.lines.find((entry) => entry.id === lineId);
      if (!line) {
        return;
      }
      setReview(nextReview);
      setName(line.name);
      setQuantityValue(String(line.quantityValue));
      setQuantityUnit(normalizeEditableMeasurementUnit(line.quantityUnit));
      setNote(line.note ?? '');
    };

    void load();
  }, [lineId]);

  const line = review?.lines.find((entry) => entry.id === lineId);
  const parsedQuantityValue = Number(quantityValue);
  const quantityIsValid =
    quantityValue.trim().length > 0 &&
    Number.isFinite(parsedQuantityValue) &&
    parsedQuantityValue > 0 &&
    (!isCountMeasurementUnit(quantityUnit) || Number.isInteger(parsedQuantityValue));

  if (!line) {
    return (
      <YStack flex={1} backgroundColor={palette.background} justifyContent="center" alignItems="center" padding={20}>
        <Text color={palette.text} fontSize={14} fontWeight="700">
          Loading OCR line...
        </Text>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={palette.background}>
        <YStack paddingHorizontal={20} paddingTop={20} paddingBottom={12} gap={6}>
          <Text color={palette.text} fontSize={34} lineHeight={36} fontWeight="700">
            Edit OCR Extracted Item
          </Text>
          <Paragraph color={palette.textSecondary} fontSize={14} fontStyle="italic">
            Line-by-line correction before saving to inventory
          </Paragraph>
        </YStack>

        <YStack flex={1}>
          <YStack paddingHorizontal={20} gap={12}>
            <SearchField value="" onChangeText={() => {}} placeholder="Detected item" />
            <SectionCard>
              <Text color={palette.text} fontSize={16} fontWeight="700">
                OCR Line Item
              </Text>
              <XStack justifyContent="space-between" alignItems="center">
                <Text color={palette.textSecondary} fontSize={13}>
                  Detected
                </Text>
                <Text color={palette.textStrong} fontSize={13} fontWeight="700">
                  {line.name}
                </Text>
              </XStack>
              <XStack justifyContent="space-between" alignItems="center">
                <Text color={palette.textSecondary} fontSize={13}>
                  Confidence
                </Text>
                <Text color={palette.primary} fontSize={13} fontWeight="700">
                  {Math.round(line.confidence * 100)}%
                </Text>
              </XStack>
              <Paragraph color={palette.textMuted} fontSize={13}>
                Tap Edit Line Item to open sheet
              </Paragraph>
            </SectionCard>
          </YStack>

          <YStack position="absolute" top={0} right={0} bottom={0} left={0} backgroundColor={palette.overlay} />

          <YStack
            position="absolute"
            left={12}
            right={12}
            bottom={keyboardHeight}
            maxHeight="82%"
            backgroundColor={palette.surface}
            borderTopLeftRadius={18}
            borderTopRightRadius={18}
            borderWidth={1}
            borderColor={palette.border}
          >
            <ScrollView
              automaticallyAdjustKeyboardInsets
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingTop: 10,
                paddingHorizontal: 14,
                paddingBottom: 16,
              }}
            >
              <YStack gap={8}>
                <YStack alignItems="center">
                  <YStack width={48} height={4} borderRadius={999} backgroundColor={palette.border} />
                </YStack>

                <Text color={palette.textStrong} fontSize={22} fontWeight="700">
                  Edit OCR Line Item
                </Text>
                <Paragraph color={palette.textSecondary} fontSize={14}>
                  Review parsed fields before saving
                </Paragraph>

                <SectionCard tone="muted">
                  <Text color={palette.text} fontSize={15} fontWeight="700">
                    Quantity
                  </Text>
                  <Paragraph color={palette.textSecondary} fontSize={12}>
                    Current parse
                  </Paragraph>
                  <TextField
                    label="Value"
                    value={quantityValue}
                    onChangeText={setQuantityValue}
                    placeholder="500"
                    keyboardType={isCountMeasurementUnit(quantityUnit) ? 'number-pad' : 'decimal-pad'}
                  />
                  <Paragraph color={palette.textSecondary} fontSize={12}>
                    {isCountMeasurementUnit(quantityUnit)
                      ? 'Count units must stay whole numbers.'
                      : 'Use a positive numeric quantity. kg and l are normalized on save.'}
                  </Paragraph>
                  <MeasurementUnitPicker
                    value={quantityUnit}
                    onValueChange={setQuantityUnit}
                    helperText="Pick an exact unit before applying the OCR line."
                  />
                </SectionCard>

                <SectionCard tone="muted">
                  <TextField label="Item name" value={name} onChangeText={setName} placeholder="Chicken breast" />
                  <TextField label="Notes" value={note} onChangeText={setNote} placeholder="Optional note" multiline />
                </SectionCard>

                <SectionCard tone="success">
                  <Text color={palette.success} fontSize={13} fontWeight="700">
                    Confidence: {Math.round(line.confidence * 100)}%
                  </Text>
                </SectionCard>

                <YStack gap={10}>
                  <XStack gap={10}>
                    <ActionButton variant="secondary" fullWidth onPress={() => router.back()}>
                      Cancel
                    </ActionButton>
                    <ActionButton
                      fullWidth
                      disabled={!name.trim() || !quantityIsValid}
                      onPress={async () => {
                        if (!quantityIsValid) {
                          pushToast({
                            title: 'Enter an exact quantity',
                            description: isCountMeasurementUnit(quantityUnit)
                              ? 'Count units must use a whole number.'
                              : 'Use a positive numeric quantity before saving.',
                            tone: 'warning',
                          });
                          return;
                        }

                        if (!isSupportedMeasurementUnit(quantityUnit)) {
                          pushToast({
                            title: 'Unsupported unit',
                            description:
                              'Use g, kg, ml, l, piece, clove, egg, can, jar, pack, fillet, or slice.',
                            tone: 'warning',
                          });
                          return;
                        }

                        await kitchenService.updateOcrLine(line.id, {
                          name,
                          quantityValue: Number(quantityValue || 0),
                          quantityUnit,
                          note,
                          accepted: true,
                        });
                        pushToast({
                          title: 'OCR line updated',
                          description: `${name} was updated in the review queue.`,
                          tone: 'success',
                        });
                        router.back();
                      }}
                    >
                      Save & Apply
                    </ActionButton>
                  </XStack>
                  <ActionButton
                    variant="danger"
                    onPress={async () => {
                      await kitchenService.updateOcrLine(line.id, { accepted: false });
                      pushToast({
                        title: 'Line skipped',
                        description: 'That receipt line will not be applied to inventory.',
                        tone: 'warning',
                      });
                      router.back();
                    }}
                  >
                    Skip Line
                  </ActionButton>
                </YStack>
              </YStack>
            </ScrollView>
          </YStack>
        </YStack>

        {!keyboardVisible ? <AppTabBar activeTab="kitchen" /> : null}
    </YStack>
  );
}
