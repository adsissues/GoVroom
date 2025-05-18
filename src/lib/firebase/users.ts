
import { db } from './config';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp, collection, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';
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
  console.log(`[users.ts] getUserDocument: Attempting to fetch user document for UID: ${uid}`);
  try {
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const data = userDocSnap.data();
      // console.log(`[users.ts] getUserDocument: Raw Firestore data for UID ${uid}:`, JSON.parse(JSON.stringify(data))); // More detailed log
      
      let role: UserRole = 'user'; // Default role
      if (data.role && ['admin', 'user'].includes(data.role)) {
        role = data.role as UserRole;
      } else {
        console.warn(`[users.ts] getUserDocument: Role missing or invalid for UID ${uid}. Firestore data.role: "${data.role}". Defaulting to 'user'.`);
      }
      const resolvedUser: User = {
        uid,
        email: data.email || null,
        role: role,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
        lastLogin: data.lastLogin instanceof Timestamp ? data.lastLogin : undefined,
      };
      console.log(`[users.ts] getUserDocument: Successfully processed document for UID ${uid}. Determined role: "${role}". Returning user object:`, JSON.parse(JSON.stringify(resolvedUser)));
      return resolvedUser;
    } else {
      console.warn(`[users.ts] getUserDocument: User document NOT FOUND in Firestore for UID: ${uid}. Returning null.`);
      return null;
    }
  } catch (error) {
     console.error(`[users.ts] getUserDocument: Error fetching user document for UID ${uid}:`, error);
     return null;
  }
};

/**
 * Creates a new user document in Firestore or updates existing basic info.
 * This function only manages the Firestore document. Actual Firebase Auth user creation
 * needs to be handled separately, typically via Admin SDK / Cloud Function.
 * @param uid The user's unique identifier (should come from Firebase Auth).
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
    console.log(`[users.ts] createUserDocument: Attempting to create/update user document for UID: ${uid} with email: ${email}, role: ${role}`);
    const docSnap = await getDoc(userDocRef);
    const dataToWrite: Partial<User> & { lastUpdated: Timestamp; email: string | null } = { // Ensure email is part of type
        uid,
        email,
        role,
        lastUpdated: serverTimestamp() as Timestamp,
    };
    if (!docSnap.exists()) {
        dataToWrite.createdAt = serverTimestamp() as Timestamp;
        console.log(`[users.ts] createUserDocument: User document for UID ${uid} does not exist. Will add createdAt.`);
    }

    await setDoc(userDocRef, dataToWrite, { merge: true });
    console.log(`[users.ts] createUserDocument: User document created/updated for UID: ${uid}`);
  } catch (error) {
      console.error(`[users.ts] createUserDocument: Error creating/updating user document for UID ${uid}:`, error);
      throw error;
  }
};

/**
 * Updates the role of a specific user in their Firestore document.
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
    console.log(`[users.ts] updateUserRole: Updating role for UID: ${uid} to ${newRole}`);
    await setDoc(userDocRef, { role: newRole, lastUpdated: serverTimestamp() }, { merge: true });
    console.log(`[users.ts] updateUserRole: User role updated for UID: ${uid} to ${newRole}`);
  } catch (error) {
     console.error(`[users.ts] updateUserRole: Error updating user role for UID ${uid}:`, error);
     throw error;
  }
};

/**
 * Fetches all user documents from the 'users' collection in Firestore.
 * Ordered by email.
 * @returns A promise resolving to an array of User objects.
 */
export const getAllUsers = async (): Promise<User[]> => {
  console.log("[users.ts] getAllUsers: Attempting to fetch all user documents...");
  try {
    const usersCollectionRef = collection(db, 'users');
    // Consider ordering by a field like 'createdAt' or 'email' if desired
    const q = query(usersCollectionRef, orderBy('email', 'asc'));
    const querySnapshot = await getDocs(q);
    const users = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      let role: UserRole = 'user';
      if (data.role && ['admin', 'user'].includes(data.role)) {
        role = data.role as UserRole;
      }
      return {
        uid: docSnap.id,
        email: data.email || null,
        role: role,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
        lastLogin: data.lastLogin instanceof Timestamp ? data.lastLogin : undefined,
      } as User;
    });
    console.log(`[users.ts] getAllUsers: Fetched ${users.length} user documents.`);
    return users;
  } catch (error) {
    console.error("[users.ts] getAllUsers: Error fetching all user documents:", error);
    throw error;
  }
};

/**
 * Deletes a user's document from the 'users' collection in Firestore.
 * Note: This does NOT delete the user from Firebase Authentication.
 * That requires Admin SDK / Cloud Function.
 * @param uid The UID of the user document to delete.
 */
export const deleteUserDocument = async (uid: string): Promise<void> => {
  if (!uid) {
    console.error("[users.ts] deleteUserDocument called with no UID.");
    throw new Error("User UID is required to delete their document.");
  }
  const userDocRef = doc(db, 'users', uid);
  try {
    console.log(`[users.ts] deleteUserDocument: Attempting to delete user document for UID: ${uid}`);
    await deleteDoc(userDocRef);
    console.log(`[users.ts] deleteUserDocument: User document deleted for UID: ${uid}`);
  } catch (error) {
    console.error(`[users.ts] deleteUserDocument: Error deleting user document for UID ${uid}:`, error);
    throw error;
  }
};

// --- Placeholder functions for Firebase Auth user management (require Admin SDK / Cloud Functions) ---

/**
 * [PLACEHOLDER] Creates a new user in Firebase Authentication.
 * This typically requires the Firebase Admin SDK and should be implemented in a secure backend environment (e.g., Cloud Function).
 * @param email The new user's email.
 * @param password The new user's password.
 * @returns Promise resolving to the new user's UID from Auth.
 */
export const adminCreateAuthUser = async (email: string, password?: string): Promise<string /* UID */> => {
  console.warn("[users.ts] adminCreateAuthUser is a placeholder. Actual Firebase Auth user creation requires Admin SDK / Cloud Function.");
  const mockUid = `mock-auth-uid-${Date.now()}`;
  console.log(`[users.ts] adminCreateAuthUser (placeholder) returning mock UID: ${mockUid} for email: ${email}`);
  return mockUid;
};

/**
 * [PLACEHOLDER] Deletes a user from Firebase Authentication.
 * This typically requires the Firebase Admin SDK and should be implemented in a secure backend environment (e.g., Cloud Function).
 * @param uid The UID of the user to delete from Auth.
 */
export const adminDeleteAuthUser = async (uid: string): Promise<void> => {
  console.warn(`[users.ts] adminDeleteAuthUser(${uid}) is a placeholder. Actual Firebase Auth user deletion requires Admin SDK / Cloud Function.`);
};
