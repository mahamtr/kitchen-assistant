import { Paragraph, Text, XStack, YStack } from 'tamagui';
import {
  ChoiceChip,
  FieldLabel,
  palette,
} from '../../../components/ui/primitives';
import { supportedMeasurementUnitGroups } from '../../../lib/utils/measurement';

export function MeasurementUnitPicker({
  value,
  onValueChange,
  label = 'Unit',
  helperText = 'Choose from exact metric or count units only.',
}: {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  helperText?: string;
}) {
  return (
    <YStack gap={8}>
      <FieldLabel>{label}</FieldLabel>
      <Paragraph color={palette.textSecondary} fontSize={12} lineHeight={18}>
        {helperText}
      </Paragraph>
      {supportedMeasurementUnitGroups.map((group) => (
        <YStack key={group.label} gap={6}>
          <Text color={palette.textSecondary} fontSize={12} fontWeight="700">
            {group.label}
          </Text>
          <XStack flexWrap="wrap" gap={8}>
            {group.units.map((unit) => (
              <YStack key={unit} style={{ width: '48%' }}>
                <ChoiceChip
                  label={unit}
                  selected={value === unit}
                  onPress={() => onValueChange(unit)}
                />
              </YStack>
            ))}
          </XStack>
        </YStack>
      ))}
    </YStack>
  );
}
