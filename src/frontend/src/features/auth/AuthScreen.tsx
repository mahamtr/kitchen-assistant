import { useState } from 'react';
import { Platform, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Paragraph, Text, XStack, YStack } from 'tamagui';
import { authService } from '../../lib/services';
import {
  ActionButton,
  AppIcon,
  SectionCard,
  TextField,
  palette,
} from '../../components/ui/primitives';
import { useKeyboardMetrics } from '../../hooks/useKeyboardVisible';

type AuthMode = 'login' | 'signup' | 'reset';

export default function AuthScreen({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { keyboardHeight } = useKeyboardMetrics();

  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const isReset = mode === 'reset';

  const title = isLogin ? 'Sign in' : isSignup ? 'Create account' : 'Reset password';
  const subtitle = isLogin
    ? 'Use your email and password'
    : isSignup
      ? 'Set up your account to start planning and cooking'
      : 'Start with email recovery, then set a new password from your recovery session';

  const submit = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      if (isLogin) {
        await authService.signIn({ email, password });
        router.replace('/');
        return;
      }

      if (isSignup) {
        const result = await authService.signUp({ fullName, email, password });
        if (result.session) {
          router.replace('/');
        } else {
          setMessage('Account created. Check your email to verify your address, then sign in.');
        }
        return;
      }

      if (password || confirmPassword) {
        const result = await authService.updatePassword({
          newPassword: password,
          confirmPassword,
        });
        setMessage(result.message);
      } else {
        const result = await authService.requestPasswordReset({ email });
        setMessage(result.message);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const continueWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.signInWithGoogle();
      setMessage('Google sign-in was opened through Supabase.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <YStack flex={1} backgroundColor={palette.background} paddingBottom={keyboardHeight}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 28,
          paddingBottom: 56,
          gap: 14,
        }}
      >
          <YStack gap={6}>
            <Text color={palette.text} fontSize={34} lineHeight={36} fontWeight="700">
              Kitchen Assistant
            </Text>
          </YStack>

          {!isReset ? (
            <SectionCard>
              <XStack gap={10} alignItems="flex-start">
                <YStack paddingTop={2}>
                  <AppIcon name="lock-outline" size={16} color={palette.primary} />
                </YStack>
                <YStack flex={1} gap={4}>
                  <Text color={palette.text} fontSize={14} fontWeight="700">
                    Your AI cooking assistant
                  </Text>
                  <Paragraph color={palette.textSecondary} fontSize={13} lineHeight={18}>
                    Plan meals, track kitchen items, and get recipe guidance.
                  </Paragraph>
                </YStack>
              </XStack>
            </SectionCard>
          ) : null}

          <SectionCard>
            <Text color={palette.text} fontSize={24} fontWeight="700">
              {title}
            </Text>
            <Paragraph color={palette.textSecondary} fontSize={13} lineHeight={18}>
              {subtitle}
            </Paragraph>

            {isSignup ? (
              <TextField
                label="Full name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
              />
            ) : null}

            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
            />

            {isReset ? (
              <YStack gap={8}>
                <TextField
                  label="New password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="New password"
                  secureTextEntry
                />
                <TextField
                  label="Confirm new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repeat password"
                  secureTextEntry
                />
              </YStack>
            ) : (
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
              />
            )}

            {isLogin ? (
              <Pressable onPress={() => router.push('/reset-password')} style={{ alignSelf: 'flex-end' }}>
                <Text color={palette.primary} fontSize={12} fontWeight="700">
                  Reset password
                </Text>
              </Pressable>
            ) : null}

            {message ? (
              <SectionCard tone="success">
                <Text color={palette.success} fontSize={13} fontWeight="700">
                  {message}
                </Text>
              </SectionCard>
            ) : null}

            {error ? (
              <SectionCard tone="danger">
                <Text color={palette.danger} fontSize={13} fontWeight="700">
                  {error}
                </Text>
              </SectionCard>
            ) : null}

            <ActionButton
              onPress={submit}
              disabled={
                loading ||
                !email ||
                (isLogin && !password) ||
                (isSignup && (!password || !fullName)) ||
                (isReset && !email)
              }
            >
              {loading ? 'Working...' : isLogin ? 'Sign in' : isSignup ? 'Create account' : 'Send / Update password'}
            </ActionButton>

            {!isReset ? (
              <>
                <Paragraph color={palette.textMuted} textAlign="center" fontSize={12}>
                  or
                </Paragraph>
                <ActionButton variant="secondary" onPress={continueWithGoogle} disabled={loading}>
                  Continue with Google
                </ActionButton>
              </>
            ) : null}

            <ActionButton
              variant="ghost"
              onPress={() => router.push(isLogin ? '/signup' : '/login')}
              disabled={loading}
            >
              {isLogin ? 'Create account' : 'Already have an account? Sign in'}
            </ActionButton>
          </SectionCard>

          {isSignup ? (
            <SectionCard tone="warning">
              <Text color={palette.text} fontSize={14} fontWeight="700">
                What happens next
              </Text>
              <Paragraph color={palette.textSecondary} fontSize={13} lineHeight={18}>
                After authentication, the app takes you through onboarding and seeds the planner, kitchen, OCR, and
                recipe flows with mock data.
              </Paragraph>
            </SectionCard>
          ) : null}

          <Paragraph color={palette.textMuted} fontSize={13} lineHeight={18} textAlign="center">
            By continuing, you agree to Terms and Privacy Policy.
          </Paragraph>
      </ScrollView>
    </YStack>
  );
}
