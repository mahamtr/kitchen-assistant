import { Children, type ComponentProps, type ReactNode } from 'react';
import { Pressable, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button, Input, Paragraph, Text, XStack, YStack } from 'tamagui';

export const palette = {
  background: '#F7F7F7',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  surfaceSoft: '#F9FAFB',
  border: '#E5E7EB',
  borderSoft: '#EEF2F7',
  text: '#1A1A1A',
  textStrong: '#0F172A',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  primary: '#2563EB',
  primarySoft: '#EFF6FF',
  primaryBorder: '#BFDBFE',
  primaryStrong: '#1D4ED8',
  success: '#16A34A',
  successSoft: '#ECFDF3',
  successBorder: '#BBF7D0',
  warning: '#F59E0B',
  warningSoft: '#FFF7ED',
  warningBorder: '#FED7AA',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',
  overlay: 'rgba(15, 23, 42, 0.2)',
  accent: '#2563EB',
  accentSoft: '#EFF6FF',
  accentDark: '#1D4ED8',
  muted: '#6B7280',
  navy: '#0F172A',
};

type ActionButtonProps = {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  fullWidth?: boolean;
  size?: 'sm' | 'md';
};

type SectionTone = 'default' | 'muted' | 'accent' | 'info' | 'warning' | 'success' | 'danger';

function toneStyles(tone: SectionTone) {
  if (tone === 'accent' || tone === 'info') {
    return {
      backgroundColor: palette.primarySoft,
      borderColor: palette.primaryBorder,
    };
  }

  if (tone === 'warning') {
    return {
      backgroundColor: palette.warningSoft,
      borderColor: palette.warningBorder,
    };
  }

  if (tone === 'success') {
    return {
      backgroundColor: palette.successSoft,
      borderColor: palette.successBorder,
    };
  }

  if (tone === 'danger') {
    return {
      backgroundColor: palette.dangerSoft,
      borderColor: palette.dangerBorder,
    };
  }

  if (tone === 'muted') {
    return {
      backgroundColor: palette.surfaceSoft,
      borderColor: palette.border,
    };
  }

  return {
    backgroundColor: palette.surface,
    borderColor: palette.border,
  };
}

export function AppIcon({
  name,
  size = 18,
  color = palette.textMuted,
}: {
  name: ComponentProps<typeof MaterialIcons>['name'];
  size?: number;
  color?: string;
}) {
  return <MaterialIcons name={name} size={size} color={color} />;
}

export function SectionCard({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: SectionTone;
}) {
  const colors = toneStyles(tone);

  return (
    <YStack
      backgroundColor={colors.backgroundColor}
      borderColor={colors.borderColor}
      borderWidth={1}
      borderRadius={12}
      padding={12}
      gap={8}
    >
      {children}
    </YStack>
  );
}

export function SectionHeading({
  title,
  subtitle,
  accessory,
}: {
  title: string;
  subtitle?: string;
  accessory?: ReactNode;
}) {
  return (
    <XStack alignItems="flex-start" justifyContent="space-between" gap={12}>
      <YStack flex={1} gap={4}>
        <Text color={palette.text} fontSize={16} fontWeight="700">
          {title}
        </Text>
        {subtitle ? (
          <Paragraph color={palette.textSecondary} fontSize={13} lineHeight={18}>
            {subtitle}
          </Paragraph>
        ) : null}
      </YStack>
      {accessory}
    </XStack>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Text color={palette.text} fontSize={12} fontWeight="700">
      {children}
    </Text>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
  editable = true,
}: {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  editable?: boolean;
}) {
  return (
    <YStack gap={6}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      {multiline ? (
        <YStack
          borderRadius={10}
          borderWidth={1}
          borderColor={palette.border}
          backgroundColor={palette.surface}
          paddingHorizontal={12}
          paddingVertical={10}
        >
          <TextInput
            editable={editable}
            multiline
            numberOfLines={4}
            placeholder={placeholder}
            placeholderTextColor={palette.textMuted}
            value={value}
            onChangeText={onChangeText}
            style={{
              minHeight: 82,
              color: palette.text,
              fontSize: 14,
              textAlignVertical: 'top',
            }}
          />
        </YStack>
      ) : (
        <Input
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.textMuted}
          secureTextEntry={secureTextEntry}
          backgroundColor={palette.surface}
          borderColor={palette.border}
          color={palette.text}
          borderRadius={10}
          height={40}
          paddingHorizontal={12}
          editable={editable}
        />
      )}
    </YStack>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <XStack
      alignItems="center"
      gap={8}
      borderWidth={1}
      borderColor={palette.border}
      backgroundColor={palette.surface}
      borderRadius={10}
      paddingHorizontal={12}
      height={36}
    >
      <AppIcon name="search" size={16} color={palette.textMuted} />
      <Input
        flex={1}
        unstyled
        color={palette.text}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
      />
    </XStack>
  );
}

