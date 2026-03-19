import { Redirect } from 'expo-router';

/** @deprecated Use Propose schedule → Weekly routes. Kept for old links/bookmarks. */
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
