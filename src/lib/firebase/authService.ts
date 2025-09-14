
import {
  auth,
  db
} from './config';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { upsertUserOnLogin } from './users'; // Use the new upsert function

export const signInWithEmail = async (email: string, password: string): Promise<FirebaseUser> => {
  console.log(`[authService.ts] signInWithEmail: Attempting signInWithEmail for user: ${email}`);
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  // The onAuthStateChanged listener will handle the user document upsert.
  console.log(`[authService.ts] signInWithEmail: Successful for UID: ${userCredential.user.uid}.`);
  return userCredential.user;
};

export const signOutUser = async (): Promise<void> => {
  console.log("[authService.ts] signOutUser: Attempting signOutUser.");
  await signOut(auth);
  console.log("[authService.ts] signOutUser: Successful.");
};

// Listener that upserts user doc and fetches user role from Firestore
export const onAuthStateChangedListener = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    console.log(`[authService.ts] onAuthStateChangedListener: Auth state changed. Firebase user email: ${firebaseUser?.email ?? 'null'}, UID: ${firebaseUser?.uid ?? 'null'}`);
    if (firebaseUser) {
      console.log(`[authService.ts] onAuthStateChangedListener: Firebase user found (UID: ${firebaseUser.uid}). Upserting user document...`);
      const user = await upsertUserOnLogin(firebaseUser);
      if (user) {
        console.log(`[authService.ts] onAuthStateChangedListener: User document processed. Role: "${user.role}". Calling callback.`);
        callback(user);
      } else {
        console.error(`[authService.ts] onAuthStateChangedListener: CRITICAL - Failed to upsert or fetch user document for UID: ${firebaseUser.uid}. Calling callback with null.`);
        callback(null);
      }
    } else {
      console.log("[authService.ts] onAuthStateChangedListener: No Firebase user authenticated. Calling callback with null.");
      callback(null); // No Firebase user
    }
  });
};