export function SegmentedControl({
  options,
  value,
  onValueChange,
}: {
  options: Array<{ label: string; value: string }>;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <XStack gap={8}>
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable key={option.value} onPress={() => onValueChange(option.value)} style={{ flex: 1 }}>
            <YStack
              minHeight={34}
              paddingVertical={8}
              paddingHorizontal={10}
              alignItems="center"
              justifyContent="center"
              borderRadius={8}
              borderWidth={1}
              borderColor={selected ? palette.primaryBorder : palette.border}
              backgroundColor={selected ? palette.primarySoft : palette.surface}
            >
              <Text color={selected ? palette.primaryStrong : palette.textSecondary} fontWeight="700" fontSize={12}>
                {option.label}
              </Text>
            </YStack>
          </Pressable>
        );
      })}
    </XStack>
  );
}

export function ChoiceChip({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <YStack
        borderWidth={1}
        borderColor={selected ? palette.primaryBorder : palette.border}
        backgroundColor={selected ? palette.primarySoft : palette.surface}
        borderRadius={10}
        padding={12}
        gap={4}
      >
        <Text color={palette.text} fontSize={14} fontWeight="700">
          {label}
        </Text>
        {description ? (
          <Paragraph color={palette.textSecondary} fontSize={13} lineHeight={18}>
            {description}
          </Paragraph>
        ) : null}
      </YStack>
    </Pressable>
  );
}

export function StatChip({
  label,
  value,
  active,
  onPress,
}: {
  label: string;
  value: string | number;
  active?: boolean;
  onPress?: () => void;
}) {
  const toneColor =
    label === 'In Stock' ? palette.success : label === 'Expiring' ? palette.warning : palette.primaryStrong;
  const backgroundColor = active
    ? label === 'In Stock'
      ? palette.successSoft
      : label === 'Expiring'
        ? palette.warningSoft
        : palette.primarySoft
    : palette.surface;
  const borderColor = active
    ? label === 'In Stock'
      ? palette.successBorder
      : label === 'Expiring'
        ? palette.warningBorder
        : palette.primaryBorder
    : palette.border;

  return (
    <Pressable disabled={!onPress} onPress={onPress} style={{ flex: 1 }}>
      <XStack
        minHeight={36}
        alignItems="center"
        justifyContent="center"
        gap={4}
        paddingHorizontal={10}
        borderRadius={8}
        backgroundColor={backgroundColor}
        borderWidth={1}
        borderColor={borderColor}
      >
        <Text color={toneColor} fontSize={12} fontWeight={active ? '700' : '600'}>
          {label}
        </Text>
        <Text color={toneColor} fontSize={12} fontWeight="700">
          {value}
        </Text>
      </XStack>
    </Pressable>
  );
}

export function PillBadge({
  label,
  tone = 'muted',
}: {
  label: string;
  tone?: 'accent' | 'muted' | 'success' | 'warning' | 'danger';
}) {
  const colors =
    tone === 'accent'
      ? { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder, textColor: palette.primaryStrong }
      : tone === 'success'
        ? { backgroundColor: palette.successSoft, borderColor: palette.successBorder, textColor: palette.success }
        : tone === 'warning'
          ? { backgroundColor: palette.warningSoft, borderColor: palette.warningBorder, textColor: palette.warning }
          : tone === 'danger'
            ? { backgroundColor: palette.dangerSoft, borderColor: palette.dangerBorder, textColor: palette.danger }
            : { backgroundColor: palette.surfaceSoft, borderColor: palette.border, textColor: palette.textSecondary };

  return (
    <YStack
      alignSelf="flex-start"
      backgroundColor={colors.backgroundColor}
      borderColor={colors.borderColor}
      borderWidth={1}
      borderRadius={999}
      paddingHorizontal={8}
      paddingVertical={4}
    >
      <Text color={colors.textColor} fontSize={11} fontWeight="700">
        {label}
      </Text>
    </YStack>
  );
}

