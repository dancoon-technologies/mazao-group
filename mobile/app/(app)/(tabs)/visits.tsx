import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TextInput } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import { RelativePathString, useRouter } from 'expo-router';
import { api, type Schedule } from '@/lib/api';

export default function VisitsScreen() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSchedules = useCallback(async () => {
    try {
      const data = await api.getSchedules();
      setSchedules(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  // Filtered farmers by search query
  const filteredSchedules = schedules.filter(
    (s) =>
      s.farmer_display_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      (s.farmer?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {/* Search Bar */}
      <TextInput
        placeholder="Search farmers..."
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
      />

      {/* Farmer Cards */}
      {loading ? (
        <Text>Loading farmers...</Text>
      ) : filteredSchedules.length === 0 ? (
        <Text>No schedules found</Text>
      ) : (
        filteredSchedules.map((s) => (
          <Card key={s.id} style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Text variant="titleMedium">{s.farmer_display_name}</Text>
              </View>
              <Text>ID: {s.id}</Text>
              {s.notes && <Text>📍 {s.notes}</Text>}
            </Card.Content>
            <Card.Actions>
              <Button
                mode="contained"
                onPress={() =>
                  router.push(`/(app)/(tabs)/visits/${s.id}` as RelativePathString)
                }
              >
                Start Visit
              </Button>
            </Card.Actions>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#2e7d32',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  card: {
    marginBottom: 12,
    borderRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  visitedChip: {
    backgroundColor: '#dcedc8',
    color: '#33691e',
    height: 24,
  },
  lastVisit: {
    marginTop: 4,
    fontStyle: 'italic',
    color: '#555',
  },
});
