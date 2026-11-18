import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId:   'com.samaalostoura.os',
  appName: 'Sama OS',
  // Always load the live production website — updates are instant, no store update needed
  server: {
    url:             'https://app.sabcconstruction.com',
    cleartext:       false,
    allowNavigation: ['app.sabcconstruction.com'],
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
