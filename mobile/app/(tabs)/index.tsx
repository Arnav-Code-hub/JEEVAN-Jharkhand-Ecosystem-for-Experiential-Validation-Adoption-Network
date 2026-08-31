import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import * as Location from 'expo-location';
import { submitIssue, CreateIssuePayload } from '../../src/services/api';
import { initDatabase, saveDraftIssue } from '../../src/services/db';

const CATEGORIES = [
  { label: 'Water', value: 'water' },
  { label: 'Roads', value: 'roads' },
  { label: 'Electricity', value: 'electricity' },
  { label: 'Sanitation', value: 'sanitation' },
  { label: 'Education', value: 'education' },
  { label: 'Healthcare', value: 'healthcare' },
  { label: 'Agriculture', value: 'agriculture' },
  { label: 'Other', value: 'other' },
];

export default function ReportIssueScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('water');
  const [citizenName, setCitizenName] = useState('');
  const [citizenPhone, setCitizenPhone] = useState('');
  const [citizenEmail, setCitizenEmail] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Make sure SQLite db is ready
    initDatabase().catch((err) => console.error('Database initialization fail:', err));
  }, []);

  const requestLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location permissions in your settings.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(loc);
      Alert.alert('Location Locked', `Lat: ${loc.coords.latitude.toFixed(4)}, Lng: ${loc.coords.longitude.toFixed(4)}`);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not retrieve location.');
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !citizenName.trim()) {
      Alert.alert('Validation Error', 'Title, Description, and Full Name are required.');
      return;
    }

    const payload: CreateIssuePayload = {
      title,
      description,
      category,
      citizenName,
      citizenPhone: citizenPhone.trim() || undefined,
      citizenEmail: citizenEmail.trim() || undefined,
      latitude: location?.coords.latitude,
      longitude: location?.coords.longitude,
      isEmergency,
      channel: 'mobile',
    } as any;

    setSubmitting(true);

    try {
      // Attempt online submission
      await submitIssue(payload);
      Alert.alert('Success', 'Your issue has been reported successfully and forwarded for review!');
      // Reset form
      setTitle('');
      setDescription('');
      setIsEmergency(false);
    } catch (apiError) {
      console.log('[API] Submission failed, saving offline:', apiError);
      try {
        // Fallback: save locally
        await saveDraftIssue(payload);
        Alert.alert(
          'Offline Mode',
          'Internet connection unavailable or server offline. Issue saved locally. Sync it manually from the Queue tab once online.'
        );
        // Reset form
        setTitle('');
        setDescription('');
        setIsEmergency(false);
      } catch (dbError) {
        console.error('[SQLite] Saving draft failed:', dbError);
        Alert.alert('Submission Error', 'Failed to submit issue online or save offline.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Report Citizen Issue</Text>

      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={styles.input}
        placeholder="Brief summary of the issue"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Description *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Detailed explanation of the issue..."
        multiline
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.categoryRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            style={[
              styles.categoryBtn,
              category === cat.value && styles.categoryBtnActive,
            ]}
            onPress={() => setCategory(cat.value)}
          >
            <Text
              style={[
                styles.categoryBtnText,
                category === cat.value && styles.categoryBtnTextActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Full Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        value={citizenName}
        onChangeText={setCitizenName}
      />

      <Text style={styles.label}>Phone Number</Text>
      <TextInput
        style={styles.input}
        placeholder="+91 XXXXX XXXXX"
        keyboardType="phone-pad"
        value={citizenPhone}
        onChangeText={setCitizenPhone}
      />

      <Text style={styles.label}>Email (Optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="email@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={citizenEmail}
        onChangeText={setCitizenEmail}
      />

      {/* Geotagging Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.locationTitle}>Geotagging</Text>
          {location && (
            <Text style={styles.locationCoords}>
              ({location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)})
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={requestLocation}
          disabled={locating}
        >
          {locating ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>{location ? 'Re-tag Location' : 'Tag Current Location'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Emergency Toggle */}
      <View style={styles.row}>
        <Text style={styles.emergencyLabel}>Is this an emergency?</Text>
        <Switch
          value={isEmergency}
          onValueChange={setIsEmergency}
          trackColor={{ false: '#bdc3c7', true: '#e74c3c' }}
          thumbColor={isEmergency ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submittingBtn]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.submitText}>Submit Report</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#dcdde1',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    fontSize: 15,
  },
  textArea: {
    height: 100,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  categoryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#3498db',
    borderRadius: 20,
    backgroundColor: '#ffffff',
  },
  categoryBtnActive: {
    backgroundColor: '#1a5276',
    borderColor: '#1a5276',
  },
  categoryBtnText: {
    color: '#3498db',
    fontSize: 13,
    fontWeight: '500',
  },
  categoryBtnTextActive: {
    color: '#ffffff',
  },
  section: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e8ed',
    marginVertical: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
  },
  locationCoords: {
    fontSize: 13,
    color: '#27ae60',
    fontWeight: '500',
  },
  locationButton: {
    backgroundColor: '#1a5276',
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 15,
    paddingHorizontal: 5,
  },
  emergencyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c0392b',
  },
  submitButton: {
    backgroundColor: '#27ae60',
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
  },
  submittingBtn: {
    backgroundColor: '#2ecc71',
    opacity: 0.8,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
