import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  name: 'JEEVAN',
  slug: 'jeevan-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'jeevan',
  newArchEnabled: true,
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#1a5276',
  },
  ios: {
    bundleIdentifier: 'com.jeevan.mobile',
    supportsTablet: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'JEEVAN needs your location to geotag citizen issues.',
      NSCameraUsageDescription:
        'JEEVAN needs camera access to capture issue photos.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1a5276',
    },
    package: 'com.jeevan.mobile',
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'RECEIVE_BOOT_COMPLETED',
    ],
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    [
      'expo-location',
      { locationAlwaysAndWhenInUsePermission: 'JEEVAN uses your location to geotag issues.' },
    ],
    [
      'expo-camera',
      { cameraPermission: 'JEEVAN needs camera access to capture issue photos.' },
    ],
    [
      'expo-image-picker',
      { photosPermission: 'JEEVAN needs photo access to attach images to issues.' },
    ],
    [
      'expo-notifications',
      { icon: './assets/notification-icon.png', color: '#1a5276' },
    ],
    'expo-task-manager',
    'expo-background-fetch',
  ],
  extra: {
    eas: { projectId: '' }, // fill after `eas build:configure`
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  },
});
