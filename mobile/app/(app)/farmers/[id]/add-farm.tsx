import { enqueueFarm } from '@/lib/syncWithServer';
import { api } from '@/lib/api';
import { locationsCache$ } from '@/store/observable';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { Appbar, Banner, Button, Text, TextInput, ActivityIndicator } from 'react-native-paper';
import * as Location from 'expo-location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { appbarHeight, colors, scrollPaddingKeyboard } from '@/constants/theme';
import { useKenyaLocation } from '@/hooks/useKenyaLocation';

type LocationState = {
  regions: { id: number; name: string }[];
  counties: { id: number; region_id: number; name: string }[];
  sub_counties: { id: number; county_id: number; name: string }[];
};

export default function AddFarmScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: farmerId } = useLocalSearchParams<{ id: string }>();
  const [locations, setLocations] = useState<LocationState | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  const [regionId, setRegionId] = useState<number | null>(null);
  const [countyId, setCountyId] = useState<number | null>(null);
  const [subCountyId, setSubCountyId] = useState<number | null>(null);
  const [village, setVillage] = useState('');
  const [farmLat, setFarmLat] = useState('');
  const [farmLon, setFarmLon] = useState('');
  const [plotSize, setPlotSize] = useState('');
  const [farmCropType, setFarmCropType] = useState('');
  const hasAutoFilledLocation = useRef(false);
  const hasAutoFilledCoords = useRef(false);

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
        setError('Load locations when online first, then you can add farm offline.');
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

  // Auto-fill farm latitude and longitude from GPS when coords are available
  useEffect(() => {
    if (hasAutoFilledCoords.current || !gpsLocation.coords) return;
    hasAutoFilledCoords.current = true;
    setFarmLat(String(gpsLocation.coords.latitude));
    setFarmLon(String(gpsLocation.coords.longitude));
  }, [gpsLocation.coords]);

  /** Get current device position for GPS validation (officer must be at farm). */
  const getDeviceLocation = useCallback(async (): Promise<{ latitude: number; longitude: number }> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission is required to add a farm.');
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  }, []);

  const submit = useCallback(async () => {
    if (!farmerId) {
      setError('Farmer not found.');
      return;
    }
    if (!regionId || !countyId || !subCountyId) {
      setError('Select region, county and sub-county.');
      return;
    }
    if (!village.trim()) {
      setError('Village is required.');
      return;
    }
    const farmLatNum = parseFloat(farmLat);
    const farmLonNum = parseFloat(farmLon);
    if (Number.isNaN(farmLatNum) || Number.isNaN(farmLonNum)) {
      setError('Enter valid latitude and longitude.');
      return;
    }
    if (farmLatNum < -90 || farmLatNum > 90) {
      setError('Latitude must be between -90 and 90.');
      return;
    }
    if (farmLonNum < -180 || farmLonNum > 180) {
      setError('Longitude must be between -180 and 180.');
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
        setError('Connect to load locations first, then you can add a farm offline.');
        setSubmitting(false);
        return;
      }
      try {
        await enqueueFarm({
          farmer_id: farmerId,
          region_id: regionId,
          county_id: countyId,
          sub_county_id: subCountyId,
          village: village.trim(),
          latitude: farmLatNum,
          longitude: farmLonNum,
          plot_size: plotSize.trim() || undefined,
          crop_type: farmCropType.trim() || undefined,
          device_latitude: deviceLat,
          device_longitude: deviceLon,
        });
        Alert.alert('Saved offline', 'Farm will sync when you are back online.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
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
      await api.createFarm({
        farmer_id: farmerId,
        region_id: regionId,
        county_id: countyId,
        sub_county_id: subCountyId,
        village: village.trim(),
        latitude: farmLatNum,
        longitude: farmLonNum,
        plot_size: plotSize.trim() || undefined,
        crop_type: farmCropType.trim() || undefined,
        device_latitude: deviceLat,
        device_longitude: deviceLon,
      });
      Alert.alert('Success', 'Farm added.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add farm');
    } finally {
      setSubmitting(false);
    }
  }, [
    farmerId,
    locations,
    regionId,
    countyId,
    subCountyId,
    village,
    farmLat,
    farmLon,
    plotSize,
    farmCropType,
    router,
    isOnline,
    getDeviceLocation,
  ]);

  const counties = locations ? locations.counties.filter((c) => c.region_id === regionId) : [];
  const subCounties = locations
    ? locations.sub_counties.filter((s) => s.county_id === countyId)
    : [];

  if (loadingLocations) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Add farm" />
        </Appbar.Header>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Add farm" />
      </Appbar.Header>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + appbarHeight}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPaddingKeyboard + Math.max(insets.bottom, 24), flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {isOnline === false && (
            <Banner visible style={styles.banner}>
              Offline — farm will sync when back online.
            </Banner>
          )}
          {(gpsLocation.status === 'locating' || gpsLocation.status === 'geocoding') && (
            <Banner visible style={styles.banner}>
              <View style={styles.bannerRow}>
                <ActivityIndicator size="small" />
                <Text variant="bodySmall">
                  {gpsLocation.status === 'locating' ? 'Getting GPS…' : 'Identifying your location…'}
                </Text>
              </View>
            </Banner>
          )}
          {gpsLocation.status === 'done' && gpsLocation.detectedRegion && !gpsLocation.isOutsideKenya && hasAutoFilledLocation.current && (
            <Banner visible style={[styles.banner, { backgroundColor: '#E6F4EA' }]}>
              <Text variant="bodySmall">
                {gpsLocation.detectedSubcounty
                  ? 'Region, county, and sub-county set from your GPS location and cannot be changed.'
                  : 'Region and county set from your GPS location. Select sub-county below if not detected.'}
              </Text>
            </Banner>
          )}
          {gpsLocation.errorMessage ? (
            <Banner visible style={[styles.banner, { backgroundColor: '#FEE2E2' }]} actions={[{ label: 'Retry', onPress: gpsLocation.refresh }]}>
              <Text variant="bodySmall">{gpsLocation.errorMessage}</Text>
            </Banner>
          ) : null}
          <Text variant="bodyMedium" style={styles.hint}>
            Add a new farm location. Village is required.
          </Text>

          {locations && (
            <>
              <Text variant="labelLarge" style={styles.label}>Region *</Text>
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
                  <Text variant="labelLarge" style={styles.label}>County *</Text>
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
                  <Text variant="labelLarge" style={styles.label}>Sub-county *</Text>
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
          <View style={styles.row}>
            <TextInput
              label="Latitude *"
              value={farmLat}
              onChangeText={setFarmLat}
              keyboardType="decimal-pad"
              mode="outlined"
              style={[styles.input, styles.flex]}
            />
            <TextInput
              label="Longitude *"
              value={farmLon}
              onChangeText={setFarmLon}
              keyboardType="decimal-pad"
              mode="outlined"
              style={[styles.input, styles.flex]}
            />
          </View>
          <TextInput
            label="Plot size"
            value={plotSize}
            onChangeText={setPlotSize}
            mode="outlined"
            style={styles.input}
            placeholder="e.g. 2 acres"
          />
          <TextInput
            label="Crop type"
            value={farmCropType}
            onChangeText={setFarmCropType}
            mode="outlined"
            style={styles.input}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            <Button
              mode="contained"
              onPress={submit}
              loading={submitting}
              disabled={
                submitting ||
                !regionId ||
                !countyId ||
                !subCountyId ||
                !village.trim()
              }
            >
              Add farm
            </Button>
            <Button mode="text" onPress={() => router.back()}>
              Cancel
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  banner: { marginBottom: 12 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hint: { marginBottom: 16, opacity: 0.85 },
  label: { marginTop: 12, marginBottom: 6 },
  input: { marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  locationBtn: { marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { margin: 0 },
  errorText: { color: colors.error, marginVertical: 8 },
  actions: { gap: 8, marginTop: 20 },
});
