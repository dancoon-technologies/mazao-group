import { Redirect } from 'expo-router';

/**
 * Center tab "Record" — redirects to the full Record Visit screen.
 * The tab bar shows this tab as a FAB (see _layout.tsx).
 */
export default function RecordTabRedirect() {
  return <Redirect href="/(app)/record-visit" />;
}
