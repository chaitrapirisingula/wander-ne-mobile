import "dotenv/config";
import type { ExpoConfig } from "expo/config";

/** Required for store-ready builds; validated during EAS `production` profile only. */
const PRODUCTION_ENV_KEYS = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_DATABASE_URL",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
  "MAPBOX_ACCESS_TOKEN",
] as const;

/**
 * Merge with `app.json` (passed as `config`). A plain `export default { expo: {...} }`
 * replaces the static file entirely, which dropped plugins, splash, New Arch, etc.
 * — a common cause of iOS-only crashes (e.g. missing native permission strings).
 */
export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  if (
    process.env.EAS_BUILD === "true" &&
    process.env.EAS_BUILD_PROFILE === "production"
  ) {
    const missing = PRODUCTION_ENV_KEYS.filter(
      (key) => !String(process.env[key] ?? "").trim(),
    );
    if (missing.length > 0) {
      throw new Error(
        `EAS production build: missing environment variables: ${missing.join(
          ", ",
        )}. In expo.dev open this project → Environment variables → ensure each exists for the Production environment (and eas.json production profile uses "environment": "production").`,
      );
    }
  }

  const baseExtra =
    config.extra && typeof config.extra === "object"
      ? (config.extra as Record<string, unknown>)
      : {};

  return {
    ...config,
    name: "WanderNebraska",
    slug: "wanderne-mobile",
    icon: "./assets/images/icon.png",
    ios: {
      ...config.ios,
      bundleIdentifier: "com.wandernebraska.mobile",
    },
    android: {
      ...config.android,
      package: "com.wandernebraska.mobile",
      versionCode: 1,
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        foregroundImage: "./assets/images/icon.png",
        backgroundColor: "#ffffff",
      },
    },
    extra: {
      ...baseExtra,
      eas: {
        projectId: "f848448f-de10-44fc-9a36-8634b403f08d",
      },
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firebaseDatabaseUrl: process.env.FIREBASE_DATABASE_URL,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.FIREBASE_APP_ID,
      mapboxToken: process.env.MAPBOX_ACCESS_TOKEN,
    },
  };
};
