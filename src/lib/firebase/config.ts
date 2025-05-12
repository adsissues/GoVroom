
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


// IMPORTANT: Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "YOUR_APP_ID"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (typeof window !== 'undefined' && getApps().length === 0) {
  // Initialize on client side ONLY if not already initialized
  app = initializeApp(firebaseConfig);
  // Initialize Firestore with persistence options
  // Using initializeFirestore allows specifying settings like cache size during init
  db = initializeFirestore(app, {
    cacheSizeBytes: CACHE_SIZE_UNLIMITED // Or a specific size like 100 * 1024 * 1024 for 100MB
  });
  // Enable persistence after initialization
  enableIndexedDbPersistence(db)
    .then(() => console.log("Firestore persistence enabled"))
    .catch((err) => {
      if (err.code == 'failed-precondition') {
        console.warn("Firestore persistence failed: Multiple tabs open, persistence can only be enabled in one tab at a time.");
      } else if (err.code == 'unimplemented') {
        console.warn("Firestore persistence failed: The current browser does not support all of the features required to enable persistence.");
      } else {
        console.error("Firestore persistence failed with error: ", err);
      }
    });

} else if (getApps().length > 0) {
  // Use existing app instance (needed for both client subsequent loads and server-side)
  app = getApps()[0];
  db = getFirestore(app); // Get existing Firestore instance
} else {
  // Initialize on the server side (if needed, though most access might be client-side)
  // Note: Persistence cannot be enabled on the server.
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}


// Initialize Auth and Storage regardless of client/server after app is initialized
auth = getAuth(app);
storage = getStorage(app);


export { app, auth, db, storage };
