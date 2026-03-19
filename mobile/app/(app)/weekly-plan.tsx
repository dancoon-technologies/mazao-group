import { Redirect } from 'expo-router';

/** Redirects to Propose schedule with weekly mode (for old links / bookmarks). */
export default function WeeklyPlanRedirect() {
  return (
    <Redirect
      href={{
        pathname: '/(app)/propose-schedule',
        params: { planMode: 'weekly' },
      }}
    />
  );
}