export function ActionButton({
  children,
  onPress,
  disabled,
  variant = 'primary',
  fullWidth = false,
  size = 'md',
}: ActionButtonProps) {
  const styles =
    variant === 'primary'
      ? { backgroundColor: palette.primary, color: '#FFFFFF', borderColor: palette.primary }
      : variant === 'secondary'
        ? { backgroundColor: palette.surface, color: palette.text, borderColor: palette.border }
        : variant === 'success'
          ? { backgroundColor: palette.success, color: '#FFFFFF', borderColor: palette.success }
          : variant === 'danger'
            ? { backgroundColor: palette.surface, color: palette.danger, borderColor: palette.dangerBorder }
            : { backgroundColor: 'transparent', color: palette.primaryStrong, borderColor: 'transparent' };

  const content = Children.map(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return (
        <Text color={styles.color} fontSize={size === 'sm' ? 12 : 14} fontWeight="700">
          {child}
        </Text>
      );
    }

    return child;
  });

  return (
    <Button
      onPress={onPress}
      disabled={disabled}
      backgroundColor={styles.backgroundColor}
      borderColor={styles.borderColor}
      borderWidth={variant === 'ghost' ? 0 : 1}
      color={styles.color}
      fontWeight="700"
      borderRadius={8}
      height={size === 'sm' ? 32 : 44}
      flex={fullWidth ? 1 : undefined}
      paddingHorizontal={size === 'sm' ? 10 : 14}
      opacity={disabled ? 0.55 : 1}
      pressStyle={{
        opacity: 0.88,
      }}
    >
      {content}
    </Button>
  );
}

export function StickyFooter({ children }: { children: ReactNode }) {
  return (
    <YStack paddingHorizontal={20} paddingTop={10} paddingBottom={10} backgroundColor={palette.background} gap={10}>
      {children}
    </YStack>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <SectionCard>
      <Text color={palette.text} fontSize={14} fontWeight="700">
        {label}
      </Text>
      <Paragraph color={palette.textSecondary}>Loading...</Paragraph>
    </SectionCard>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <SectionCard tone="muted">
      <Text color={palette.text} fontSize={16} fontWeight="700">
        {title}
      </Text>
      <Paragraph color={palette.textSecondary} fontSize={13} lineHeight={18}>
        {description}
      </Paragraph>
      {action}
    </SectionCard>
  );
}

export function OverlayCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <SectionCard>
      <SectionHeading title={title} subtitle={subtitle} />
      {children}
      {footer ? <YStack paddingTop={4}>{footer}</YStack> : null}
    </SectionCard>
  );
}

export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!visible) {
    return null;
  }

  return (
    <YStack
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      backgroundColor={palette.overlay}
      justifyContent="center"
      padding={20}
      zIndex={20}
    >
      <SectionCard>
        <SectionHeading title={title} subtitle={description} />
        <Paragraph color={palette.textSecondary} fontSize={13} lineHeight={18}>
          This action updates your mock data immediately.
        </Paragraph>
        <XStack gap={10}>
          <ActionButton variant="secondary" onPress={onCancel} fullWidth>
            {cancelLabel}
          </ActionButton>
          <ActionButton variant="danger" onPress={onConfirm} fullWidth>
            {confirmLabel}
          </ActionButton>
        </XStack>
      </SectionCard>
    </YStack>
  );
}

export function InfoLine({
  label,
  value,
  valueTone = 'default',
}: {
  label: string;
  value: string;
  valueTone?: 'default' | 'accent' | 'warning';
}) {
  const valueColor =
    valueTone === 'accent' ? palette.primaryStrong : valueTone === 'warning' ? palette.warning : palette.text;

  return (
    <XStack alignItems="center" justifyContent="space-between" gap={12}>
      <Text color={palette.textSecondary} fontSize={13}>
        {label}
      </Text>
      <Text color={valueColor} fontSize={13} fontWeight="700" textAlign="right">
        {value}
      </Text>
    </XStack>
  );
}
