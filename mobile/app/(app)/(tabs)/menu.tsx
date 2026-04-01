import { Redirect } from 'expo-router';

/** Tab exists only to host a "More" bar button that opens the drawer; normal use never navigates here. */
export default function MenuTabPlaceholder() {
  return <Redirect href="/(app)/(tabs)" />;
}
