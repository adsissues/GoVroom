
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
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  // Optionally update lastLogin timestamp here
  const userDocRef = doc(db, 'users', userCredential.user.uid);
  await setDoc(userDocRef, { lastLogin: serverTimestamp() }, { merge: true });
  return userCredential.user;
};

export const signOutUser = async (): Promise<void> => {
  await signOut(auth);
};

// Listener that fetches user role from Firestore
export const onAuthStateChangedListener = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      // Fetch the full user document which includes the role
      const userDoc = await getUserDocument(firebaseUser.uid);

      if (userDoc) {
        callback(userDoc); // Pass the full user object with role
      } else {
        // This case might happen if the user exists in Auth but not Firestore.
        // Decide on the behavior: create the doc or treat as an error/incomplete profile.
        // For robustness, let's create a basic user document if it doesn't exist.
        console.warn(`User document not found for UID: ${firebaseUser.uid}. Creating a new one with default 'user' role.`);
        try {
          await createUserDocument(firebaseUser.uid, firebaseUser.email, 'user');
          callback({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: 'user' // Return the newly created user info
          });
        } catch (error) {
          console.error("Error creating user document on-the-fly:", error);
          callback(null); // Failed to create doc, treat as not fully logged in
        }
      }
    } else {
      callback(null); // No Firebase user
    }
  });
};
