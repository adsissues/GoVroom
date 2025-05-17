
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
    console.error("[users.ts] getUserDocument called with no UID.");
    return null;
  }
  const userDocRef = doc(db, 'users', uid);
  console.log(`[users.ts] Attempting to fetch user document for UID: ${uid}`);
  try {
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const data = userDocSnap.data();
      console.log(`[users.ts] User document data for UID ${uid}:`, JSON.parse(JSON.stringify(data))); // Log serializable data
      // Ensure the role is valid, default to 'user' if missing or invalid
      let role: UserRole = 'user'; // Default role
      if (data.role && ['admin', 'user'].includes(data.role)) {
        role = data.role as UserRole;
      } else {
        console.warn(`[users.ts] Role missing or invalid for UID ${uid}. Defaulting to 'user'. Firestore data.role:`, data.role);
      }
      console.log(`[users.ts] Determined role for UID ${uid}: ${role}`);
      return {
        uid,
        email: data.email || null,
        role: role,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
        lastLogin: data.lastLogin instanceof Timestamp ? data.lastLogin : undefined,
      } as User;
    } else {
      console.warn(`[users.ts] User document NOT FOUND in Firestore for UID: ${uid}`);
      return null;
    }
  } catch (error) {
     console.error(`[users.ts] Error fetching user document for UID ${uid}:`, error);
     return null;
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
       console.error("[users.ts] createUserDocument called with no UID.");
       throw new Error("User UID is required to create a document.");
   }
   const userDocRef = doc(db, 'users', uid);
  try {
    console.log(`[users.ts] Attempting to create/update user document for UID: ${uid} with email: ${email}, role: ${role}`);
    const docSnap = await getDoc(userDocRef);
    const dataToWrite: Partial<User> & { lastUpdated: Timestamp } = {
        uid,
        email,
        role,
        lastUpdated: serverTimestamp() as Timestamp,
    };
    if (!docSnap.exists()) {
        dataToWrite.createdAt = serverTimestamp() as Timestamp;
        console.log(`[users.ts] User document for UID ${uid} does not exist. Will add createdAt.`);
    }

    await setDoc(userDocRef, dataToWrite, { merge: true });
    console.log(`[users.ts] User document created/updated for UID: ${uid}`);
  } catch (error) {
      console.error(`[users.ts] Error creating/updating user document for UID ${uid}:`, error);
      throw error;
  }
};

/**
 * Updates the role of a specific user. (Admin only)
 * @param uid The UID of the user to update.
 * @param newRole The new role to assign.
 */
export const updateUserRole = async (uid: string, newRole: UserRole): Promise<void> => {
  if (!uid) {
    console.error("[users.ts] updateUserRole called with no UID.");
    throw new Error("User UID is required.");
  }
  if (!['admin', 'user'].includes(newRole)) {
     console.error(`[users.ts] Invalid role provided to updateUserRole: ${newRole}`);
     throw new Error("Invalid user role specified.");
  }
  const userDocRef = doc(db, 'users', uid);
  try {
    console.log(`[users.ts] Updating role for UID: ${uid} to ${newRole}`);
    await setDoc(userDocRef, { role: newRole, lastUpdated: serverTimestamp() }, { merge: true });
    console.log(`[users.ts] User role updated for UID: ${uid} to ${newRole}`);
  } catch (error) {
     console.error(`[users.ts] Error updating user role for UID ${uid}:`, error);
     throw error;
  }
};
