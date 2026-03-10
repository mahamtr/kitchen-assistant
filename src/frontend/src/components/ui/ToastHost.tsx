import { useEffect } from 'react';
import { Pressable } from 'react-native';
import { Paragraph, Text, YStack } from 'tamagui';
import { palette } from './primitives';
import { useUiStore } from '../../lib/store/uiStore';

function toneColors(tone: 'success' | 'warning' | 'error') {
  if (tone === 'success') {
    return {
      borderColor: palette.successBorder,
      backgroundColor: palette.successSoft,
      titleColor: palette.success,
    };
  }

  if (tone === 'warning') {
    return {
      borderColor: palette.warningBorder,
      backgroundColor: palette.warningSoft,
      titleColor: palette.warning,
    };
  }

  return {
    borderColor: palette.dangerBorder,
    backgroundColor: palette.dangerSoft,
    titleColor: palette.danger,
  };
}

export default function ToastHost() {
  const toasts = useUiStore((state) => state.toasts);
  const dismissToast = useUiStore((state) => state.dismissToast);

  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => {
        dismissToast(toast.id);
      }, 3600),
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [dismissToast, toasts]);

  return (
    <YStack position="absolute" right={16} bottom={110} gap={8} zIndex={40} width={300}>
      {toasts.map((toast) => {
        const colors = toneColors(toast.tone);
        return (
          <Pressable key={toast.id} onPress={() => dismissToast(toast.id)}>
            <YStack
              backgroundColor={colors.backgroundColor}
              borderColor={colors.borderColor}
              borderWidth={1}
              borderRadius={12}
              padding={12}
            >
              <Text color={colors.titleColor} fontSize={14} fontWeight="700">
                {toast.title}
              </Text>
              {toast.description ? (
                <Paragraph color={palette.textSecondary} fontSize={12} lineHeight={18}>
                  {toast.description}
                </Paragraph>
              ) : null}
            </YStack>
          </Pressable>
        );
      })}
    </YStack>
  );
}
