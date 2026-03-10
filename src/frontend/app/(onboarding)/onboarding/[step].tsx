import { useLocalSearchParams } from 'expo-router';
import OnboardingScreen from '../../../src/features/onboarding/OnboardingScreen';

export default function OnboardingRoute() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const parsedStep = Number(step ?? '1');

  return <OnboardingScreen step={Number.isNaN(parsedStep) ? 1 : parsedStep} />;
}
