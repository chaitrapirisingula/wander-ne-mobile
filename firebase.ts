import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { getAnalytics, isSupported } from "firebase/analytics";
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  AuthErrorCodes,
  getAuth,
  initializeAuth,
  type Auth,
  type Persistence,
} from "firebase/auth";
import { Platform } from "react-native";
import { getDatabase } from "firebase/database";

/** Resolve `extra` from embedded config (release builds can differ slightly from dev). */
function getExpoExtra(): Record<string, unknown> | undefined {
  const fromExpo = Constants.expoConfig?.extra;
  if (fromExpo && typeof fromExpo === "object") {
    return fromExpo as Record<string, unknown>;
  }
  const legacy = Constants.manifest as { extra?: Record<string, unknown> } | null;
  if (legacy?.extra && typeof legacy.extra === "object") {
    return legacy.extra;
  }
  return undefined;
}

const extra = getExpoExtra();

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: extra?.firebaseApiKey as string | undefined,
  authDomain: extra?.firebaseAuthDomain as string | undefined,
  databaseURL: extra?.firebaseDatabaseUrl as string | undefined,
  projectId: extra?.firebaseProjectId as string | undefined,
  storageBucket: extra?.firebaseStorageBucket as string | undefined,
  messagingSenderId: extra?.firebaseMessagingSenderId as string | undefined,
  appId: extra?.firebaseAppId as string | undefined,
};

const hasCoreFirebase =
  typeof firebaseConfig.apiKey === "string" &&
  firebaseConfig.apiKey.length > 0 &&
  typeof firebaseConfig.projectId === "string" &&
  firebaseConfig.projectId.length > 0 &&
  typeof firebaseConfig.appId === "string" &&
  firebaseConfig.appId.length > 0;

let app: FirebaseApp;
if (!hasCoreFirebase) {
  const msg =
    "Firebase config is missing in this build. For EAS production, set all Firebase env vars in expo.dev (Production) and run a new eas build — local .env is not used on EAS.";
  console.error(msg, { hasExtra: !!extra });
  throw new Error(msg);
}

// Initialize Firebase
app = initializeApp(firebaseConfig);

// Debug: verify database URL is set (required for Realtime Database)
if (!firebaseConfig.databaseURL) {
  console.warn(
    "[Firebase] FIREBASE_DATABASE_URL is missing in .env - Realtime Database will not work. Add it from Firebase Console → Realtime Database.",
  );
}

// Initialize Analytics only if supported and in a proper browser environment
// This prevents errors in WebView contexts where document might not be fully available
let analytics: ReturnType<typeof getAnalytics> | null = null;

// Check if we're in a browser environment (not WebView or React Native)
// ReactNativeWebView is injected by react-native-webview
const isWebView =
  typeof window !== "undefined" && (window as any).ReactNativeWebView;
const isBrowser =
  typeof document !== "undefined" &&
  typeof window !== "undefined" &&
  !isWebView;

if (isBrowser) {
  isSupported()
    .then((supported) => {
      if (supported) {
        try {
          analytics = getAnalytics(app);
        } catch (error) {
          console.warn("Firebase Analytics initialization failed:", error);
        }
      }
    })
    .catch((error) => {
      console.warn("Firebase Analytics not supported:", error);
    });
}

export { analytics, app };
export const db = getDatabase(app);

function createAuth(): Auth {
  if (Platform.OS === "web") {
    return getAuth(app);
  }
  try {
    // Metro resolves `@firebase/auth` to the RN build, which includes `getReactNativePersistence`.
    // The root package typings omit it, so we load at runtime instead of a typed static import.
    const { getReactNativePersistence } = require("@firebase/auth") as {
      getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
    };
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === AuthErrorCodes.ALREADY_INITIALIZED) {
      return getAuth(app);
    }
    throw error;
  }
}

export const auth = createAuth();
