import Constants from "expo-constants";
import { getAnalytics, isSupported } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const extra = Constants.expoConfig?.extra;

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: extra?.firebaseApiKey,
  authDomain: extra?.firebaseAuthDomain,
  databaseURL: extra?.firebaseDatabaseUrl,
  projectId: extra?.firebaseProjectId,
  storageBucket: extra?.firebaseStorageBucket,
  messagingSenderId: extra?.firebaseMessagingSenderId,
  appId: extra?.firebaseAppId,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

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

export { analytics };
export const db = getDatabase(app);
export const auth = getAuth(app);
