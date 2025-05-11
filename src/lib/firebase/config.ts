
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

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

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

auth = getAuth(app);
db = getFirestore(app);

export { app, auth, db };
