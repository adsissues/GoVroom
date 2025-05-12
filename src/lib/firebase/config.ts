
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


// REMEMBER TO REPLACE THIS WITH YOUR ACTUAL FIREBASE CONFIG
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  // Initialize Firestore with persistence options
  db = initializeFirestore(app, {
    cacheSizeBytes: CACHE_SIZE_UNLIMITED // Or a specific size
  });
  if (typeof window !== 'undefined') { // Ensure this only runs on the client
    enableIndexedDbPersistence(db)
      .then(() => console.log("Firestore persistence enabled"))
      .catch((err) => {
        if (err.code == 'failed-precondition') {
          console.warn("Firestore persistence failed: Multiple tabs open or other issue.");
        } else if (err.code == 'unimplemented') {
          console.warn("Firestore persistence failed: Browser does not support all features.");
        } else {
          console.error("Firestore persistence failed with error: ", err);
        }
      });
  }
} else {
  app = getApps()[0];
  db = getFirestore(app); // Get existing Firestore instance
}


auth = getAuth(app);
storage = getStorage(app);


export { app, auth, db, storage };
