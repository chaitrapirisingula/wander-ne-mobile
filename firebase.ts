import Constants from "expo-constants";
import { getAnalytics } from "firebase/analytics";
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
export const analytics = getAnalytics(app);
export const db = getDatabase(app);
export const auth = getAuth(app);
