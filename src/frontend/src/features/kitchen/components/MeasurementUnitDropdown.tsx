import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { Paragraph, Text, XStack, YStack } from 'tamagui';
import {
  AppIcon,
  FieldLabel,
  SectionCard,
  palette,
} from '../../../components/ui/primitives';

type MeasurementUnitGroup = {
  label: string;
  units: readonly string[];
};

export function MeasurementUnitDropdown({
  value,
  onValueChange,
  groups,
  label = 'Unit',
  helperText = 'Choose from exact metric or supported count units only.',
  accessibilityLabel = 'Measurement unit dropdown',
}: {
  value: string;
  onValueChange: (value: string) => void;
  groups: readonly MeasurementUnitGroup[];
  label?: string;
  helperText?: string;
  accessibilityLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = useMemo(() => {
    const units = groups.flatMap((group) => [...group.units]);
    return units.includes(value) ? value : 'Select unit';
  }, [groups, value]);

  return (
    <YStack gap={8}>
      <FieldLabel>{label}</FieldLabel>
      <Paragraph color={palette.textSecondary} fontSize={12} lineHeight={18}>
        {helperText}
      </Paragraph>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={() => setOpen((current) => !current)}
      >
        <XStack
          alignItems="center"
          justifyContent="space-between"
          borderRadius={10}
          borderWidth={1}
          borderColor={open ? palette.primaryBorder : palette.border}
          backgroundColor={palette.surface}
          paddingHorizontal={12}
          paddingVertical={10}
        >
          <Text color={value ? palette.text : palette.textMuted} fontSize={14} fontWeight="600">
            {selectedLabel}
          </Text>
          <AppIcon
            name={open ? 'expand-less' : 'expand-more'}
            size={18}
            color={palette.textMuted}
          />
        </XStack>
      </Pressable>
      {open ? (
        <SectionCard tone="muted">
          {groups.map((group, groupIndex) => (
            <YStack key={group.label} gap={6}>
              {groupIndex > 0 ? <YStack height={1} backgroundColor={palette.border} /> : null}
              <Text color={palette.textSecondary} fontSize={12} fontWeight="700">
                {group.label}
              </Text>
              <YStack gap={6}>
                {group.units.map((unit) => {
                  const selected = unit === value;

                  return (
                    <Pressable
                      key={unit}
                      accessibilityLabel={`Select unit ${unit}`}
                      accessibilityRole="button"
                      onPress={() => {
                        onValueChange(unit);
                        setOpen(false);
                      }}
                    >
                      <XStack
                        alignItems="center"
                        justifyContent="space-between"
                        borderRadius={8}
                        borderWidth={1}
                        borderColor={selected ? palette.primaryBorder : palette.border}
                        backgroundColor={selected ? palette.primarySoft : palette.surface}
                        paddingHorizontal={12}
                        paddingVertical={10}
                      >
                        <Text
                          color={selected ? palette.primaryStrong : palette.text}
                          fontSize={14}
                          fontWeight="700"
                        >
                          {unit}
                        </Text>
                        {selected ? (
                          <AppIcon name="check" size={16} color={palette.primaryStrong} />
                        ) : null}
                      </XStack>
                    </Pressable>
                  );
                })}
              </YStack>
            </YStack>
          ))}
        </SectionCard>
      ) : null}
    </YStack>
  );
}
