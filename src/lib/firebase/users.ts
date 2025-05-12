
import { db } from './config';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { User, UserRole } from '@/lib/types';

/**
 * Fetches a user document from Firestore based on UID.
 * @param uid The user's unique identifier.
 * @returns The User object or null if not found.
 */
export const getUserDocument = async (uid: string): Promise<User | null> => {
  if (!uid) {
    console.error("getUserDocument called with no UID.");
    return null;
  }
  const userDocRef = doc(db, 'users', uid);
  try {
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const data = userDocSnap.data();
      // Ensure the role is valid, default to 'user' if missing or invalid
      const role = ['admin', 'user'].includes(data.role) ? data.role : 'user';
      return {
        uid,
        email: data.email || null,
        role: role as UserRole, // Cast to UserRole after validation
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
        lastLogin: data.lastLogin instanceof Timestamp ? data.lastLogin : undefined,
      } as User;
    } else {
      // console.warn(`User document not found in Firestore for UID: ${uid}`);
      return null; // Explicitly return null if document doesn't exist
    }
  } catch (error) {
     console.error(`Error fetching user document for UID ${uid}:`, error);
     return null; // Return null on error
  }
};

/**
 * Creates a new user document in Firestore or updates existing basic info.
 * @param uid The user's unique identifier.
 * @param email The user's email address.
 * @param role The user's role (defaults to 'user').
 */
export const createUserDocument = async (uid: string, email: string | null, role: UserRole = 'user'): Promise<void> => {
   if (!uid) {
       console.error("createUserDocument called with no UID.");
       throw new Error("User UID is required to create a document.");
   }
   const userDocRef = doc(db, 'users', uid);
  try {
    // Use set with merge:true to avoid overwriting existing data if called again,
    // but ensure core fields are present. Add createdAt only if creating new.
    const docSnap = await getDoc(userDocRef);
    const dataToWrite: Partial<User> & { lastUpdated: Timestamp } = {
        uid,
        email,
        role,
        lastUpdated: serverTimestamp() as Timestamp, // Firestore Server Timestamp placeholder
    };
    if (!docSnap.exists()) {
        dataToWrite.createdAt = serverTimestamp() as Timestamp; // Add createdAt only on initial creation
    }

    await setDoc(userDocRef, dataToWrite, { merge: true });
    console.log(`User document created/updated for UID: ${uid}`);
  } catch (error) {
      console.error(`Error creating/updating user document for UID ${uid}:`, error);
      throw error; // Re-throw the error to be handled by the caller
  }
};

/**
 * Updates the role of a specific user. (Admin only)
 * @param uid The UID of the user to update.
 * @param newRole The new role to assign.
 */
export const updateUserRole = async (uid: string, newRole: UserRole): Promise<void> => {
  if (!uid) {
    console.error("updateUserRole called with no UID.");
    throw new Error("User UID is required.");
  }
  if (!['admin', 'user'].includes(newRole)) {
     console.error(`Invalid role provided: ${newRole}`);
     throw new Error("Invalid user role specified.");
  }
  const userDocRef = doc(db, 'users', uid);
  try {
    await setDoc(userDocRef, { role: newRole, lastUpdated: serverTimestamp() }, { merge: true });
    console.log(`User role updated for UID: ${uid} to ${newRole}`);
  } catch (error) {
     console.error(`Error updating user role for UID ${uid}:`, error);
     throw error;
  }
};
