
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
  apiKey: "AIzaSyDVZt1LykxJWZCbkAuxI9fuK1GQ6vjbnUw",
  authDomain: "stockwatch-naaa0.firebaseapp.com",
  projectId: "stockwatch-naaa0",
  storageBucket: "stockwatch-naaa0.firebasestorage.app",
  messagingSenderId: "167547366333",
  appId: "1:167547366333:web:6c9ccbc6b1d52ff21380d4"
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
