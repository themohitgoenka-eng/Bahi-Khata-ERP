import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor config for wrapping the Vite web build into a native Android APK.
// The web assets are built into ./dist (see `yarn build`).
//
// Local usage (on your machine after downloading the source):
//   yarn build
//   npx cap add android
//   npx cap sync
//   npx cap open android   # then build the APK from Android Studio
const config: CapacitorConfig = {
  appId: 'com.bahikhata.erp',
  appName: 'Bahi Khata ERP',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
