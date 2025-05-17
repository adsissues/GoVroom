
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
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { User, UserRole } from '@/lib/types';
import { getUserDocument, createUserDocument } from './users'; // Use user service functions

export const signInWithEmail = async (email: string, password: string): Promise<FirebaseUser> => {
  console.log(`[authService.ts] Attempting signInWithEmail for user: ${email}`);
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  console.log(`[authService.ts] signInWithEmail successful for UID: ${userCredential.user.uid}. Updating lastLogin.`);
  const userDocRef = doc(db, 'users', userCredential.user.uid);
  await setDoc(userDocRef, { lastLogin: serverTimestamp() }, { merge: true });
  return userCredential.user;
};

export const signOutUser = async (): Promise<void> => {
  console.log("[authService.ts] Attempting signOutUser.");
  await signOut(auth);
  console.log("[authService.ts] signOutUser successful.");
};

// Listener that fetches user role from Firestore
export const onAuthStateChangedListener = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    console.log(`[authService.ts] onAuthStateChangedListener triggered. Firebase user email: ${firebaseUser?.email ?? 'null'}, UID: ${firebaseUser?.uid ?? 'null'}`);
    if (firebaseUser) {
      console.log(`[authService.ts] Firebase user found (UID: ${firebaseUser.uid}). Fetching user document...`);
      const userDoc = await getUserDocument(firebaseUser.uid);
      console.log(`[authService.ts] Fetched userDoc for UID ${firebaseUser.uid}:`, userDoc ? JSON.parse(JSON.stringify(userDoc)) : null);

      if (userDoc) {
        console.log(`[authService.ts] User document found. Role: ${userDoc.role}. Calling callback.`);
        callback(userDoc);
      } else {
        console.warn(`[authService.ts] User document not found for UID: ${firebaseUser.uid} after an auth change. Attempting to create one with 'user' role.`);
        try {
          await createUserDocument(firebaseUser.uid, firebaseUser.email, 'user'); // Default to 'user'
          const newUserDoc = await getUserDocument(firebaseUser.uid); // Fetch again after creation
          if (newUserDoc) {
            console.log(`[authService.ts] Successfully created and fetched new user document. Role: ${newUserDoc.role}. Calling callback.`);
            callback(newUserDoc);
          } else {
            console.error(`[authService.ts] Failed to fetch user document even after attempting creation for UID: ${firebaseUser.uid}. Calling callback with null.`);
            callback(null);
          }
        } catch (error) {
          console.error("[authService.ts] Error creating user document on-the-fly during auth change:", error);
          callback(null);
        }
      }
    } else {
      console.log("[authService.ts] No Firebase user. Calling callback with null.");
      callback(null); // No Firebase user
    }
  });
};
