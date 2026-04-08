import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Banner, Button, Dialog, Portal, Snackbar, Text, TextInput, ActivityIndicator, SegmentedButtons, useTheme } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { createOrUpdateFarmer, createOrUpdateFarm } from '@/database';
import { normalizeServerFarmer, normalizeServerFarm } from '@/database/helpers';
import { enqueueFarmerWithFarm } from '@/lib/syncWithServer';
import { api, getLabels } from '@/lib/api';
import { appMeta$, locationsCache$ } from '@/store/observable';
import { useSelector } from '@legendapp/state/react';
import { useKenyaLocation } from '@/hooks/useKenyaLocation';

type LocationState = {
  regions: { id: number; name: string }[];
  counties: { id: number; region_id: number; name: string }[];
  sub_counties: { id: number; county_id: number; name: string }[];
};

import { colors, scrollPaddingKeyboard } from '@/constants/theme';

export default function AddFarmerScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const params = useLocalSearchParams<{ returnTo?: string; asStockist?: string; asGroup?: string; asSacco?: string }>();
  const returnTo = params.returnTo;
  const isSacco = params.asSacco === '1' || params.asSacco === 'true';
  const isStockist = !isSacco && (params.asStockist === '1' || params.asStockist === 'true');
  const isGroup = !isStockist && (params.asGroup === '1' || params.asGroup === 'true');
  const usesSingleName = isStockist || isSacco || isGroup;
  const partnerKindLabel = isSacco ? 'SACCO' : isStockist ? 'Stockist' : isGroup ? 'Farmers group' : 'Farmer';
  const labels = useSelector(() => getLabels(appMeta$.cachedOptions.get()));
  const locationLabel = (isStockist || isSacco) ? 'Outlet' : labels.location;

  useEffect(() => {
    navigation.setOptions({ title: isSacco ? 'Add SACCO' : isStockist ? 'Add stockist' : isGroup ? 'Add farmers group' : 'Add farmer' });
  }, [navigation, isGroup, isStockist, isSacco]);
  const [locations, setLocations] = useState<LocationState | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogSuccess, setDialogSuccess] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [snackbarMsg, setSnackbarMsg] = useState('');

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');

  const [regionId, setRegionId] = useState<number | null>(null);
  const [countyId, setCountyId] = useState<number | null>(null);
  const [subCountyId, setSubCountyId] = useState<number | null>(null);
  const [village, setVillage] = useState('');
  const [farmLat, setFarmLat] = useState('');
  const [farmLon, setFarmLon] = useState('');
  const [plotSize, setPlotSize] = useState('');
  const [farmCropType, setFarmCropType] = useState('');
  const hasAutoFilledLocation = useRef(false);
  const hasAutoFilledFarmCoords = useRef(false);

  const gpsLocation = useKenyaLocation(true);

  const loadLocations = useCallback(async () => {
    try {
      const data = await api.getLocations();
      locationsCache$.set(data);
      setLocations({
        regions: data.regions,
        counties: data.counties,
        sub_counties: data.sub_counties,
      });
      setError('');
    } catch {
      const cached = locationsCache$.get();
      if (cached) {
        setLocations({
          regions: cached.regions,
          counties: cached.counties,
          sub_counties: cached.sub_counties,
        });
        setError('');
      } else {
        setError(`Load locations when online first, then you can add ${labels.partner.toLowerCase()} and ${locationLabel.toLowerCase()} offline.`);
      }
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => setIsOnline(state.isConnected ?? false));
    return () => sub();
  }, []);

  // Auto-fill region, county, subcounty from GPS when locations and detection are ready
  useEffect(() => {
    if (!locations || gpsLocation.status !== 'done' || !gpsLocation.detectedRegion || gpsLocation.isOutsideKenya) return;
    if (hasAutoFilledLocation.current) return;
    const region = locations.regions.find((r) => r.name === gpsLocation.detectedRegion);
    if (!region) return;
    const county = locations.counties.find(
      (c) => c.name === gpsLocation.detectedCounty && c.region_id === region.id
    );
    if (!county) return;
    hasAutoFilledLocation.current = true;
    setRegionId(region.id);
    setCountyId(county.id);
    if (gpsLocation.detectedSubcounty) {
      const sub = locations.sub_counties.find(
        (s) => s.name === gpsLocation.detectedSubcounty && s.county_id === county.id
      );
      if (sub) setSubCountyId(sub.id);
    }
  }, [locations, gpsLocation.status, gpsLocation.detectedRegion, gpsLocation.detectedCounty, gpsLocation.detectedSubcounty, gpsLocation.isOutsideKenya]);

  // Auto-fill hidden farmer/farm coordinates from GPS when coords are available
  useEffect(() => {
    if (!gpsLocation.coords) return;
    if (!lat || !lon) {
      setLat(String(gpsLocation.coords.latitude));
      setLon(String(gpsLocation.coords.longitude));
    }
    if (hasAutoFilledFarmCoords.current) return;
    hasAutoFilledFarmCoords.current = true;
    setFarmLat(String(gpsLocation.coords.latitude));
    setFarmLon(String(gpsLocation.coords.longitude));
  }, [gpsLocation.coords, lat, lon]);

  /** Get current device position for farm GPS validation. */
  const getDeviceLocation = useCallback(async (): Promise<{ latitude: number; longitude: number }> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission is required to add a farm.');
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  }, []);

  const submit = useCallback(async () => {
    if (usesSingleName && !firstName.trim()) {
      setError(`${partnerKindLabel} name is required.`);
      return;
    }
    if (!usesSingleName && (!firstName.trim() || !lastName.trim())) {
      setError('First name and last name are required.');
      return;
    }
    if (!regionId || !countyId || !subCountyId) {
      setError('Select region, county, and sub-county.');
      return;
    }
    if (!village.trim()) {
      setError('Village is required.');
      return;
    }
    const farmLatNum = parseFloat(farmLat);
    const farmLonNum = parseFloat(farmLon);
    if (Number.isNaN(farmLatNum) || Number.isNaN(farmLonNum)) {
      setError(`${locationLabel} location (latitude and longitude) is required.`);
      return;
    }
    if (farmLatNum < -90 || farmLatNum > 90) {
      setError(`${locationLabel} latitude must be between -90 and 90.`);
      return;
    }
    if (farmLonNum < -180 || farmLonNum > 180) {
      setError(`${labels.location} longitude must be between -180 and 180.`);
      return;
    }
    setSubmitting(true);
    setError('');
    let deviceLat: number | undefined;
    let deviceLon: number | undefined;
    try {
      const device = await getDeviceLocation();
      deviceLat = device.latitude;
      deviceLon = device.longitude;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get your location.');
      setSubmitting(false);
      return;
    }
    if (isOnline === false) {
      if (!locations) {
        setError(`Connect to load locations first, then you can add ${labels.partner.toLowerCase()} and ${locationLabel.toLowerCase()} offline.`);
        setSubmitting(false);
        return;
      }
      try {
        const farmerLatNum = lat ? parseFloat(lat) : 0;
        const farmerLonNum = lon ? parseFloat(lon) : 0;
        await enqueueFarmerWithFarm({
          farmer: {
            first_name: firstName.trim(),
            middle_name: usesSingleName ? undefined : (middleName.trim() || undefined),
            last_name: usesSingleName ? '' : lastName.trim(),
            phone: phone.trim() || undefined,
            latitude: Number.isNaN(farmerLatNum) ? 0 : farmerLatNum,
            longitude: Number.isNaN(farmerLonNum) ? 0 : farmerLonNum,
            is_stockist: isStockist,
            is_sacco: isSacco,
            is_group: isGroup,
          },
          farm: {
            region_id: regionId,
            county_id: countyId,
            sub_county_id: subCountyId,
            village: village.trim(),
            latitude: farmLatNum,
            longitude: farmLonNum,
            plot_size: (isStockist || isSacco) ? undefined : (plotSize.trim() || undefined),
            device_latitude: deviceLat,
            device_longitude: deviceLon,
          },
        });
        setSnackbarMsg('Saved for sync when online.');
        setTimeout(() => router.back(), 1500);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save for sync');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!locations) {
      setSubmitting(false);
      return;
    }
    try {
      const farmerLatNum = lat ? parseFloat(lat) : 0;
      const farmerLonNum = lon ? parseFloat(lon) : 0;
      const farmer = await api.createFarmer({
        first_name: firstName.trim(),
        middle_name: usesSingleName ? undefined : (middleName.trim() || undefined),
        last_name: usesSingleName ? '' : lastName.trim(),
        phone: phone.trim() || undefined,
        latitude: isNaN(farmerLatNum) ? 0 : farmerLatNum,
        longitude: isNaN(farmerLonNum) ? 0 : farmerLonNum,
        is_stockist: isStockist,
        is_sacco: isSacco,
        is_group: isGroup,
      });

      const farmerId = farmer?.id;
      if (!farmerId) {
        setError('Server did not return the new farmer. Please try again.');
        return;
      }

      const farm = await api.createFarm({
        farmer_id: farmerId,
        region_id: regionId,
        county_id: countyId,
        sub_county_id: subCountyId,
        village: village.trim(),
        latitude: farmLatNum,
        longitude: farmLonNum,
        plot_size: (isStockist || isSacco) ? undefined : (plotSize.trim() || undefined),
        device_latitude: deviceLat,
        device_longitude: deviceLon,
      });

      if (returnTo === 'record-visit') {
        await createOrUpdateFarmer(normalizeServerFarmer(farmer as unknown as Record<string, unknown>));
        await createOrUpdateFarm(normalizeServerFarm(farm as unknown as Record<string, unknown>));
      }

      if (returnTo === 'propose-schedule') {
        router.replace({ pathname: '/(app)/propose-schedule', params: { selectedFarmerId: farmerId } });
        return;
      }
      if (returnTo === 'record-visit') {
        router.replace({ pathname: '/(app)/record-visit', params: { farmerId } });
        return;
      }

      setDialogSuccess(true);
      setDialogVisible(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : (isSacco ? 'Failed to add SACCO' : isStockist ? 'Failed to add stockist' : 'Failed to add farmer'));
      setDialogSuccess(false);
      setDialogVisible(true);
    } finally {
      setSubmitting(false);
    }
  }, [
    firstName,
    lastName,
    locations,
    regionId,
    countyId,
    subCountyId,
    village,
    farmLat,
    farmLon,
    lat,
    getDeviceLocation,
    lon,
    middleName,
    phone,
    plotSize,
    farmCropType,
    router,
    returnTo,
    isOnline,
    isStockist,
    isSacco,
    isGroup,
    usesSingleName,
    partnerKindLabel,
  ]);

  const counties = locations
    ? locations.counties.filter((c) => c.region_id === regionId)
    : [];
  const subCounties = locations
    ? locations.sub_counties.filter((s) => s.county_id === countyId)
    : [];

  if (loadingLocations) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const scrollPaddingBottom = scrollPaddingKeyboard + Math.max(insets.bottom, 24);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPaddingBottom, flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        {isOnline === false && (
          <Banner visible style={styles.banner}>
            {`Offline — ${labels.partner.toLowerCase()} and ${locationLabel.toLowerCase()} will sync when back online.`}
          </Banner>
        )}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {partnerKindLabel} details
        </Text>
        {!isStockist && !isSacco && (
          <SegmentedButtons
            value={isGroup ? 'group' : 'farmer'}
            onValueChange={(value) => {
              if (value === 'group') {
                router.setParams({ asGroup: 'true' });
              } else {
                router.setParams({ asGroup: 'false' });
              }
            }}
            style={styles.typeSwitch}
            buttons={[
              { value: 'farmer', label: 'Farmer' },
              { value: 'group', label: 'Farmers Group' },
            ]}
          />
        )}
        <TextInput
          label={usesSingleName ? 'Name *' : 'First name *'}
          value={firstName}
          onChangeText={setFirstName}
          mode="outlined"
          style={styles.input}
        />
        {!usesSingleName ? (
          <>
            <TextInput
              label="Middle name"
              value={middleName}
              onChangeText={setMiddleName}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Last name *"
              value={lastName}
              onChangeText={setLastName}
              mode="outlined"
              style={styles.input}
            />
          </>
        ) : null}
        <TextInput
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          mode="outlined"
          style={styles.input}
        />
        <Text variant="titleMedium" style={styles.sectionTitle}>
          First {locationLabel.toLowerCase()} (required)
        </Text>
        {(gpsLocation.status === 'locating' || gpsLocation.status === 'geocoding') && (
          <Banner visible style={styles.banner}>
            <View style={styles.bannerRow}>
              <ActivityIndicator size="small" />
              <Text variant="bodySmall">
                {gpsLocation.status === 'locating' ? 'Getting GPS…' : 'Checking area…'}
              </Text>
            </View>
          </Banner>
        )}
        {gpsLocation.status === 'done' && gpsLocation.detectedRegion && !gpsLocation.isOutsideKenya && hasAutoFilledLocation.current && (
          <Banner visible style={[styles.banner, { backgroundColor: '#E6F4EA' }]}>
            <Text variant="bodySmall">
              {gpsLocation.detectedSubcounty
                ? 'Region/county/sub-county auto-set from GPS.'
                : 'Region/county auto-set from GPS. Pick sub-county if needed.'}
            </Text>
          </Banner>
        )}
        {gpsLocation.errorMessage ? (
          <Banner visible style={[styles.banner, { backgroundColor: '#FEE2E2' }]} actions={[{ label: 'Retry', onPress: gpsLocation.refresh }]}>
            <Text variant="bodySmall">{gpsLocation.errorMessage}</Text>
          </Banner>
        ) : null}
        <Text variant="bodySmall" style={styles.hint}>
          Pick region, county, and sub-county.
        </Text>
        {locations && (
          <>
            <Text variant="labelMedium" style={styles.label}>Region</Text>
            <View style={styles.chipRow}>
              {locations.regions.map((r) => (
                <Button
                  key={r.id}
                  mode={regionId === r.id ? 'contained' : 'outlined'}
                  compact
                  onPress={() => {
                    if (hasAutoFilledLocation.current) return;
                    setRegionId(r.id);
                    setCountyId(null);
                    setSubCountyId(null);
                  }}
                  style={styles.chip}
                  disabled={hasAutoFilledLocation.current && regionId !== r.id}
                >
                  {r.name}
                </Button>
              ))}
            </View>
            {regionId !== null && (
              <>
                <Text variant="labelMedium" style={styles.label}>County</Text>
                <View style={styles.chipRow}>
                  {counties.map((c) => (
                    <Button
                      key={c.id}
                      mode={countyId === c.id ? 'contained' : 'outlined'}
                      compact
                      onPress={() => {
                        if (hasAutoFilledLocation.current) return;
                        setCountyId(c.id);
                        setSubCountyId(null);
                      }}
                      style={styles.chip}
                      disabled={hasAutoFilledLocation.current && countyId !== c.id}
                    >
                      {c.name}
                    </Button>
                  ))}
                </View>
              </>
            )}
            {countyId !== null && (
              <>
                <Text variant="labelMedium" style={styles.label}>Sub-county</Text>
                <View style={styles.chipRow}>
                  {subCounties.map((s) => {
                    const subcountyLockedByGps = hasAutoFilledLocation.current && !!gpsLocation.detectedSubcounty;
                    return (
                      <Button
                        key={s.id}
                        mode={subCountyId === s.id ? 'contained' : 'outlined'}
                        compact
                        onPress={() => {
                          if (subcountyLockedByGps) return;
                          setSubCountyId(s.id);
                        }}
                        style={styles.chip}
                        disabled={subcountyLockedByGps && subCountyId !== s.id}
                      >
                        {s.name}
                      </Button>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
        <TextInput
          label="Village *"
          value={village}
          onChangeText={setVillage}
          mode="outlined"
          style={styles.input}
        />
        <Text variant="bodySmall" style={styles.hint}>
          {`${locationLabel} coordinates are captured automatically from your device location.`}
        </Text>
        {!isStockist && !isSacco && (
          <TextInput
            label="Plot size"
            value={plotSize}
            onChangeText={setPlotSize}
            mode="outlined"
            style={styles.input}
            placeholder="e.g. 2 acres"
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={submit}
            loading={submitting}
            disabled={submitting || !firstName.trim() || (!usesSingleName && !lastName.trim()) || !regionId || !countyId || !subCountyId || !village.trim()}
          >
            {isSacco ? 'Add SACCO' : isStockist ? 'Add stockist' : isGroup ? 'Add farmers group' : 'Add farmer'}
          </Button>
          <Button mode="text" onPress={() => router.back()}>
            Cancel
          </Button>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); setSubmitError(''); router.back(); }}>
          <Dialog.Icon icon={dialogSuccess ? 'check-circle' : 'alert'} color={dialogSuccess ? theme.colors.primary : theme.colors.error} />
          <Dialog.Title>{dialogSuccess ? 'Success' : 'Error'}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {dialogSuccess
                ? `${isSacco ? 'SACCO' : isStockist ? 'Stockist' : isGroup ? 'Farmers group' : 'Farmer'} and ${locationLabel.toLowerCase()} added.`
                : (submitError || (isSacco ? 'Failed to add SACCO.' : isStockist ? 'Failed to add stockist.' : isGroup ? 'Failed to add farmers group.' : 'Failed to add farmer.'))}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setDialogVisible(false); setSubmitError(''); router.back(); }}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={!!snackbarMsg}
        onDismiss={() => setSnackbarMsg('')}
        duration={4000}
        wrapperStyle={[styles.snackbarWrapper, { top: insets.top }]}
      >
        {snackbarMsg}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  snackbarWrapper: { position: 'absolute', left: 0, right: 0 },
  container: { flex: 1 },
  scroll: { flex: 1 },
  banner: { marginBottom: 12 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { marginTop: 16, marginBottom: 8 },
  typeSwitch: { marginBottom: 10 },
  hint: { marginBottom: 8, opacity: 0.8 },
  label: { marginTop: 8, marginBottom: 4 },
  input: { marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { margin: 0 },
  error: { color: colors.error, marginVertical: 8 },
  actions: { gap: 8, marginTop: 16 },
});
