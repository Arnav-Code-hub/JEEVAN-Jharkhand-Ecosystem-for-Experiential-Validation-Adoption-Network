'use client';

import React, { useState } from 'react';

interface LocationData {
  latitude: number | null;
  longitude: number | null;
  address: string;
  district: string;
  block: string;
}

interface LocationPickerProps {
  onChange: (data: LocationData) => void;
  required?: boolean;
}

export default function LocationPicker({ onChange, required = true }: LocationPickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<LocationData>({
    latitude: null,
    longitude: null,
    address: '',
    district: '',
    block: '',
  });

  const updateLocation = (updated: Partial<LocationData>) => {
    const newData = { ...data, ...updated };
    setData(newData);
    onChange(newData);
  };

  const getGeoLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        updateLocation({ latitude: lat, longitude: lon });

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );

          if (res.ok) {
            const result = await res.json();
            const address = result.display_name || '';
            const details = result.address || {};
            const district = details.state_district || details.county || details.city || '';
            const block = details.suburb || details.village || details.town || '';

            updateLocation({
              latitude: lat,
              longitude: lon,
              address: address,
              district: district.replace(' District', ''),
              block: block,
            });
          } else {
            throw new Error('Reverse geocoding response not ok');
          }
        } catch (err) {
          console.warn('Reverse geocoding failed or offline. Using default location coordinates.', err);
          updateLocation({
            latitude: lat,
            longitude: lon,
            address: `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)} (GPS Location)`,
            district: data.district || 'Ranchi',
            block: data.block || 'Kanke',
          });
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setError('Unable to retrieve your location. Please check your browser location permissions or enter coordinates manually.');
        setLoading(false);
        updateLocation({
          latitude: 23.3441,
          longitude: 85.3096,
          address: 'Ranchi Main Market (Simulated Fallback)',
          district: 'Ranchi',
          block: 'Kanke',
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.label}>Mandatory Geotagging *</span>
        <button
          type="button"
          onClick={getGeoLocation}
          disabled={loading}
          style={styles.gpsBtn}
        >
          {loading ? '📍 Fetching Location...' : '📍 Auto-detect GPS Coordinates'}
        </button>
      </div>

      {error && <span style={styles.errorText}>{error}</span>}

      <div style={styles.row}>
        <div style={styles.col}>
          <label style={styles.subLabel}>Latitude {required && '*'}</label>
          <input
            type="number"
            step="0.000001"
            value={data.latitude || ''}
            onChange={(e) => updateLocation({ latitude: parseFloat(e.target.value) || null })}
            placeholder="e.g. 23.3441"
            style={styles.input}
            required={required}
          />
        </div>
        <div style={styles.col}>
          <label style={styles.subLabel}>Longitude {required && '*'}</label>
          <input
            type="number"
            step="0.000001"
            value={data.longitude || ''}
            onChange={(e) => updateLocation({ longitude: parseFloat(e.target.value) || null })}
            placeholder="e.g. 85.3096"
            style={styles.input}
            required={required}
          />
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.subLabel}>District *</label>
        <input
          type="text"
          value={data.district}
          onChange={(e) => updateLocation({ district: e.target.value })}
          placeholder="e.g. Ranchi"
          style={styles.input}
          required={required}
        />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.subLabel}>Block *</label>
        <input
          type="text"
          value={data.block}
          onChange={(e) => updateLocation({ block: e.target.value })}
          placeholder="e.g. Kanke"
          style={styles.input}
          required={required}
        />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.subLabel}>Detailed Landmark Address *</label>
        <textarea
          value={data.address}
          onChange={(e) => updateLocation({ address: e.target.value })}
          placeholder="Specify exact address, nearest landmark, or street name..."
          style={styles.textarea}
          rows={2}
          required={required}
        />
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '12px',
    backgroundColor: '#f8f9fa',
    border: '1px dashed #bdc3c7',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    marginBottom: '10px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#2c3e50',
  },
  gpsBtn: {
    backgroundColor: '#3498db',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '5px 10px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  errorText: {
    fontSize: '11px',
    color: '#e74c3c',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  col: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  subLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#7f8c8d',
  },
  input: {
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #bdc3c7',
    fontSize: '13px',
  },
  textarea: {
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #bdc3c7',
    fontSize: '13px',
    fontFamily: 'inherit',
  },
};
