import "dotenv/config";

export default {
  expo: {
    name: "wanderne-mobile",
    slug: "wanderne-mobile",
    icon: "./assets/images/icon.png",
    ios: {
      bundleIdentifier: "com.wandernebraska.mobile",
      buildNumber: "1",
    },
    android: {
      package: "com.wandernebraska.mobile",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/images/icon.png",
        backgroundColor: "#ffffff",
      },
    },
    extra: {
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
  },
};
