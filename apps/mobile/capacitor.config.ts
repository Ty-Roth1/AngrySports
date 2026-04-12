import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.angrysports.twelvam',
  appName: '12AM',

  // Points at the live Vercel deployment.
  // The app is a native shell around the web app — no static export needed.
  server: {
    url: 'https://angry-sports.vercel.app',
    cleartext: false,
    // Allow navigation within the app domain
    allowNavigation: ['angry-sports.vercel.app'],
  },

  // webDir is required by Capacitor CLI even when using a remote server URL.
  // It won't be served — the server.url above takes precedence.
  webDir: 'www',

  ios: {
    // Builds a WKWebView-based native shell
    contentInset: 'automatic',
    backgroundColor: '#111827',   // matches gray-900 app background
    scrollEnabled: true,
    allowsLinkPreview: false,
    // Required for Supabase Auth redirects (magic link / OAuth)
    scheme: 'twelvam',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#111827',
      iosSpinnerStyle: 'small',
      spinnerColor: '#ef4444',     // red-500 to match brand
      showSpinner: true,
    },
    StatusBar: {
      style: 'dark',               // light text on dark background
      backgroundColor: '#111111',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
