import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ca.situatevancouver.app',
  appName: 'Situate Vancouver',
  webDir: 'dist',

  // ── Plugins ────────────────────────────────────────────────────────────────
  plugins: {
    Geolocation: {
      // iOS: shows in the permission prompt dialog
      // Also set NSLocationWhenInUseUsageDescription in ios/App/App/Info.plist
    },
    StatusBar: {
      // Match the dark header background
      style: 'DARK',
      backgroundColor: '#000F24',
      overlaysWebView: false,
    },
  },

  // ── iOS ────────────────────────────────────────────────────────────────────
  ios: {
    contentInset: 'automatic',
    // Scroll to the WKWebView to fill the safe area — our CSS handles insets
    scrollEnabled: false,
  },

  // ── Android ────────────────────────────────────────────────────────────────
  android: {
    // Allow cleartext (HTTP) traffic only in debug; production uses HTTPS
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
}

// In CI / native builds, CAPACITOR_SERVER_URL points at the live Django+frontend
// origin (e.g. https://app.situatevancouver.ca). When set, the WebView loads
// directly from the server rather than bundled assets — useful for staged rollouts.
// Leave unset for App Store builds so the bundle ships self-contained.
const liveUpdateUrl = process.env.CAPACITOR_SERVER_URL
if (liveUpdateUrl) {
  config.server = { url: liveUpdateUrl, cleartext: false }
}

export default config
