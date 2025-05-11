
import { db } from './config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { User, UserRole } from '@/lib/types';

export const getUserDocument = async (uid: string): Promise<User | null> => {
  if (!uid) return null;
  const userDocRef = doc(db, 'users', uid);
  const userDocSnap = await getDoc(userDocRef);

  if (userDocSnap.exists()) {
    const data = userDocSnap.data();
    return {
      uid,
      email: data.email || null,
      role: data.role || 'user', // Default to 'user' if role not set
    } as User;
  } else {
    // console.warn(`User document not found in Firestore for UID: ${uid}`);
    return null;
  }
};

export const createUserDocument = async (uid: string, email: string | null, role: UserRole = 'user'): Promise<void> => {
  const userDocRef = doc(db, 'users', uid);
  await setDoc(userDocRef, {
    uid,
    email,
    role,
    createdAt: new Date(), // Optional: timestamp for user creation
  });
};
