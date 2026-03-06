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
import { Banner, Button, Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { createOrUpdateFarmer, createOrUpdateFarm } from '@/database';
import { normalizeServerFarmer, normalizeServerFarm } from '@/database/helpers';
import { enqueueFarmerWithFarm } from '@/lib/syncWithServer';
import { api } from '@/lib/api';
import { useKenyaLocation } from '@/hooks/useKenyaLocation';

type LocationState = {
  regions: { id: number; name: string }[];
  counties: { id: number; region_id: number; name: string }[];
  sub_counties: { id: number; county_id: number; name: string }[];
};

import { scrollPaddingKeyboard } from '@/constants/theme';

export default function AddFarmerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = params.returnTo;
  const [locations, setLocations] = useState<LocationState | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [cropType, setCropType] = useState('');
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
  const [useGpsCoordsForFarm, setUseGpsCoordsForFarm] = useState(false);
  const hasAutoFilledLocation = useRef(false);

  const gpsLocation = useKenyaLocation(true);

  const loadLocations = useCallback(async () => {
    try {
      const data = await api.getLocations();
      setLocations({
        regions: data.regions,
        counties: data.counties,
        sub_counties: data.sub_counties,
      });
    } catch {
      setError('Failed to load locations');
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

  // When user taps "Use my location for farm", refresh runs; then sync coords to farm lat/lon
  useEffect(() => {
    if (!useGpsCoordsForFarm || !gpsLocation.coords) return;
    setFarmLat(String(gpsLocation.coords.latitude));
    setFarmLon(String(gpsLocation.coords.longitude));
    setUseGpsCoordsForFarm(false);
  }, [useGpsCoordsForFarm, gpsLocation.coords]);

  const getCurrentLocation = useCallback(async (forFarm: boolean) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', 'Location permission is required.');
      return;
    }
    try {
      if (forFarm) {
        setUseGpsCoordsForFarm(true);
        await gpsLocation.refresh();
      } else {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLat(String(loc.coords.latitude));
        setLon(String(loc.coords.longitude));
      }
    } catch {
      Alert.alert('Error', 'Could not get location.');
    }
  }, [gpsLocation.refresh]);

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
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }
    if (!regionId || !countyId || !subCountyId) {
      setError('Select region, county and sub-county for the farm.');
      return;
    }
    if (!village.trim()) {
      setError('Village is required.');
      return;
    }
    const farmLatNum = parseFloat(farmLat);
    const farmLonNum = parseFloat(farmLon);
    if (Number.isNaN(farmLatNum) || Number.isNaN(farmLonNum)) {
      setError('Farm location (latitude and longitude) is required.');
      return;
    }
    if (farmLatNum < -90 || farmLatNum > 90) {
      setError('Farm latitude must be between -90 and 90.');
      return;
    }
    if (farmLonNum < -180 || farmLonNum > 180) {
      setError('Farm longitude must be between -180 and 180.');
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
        setError('Connect to load locations first, then you can add farmer and farm offline.');
        setSubmitting(false);
        return;
      }
      try {
        const farmerLatNum = lat ? parseFloat(lat) : 0;
        const farmerLonNum = lon ? parseFloat(lon) : 0;
        await enqueueFarmerWithFarm({
          farmer: {
            first_name: firstName.trim(),
            middle_name: middleName.trim() || undefined,
            last_name: lastName.trim(),
            phone: phone.trim() || undefined,
            crop_type: cropType.trim() || undefined,
            latitude: Number.isNaN(farmerLatNum) ? 0 : farmerLatNum,
            longitude: Number.isNaN(farmerLonNum) ? 0 : farmerLonNum,
          },
          farm: {
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
          },
        });
        Alert.alert('Saved offline', 'Farmer and farm will sync when you are back online.', [
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
      const farmerLatNum = lat ? parseFloat(lat) : 0;
      const farmerLonNum = lon ? parseFloat(lon) : 0;
      const farmer = await api.createFarmer({
        first_name: firstName.trim(),
        middle_name: middleName.trim() || undefined,
        last_name: lastName.trim(),
        phone: phone.trim() || undefined,
        crop_type: cropType.trim() || undefined,
        latitude: isNaN(farmerLatNum) ? 0 : farmerLatNum,
        longitude: isNaN(farmerLonNum) ? 0 : farmerLonNum,
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
        plot_size: plotSize.trim() || undefined,
        crop_type: farmCropType.trim() || undefined,
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

      Alert.alert('Success', 'Farmer and farm added.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add farmer');
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
    cropType,
    plotSize,
    farmCropType,
    router,
    returnTo,
    isOnline,
  ]);

  const counties = locations
    ? locations.counties.filter((c) => c.region_id === regionId)
    : [];
  const subCounties = locations
    ? locations.sub_counties.filter((s) => s.county_id === countyId)
    : [];

  if (loadingLocations) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const scrollPaddingBottom = scrollPaddingKeyboard + Math.max(insets.bottom, 24);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
            Offline — farmer and farm will sync when back online.
          </Banner>
        )}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Farmer details
        </Text>
        <TextInput
          label="First name *"
          value={firstName}
          onChangeText={setFirstName}
          mode="outlined"
          style={styles.input}
        />
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
        <TextInput
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Crop type"
          value={cropType}
          onChangeText={setCropType}
          mode="outlined"
          style={styles.input}
        />
        <View style={styles.row}>
          <TextInput
            label="Latitude"
            value={lat}
            onChangeText={setLat}
            keyboardType="decimal-pad"
            mode="outlined"
            style={[styles.input, styles.flex]}
          />
          <TextInput
            label="Longitude"
            value={lon}
            onChangeText={setLon}
            keyboardType="decimal-pad"
            mode="outlined"
            style={[styles.input, styles.flex]}
          />
        </View>
        <Button mode="outlined" onPress={() => getCurrentLocation(false)} style={styles.locationBtn}>
          Use my location
        </Button>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          First farm (required)
        </Text>
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
        {gpsLocation.status === 'done' && gpsLocation.detectedRegion && !gpsLocation.isOutsideKenya && (
          <Banner visible style={[styles.banner, { backgroundColor: '#E6F4EA' }]}>
            <Text variant="bodySmall">Region and county set from your location. Change below if needed.</Text>
          </Banner>
        )}
        {gpsLocation.errorMessage ? (
          <Banner visible style={[styles.banner, { backgroundColor: '#FEE2E2' }]} actions={[{ label: 'Retry', onPress: gpsLocation.refresh }]}>
            <Text variant="bodySmall">{gpsLocation.errorMessage}</Text>
          </Banner>
        ) : null}
        <Text variant="bodySmall" style={styles.hint}>
          Select region, then county, then sub-county. Village is required.
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
                    setRegionId(r.id);
                    setCountyId(null);
                    setSubCountyId(null);
                  }}
                  style={styles.chip}
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
                        setCountyId(c.id);
                        setSubCountyId(null);
                      }}
                      style={styles.chip}
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
                  {subCounties.map((s) => (
                    <Button
                      key={s.id}
                      mode={subCountyId === s.id ? 'contained' : 'outlined'}
                      compact
                      onPress={() => setSubCountyId(s.id)}
                      style={styles.chip}
                    >
                      {s.name}
                    </Button>
                  ))}
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
            label="Farm latitude *"
            value={farmLat}
            onChangeText={setFarmLat}
            keyboardType="decimal-pad"
            mode="outlined"
            style={[styles.input, styles.flex]}
          />
          <TextInput
            label="Farm longitude *"
            value={farmLon}
            onChangeText={setFarmLon}
            keyboardType="decimal-pad"
            mode="outlined"
            style={[styles.input, styles.flex]}
          />
        </View>
        <Button mode="outlined" onPress={() => getCurrentLocation(true)} style={styles.locationBtn}>
          Use my location for farm
        </Button>
        <TextInput
          label="Plot size"
          value={plotSize}
          onChangeText={setPlotSize}
          mode="outlined"
          style={styles.input}
          placeholder="e.g. 2 acres"
        />
        <TextInput
          label="Crop type (farm)"
          value={farmCropType}
          onChangeText={setFarmCropType}
          mode="outlined"
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={submit}
            loading={submitting}
            disabled={submitting || !firstName.trim() || !lastName.trim() || !regionId || !countyId || !subCountyId || !village.trim()}
          >
            Add farmer
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
  banner: { marginBottom: 12 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { marginTop: 16, marginBottom: 8 },
  hint: { marginBottom: 8, opacity: 0.8 },
  label: { marginTop: 8, marginBottom: 4 },
  input: { marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  locationBtn: { marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { margin: 0 },
  error: { color: '#b00020', marginVertical: 8 },
  actions: { gap: 8, marginTop: 16 },
});
