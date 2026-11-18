// One typed navigation ref for the whole app, plus safe helpers that do
// nothing until the navigator is mounted (during startup the loading screen
// is shown instead).
import { createNavigationContainerRef } from '@react-navigation/native';

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  Wake: undefined;
  Reveal: undefined;
  Verify: undefined;
  Success: undefined;
  Settings: undefined;
  AlarmsList: undefined;
  EditAlarm: undefined;
  History: undefined;
  Premium: undefined;
};

export type RouteName = keyof RootStackParamList;

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigate(name: RouteName): void {
  if (navigationRef.isReady()) navigationRef.navigate(name);
}

export function goBack(): void {
  if (navigationRef.isReady() && navigationRef.canGoBack()) navigationRef.goBack();
}
