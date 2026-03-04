import { api } from '@/lib/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Appbar, Button, Text, TextInput, ActivityIndicator } from 'react-native-paper';
import * as Location from 'expo-location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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

  const [regionId, setRegionId] = useState<number | null>(null);
  const [countyId, setCountyId] = useState<number | null>(null);
  const [subCountyId, setSubCountyId] = useState<number | null>(null);
  const [village, setVillage] = useState('');
  const [farmLat, setFarmLat] = useState('');
  const [farmLon, setFarmLon] = useState('');
  const [plotSize, setPlotSize] = useState('');
  const [farmCropType, setFarmCropType] = useState('');

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

  const getCurrentLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', 'Location permission is required.');
      return;
    }
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setFarmLat(String(loc.coords.latitude));
      setFarmLon(String(loc.coords.longitude));
    } catch {
      Alert.alert('Error', 'Could not get location.');
    }
  }, []);

  const submit = useCallback(async () => {
    if (!farmerId) {
      setError('Farmer not found.');
      return;
    }
    if (!locations) return;
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
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 320 + Math.max(insets.bottom, 24) }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="bodyMedium" style={styles.hint}>
            Add a new farm location for this farmer.
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
                  <Text variant="labelLarge" style={styles.label}>County *</Text>
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
                  <Text variant="labelLarge" style={styles.label}>Sub-county *</Text>
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
          <Button mode="outlined" onPress={getCurrentLocation} style={styles.locationBtn}>
            Use my location
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hint: { marginBottom: 16, opacity: 0.85 },
  label: { marginTop: 12, marginBottom: 6 },
  input: { marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  locationBtn: { marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { margin: 0 },
  errorText: { color: '#b00020', marginVertical: 8 },
  actions: { gap: 8, marginTop: 20 },
});
