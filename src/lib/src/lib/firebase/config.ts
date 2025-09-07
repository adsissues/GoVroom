
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  type Firestore,
  enableIndexedDbPersistence,
  initializeFirestore,
  CACHE_SIZE_UNLIMITED
} from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Firebase configuration, safely read from environment variables.
// This approach avoids throwing errors for missing values, which is useful
// for environments where some variables might not be set.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

// Universal initialization logic for Firebase, ensuring it works on both
// client and server sides, and avoids re-initialization.
if (getApps().length === 0) {
  // Initialize the primary Firebase app.
  app = initializeApp(firebaseConfig);

  // Initialize Firestore with specific settings.
  // Using initializeFirestore is preferred over getFirestore(app) here to pass settings.
  db = initializeFirestore(app, {
    cacheSizeBytes: CACHE_SIZE_UNLIMITED
  });

  // Enable offline persistence for Firestore on the client side.
  if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(db)
      .then(() => console.log("Firestore persistence enabled."))
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn("Firestore persistence failed: Multiple tabs open. Persistence can only be enabled in one tab at a time.");
        } else if (err.code === 'unimplemented') {
          console.warn("Firestore persistence failed: The current browser does not support all of the features required to enable persistence.");
        } else {
          console.error("Firestore persistence error: ", err);
        }
      });
  }
} else {
  // If the app is already initialized, retrieve the existing instance.
  // This is crucial for Next.js's hot-reloading feature and for server-side rendering.
  app = getApps()[0];
  db = getFirestore(app); // Simply get the instance, don't re-initialize with settings.
}

// Initialize other Firebase services.
// These can be safely initialized after the main app instance is ready.
auth = getAuth(app);
storage = getStorage(app);

export { app, auth, db, storage };
