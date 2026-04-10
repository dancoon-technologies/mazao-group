import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/**
 * Payload for login / token refresh so Django can show each user's Expo app version and EAS Update id.
 */
export function getAppClientMetaForApi(): Record<string, string> {
  const expoConfig = Constants.expoConfig;
  const version = String(expoConfig?.version ?? '').trim().slice(0, 32);
  const nativeBuild = String(Constants.nativeBuildVersion ?? '').trim().slice(0, 32);
  let updateId = '';
  let channel = '';
  try {
    updateId = String(Updates.updateId ?? '').trim().slice(0, 80);
    channel = String(Updates.channel ?? '').trim().slice(0, 64);
  } catch {
    /* Expo Go / dev client without updates */
  }
  return {
    app_version: version,
    app_native_build: nativeBuild,
    app_update_id: updateId,
    app_update_channel: channel,
  };
}
