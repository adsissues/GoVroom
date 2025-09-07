
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
  console.log(`[authService.ts] signInWithEmail: Attempting signInWithEmail for user: ${email}`);
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  console.log(`[authService.ts] signInWithEmail: Successful for UID: ${userCredential.user.uid}. Updating lastLogin.`);
  const userDocRef = doc(db, 'users', userCredential.user.uid);
  await setDoc(userDocRef, { lastLogin: serverTimestamp() }, { merge: true });
  return userCredential.user;
};

export const signOutUser = async (): Promise<void> => {
  console.log("[authService.ts] signOutUser: Attempting signOutUser.");
  await signOut(auth);
  console.log("[authService.ts] signOutUser: Successful.");
};

// Listener that fetches user role from Firestore
export const onAuthStateChangedListener = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    console.log(`[authService.ts] onAuthStateChangedListener: Auth state changed. Firebase user email: ${firebaseUser?.email ?? 'null'}, UID: ${firebaseUser?.uid ?? 'null'}`);
    if (firebaseUser) {
      console.log(`[authService.ts] onAuthStateChangedListener: Firebase user found (UID: ${firebaseUser.uid}). Fetching user document from Firestore...`);
      const userDoc = await getUserDocument(firebaseUser.uid);
      // console.log(`[authService.ts] onAuthStateChangedListener: Fetched userDoc for UID ${firebaseUser.uid} from Firestore:`, userDoc ? JSON.parse(JSON.stringify(userDoc)) : null);

      if (userDoc) {
        console.log(`[authService.ts] onAuthStateChangedListener: User document found in Firestore. Role: "${userDoc.role}". Calling callback with this user object.`);
        callback(userDoc);
      } else {
        console.warn(`[authService.ts] onAuthStateChangedListener: User document not found in Firestore for UID: ${firebaseUser.uid}. Attempting to create one with 'user' role.`);
        try {
          await createUserDocument(firebaseUser.uid, firebaseUser.email, 'user'); // Default to 'user'
          const newUserDoc = await getUserDocument(firebaseUser.uid); // Fetch again after creation
          if (newUserDoc) {
            console.log(`[authService.ts] onAuthStateChangedListener: Successfully created and fetched new user document. Role: "${newUserDoc.role}". Calling callback.`);
            callback(newUserDoc);
          } else {
            console.error(`[authService.ts] onAuthStateChangedListener: CRITICAL - Failed to fetch user document even after attempting creation for UID: ${firebaseUser.uid}. Calling callback with null.`);
            callback(null);
          }
        } catch (error) {
          console.error("[authService.ts] onAuthStateChangedListener: Error creating user document on-the-fly during auth change:", error);
          callback(null);
        }
      }
    } else {
      console.log("[authService.ts] onAuthStateChangedListener: No Firebase user authenticated. Calling callback with null.");
      callback(null); // No Firebase user
    }
  });
};
