import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { getUnsyncedDrafts, markDraftAsSynced, deleteDraft } from '../../src/services/db';
import { submitIssue } from '../../src/services/api';

interface DraftItem {
  id: string;
  payload: any;
}

export default function QueueScreen() {
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const navigation = useNavigation();

  const loadDrafts = async () => {
    try {
      setLoading(true);
      const data = await getUnsyncedDrafts();
      setDrafts(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not load drafts from storage.');
    } finally {
      setLoading(false);
    }
  };

  // Reload drafts when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadDrafts();
    });
    return unsubscribe;
  }, [navigation]);

  const handleSyncAll = async () => {
    if (drafts.length === 0) {
      Alert.alert('Info', 'No offline drafts to synchronize.');
      return;
    }

    setSyncing(true);
    let successCount = 0;
    let failCount = 0;

    for (const draft of drafts) {
      try {
        await submitIssue(draft.payload);
        await markDraftAsSynced(draft.id);
        successCount++;
      } catch (error) {
        console.error(`Failed to sync draft ${draft.id}:`, error);
        failCount++;
      }
    }

    setSyncing(false);
    loadDrafts();

    if (failCount === 0) {
      Alert.alert('Synchronization Complete', `Successfully uploaded ${successCount} reports.`);
    } else {
      Alert.alert(
        'Synchronization Partial',
        `Uploaded: ${successCount}. Failed: ${failCount}. Ensure internet connectivity is stable.`
      );
    }
  };

  const handleDeleteDraft = (id: string) => {
    Alert.alert('Delete Draft', 'Are you sure you want to discard this offline report?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDraft(id);
            loadDrafts();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete draft.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: DraftItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.payload.title}</Text>
        {item.payload.isEmergency && <Text style={styles.emergencyTag}>EMERGENCY</Text>}
      </View>
      <Text style={styles.cardDesc} numberOfLines={2}>
        {item.payload.description}
      </Text>
      <Text style={styles.meta}>
        Category: {item.payload.category} | By: {item.payload.citizenName}
      </Text>
      {item.payload.latitude && (
        <Text style={styles.meta}>
          Geotag: {item.payload.latitude.toFixed(4)}, {item.payload.longitude.toFixed(4)}
        </Text>
      )}
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDeleteDraft(item.id)}
        >
          <Text style={styles.deleteBtnText}>Discard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Offline Drafts ({drafts.length})</Text>
        <TouchableOpacity
          style={styles.syncButton}
          onPress={handleSyncAll}
          disabled={syncing || drafts.length === 0}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.syncText}>Sync All</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#1a5276" />
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No offline reports waiting.</Text>
              <Text style={styles.emptySubText}>
                Issues reported while offline automatically stack here for later submission.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 15,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  syncButton: {
    backgroundColor: '#1a5276',
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 6,
    justifyContent: 'center',
  },
  syncText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  loader: {
    marginTop: 50,
  },
  list: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e8ed',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
    marginRight: 10,
  },
  emergencyTag: {
    backgroundColor: '#e74c3c',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  meta: {
    fontSize: 11,
    color: '#95a5a6',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  deleteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e74c3c',
    borderRadius: 4,
  },
  deleteBtnText: {
    color: '#e74c3c',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  emptySubText: {
    fontSize: 13,
    color: '#bdc3c7',
    textAlign: 'center',
    marginTop: 6,
  },
});
