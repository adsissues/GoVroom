
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
import { doc, getDoc } from 'firebase/firestore';
import type { User, UserRole } from '@/lib/types';

export const signInWithEmail = async (email: string, password: string): Promise<FirebaseUser> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const signOutUser = async (): Promise<void> => {
  await signOut(auth);
};

export const onAuthStateChangedListener = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      // Fetch user role from Firestore
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      let role: UserRole | null = null;
      if (userDocSnap.exists()) {
        role = userDocSnap.data()?.role as UserRole || 'user'; // Default to 'user' if role field is missing
      } else {
        // Handle case where user document might not exist yet (e.g., first login after account creation by other means)
        // Or, this could be an error state depending on app logic. For now, assume 'user'.
        console.warn(`User document not found for UID: ${firebaseUser.uid}. Defaulting role to 'user'.`);
        role = 'user';
      }
      callback({ 
        uid: firebaseUser.uid, 
        email: firebaseUser.email,
        role: role
      });
    } else {
      callback(null);
    }
  });
};
