
import { db } from './config';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp, collection, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
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
        displayName: typeof data.displayName === 'string' ? data.displayName : null, // Include displayName
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
export const createUserDocument = async (uid: string, email: string | null, role: UserRole = 'user', displayName?: string | null): Promise<void> => {
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
 * [PLACEHOLDER] Deletes a user from Firebase Authentication.
 * This typically requires the Firebase Admin SDK and should be implemented in a secure backend environment (e.g., Cloud Function).
 * @param uid The UID of the user to delete from Auth.
 */
export const adminDeleteAuthUser = async (uid: string): Promise<void> => {
  console.warn(`[users.ts] adminDeleteAuthUser(${uid}) is a placeholder. Actual Firebase Auth user deletion requires Admin SDK / Cloud Function.`);
};

/**
 * Creates or updates a user document in Firestore upon login.
 * Determines the user's role and sets creation/last login timestamps.
 * @param firebaseUser The user object from Firebase Authentication.
 * @returns The resolved user object from Firestore.
 */
export const upsertUserOnLogin = async (firebaseUser: FirebaseUser): Promise<User | null> => {
  if (!firebaseUser.uid) {
    console.error("[users.ts] upsertUserOnLogin called with no UID.");
    return null;
  }
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  console.log(`[users.ts] upsertUserOnLogin: Upserting user document for UID: ${firebaseUser.uid}`);
  try {
    const userDocSnap = await getDoc(userDocRef);
    const now = serverTimestamp();

    if (userDocSnap.exists()) {
      // Document exists, just update lastLogin
      console.log(`[users.ts] upsertUserOnLogin: Document found for UID: ${firebaseUser.uid}. Updating lastLogin.`);
      await setDoc(userDocRef, { lastLogin: now }, { merge: true });
    } else {
      // Document does not exist, create it
      console.log(`[users.ts] upsertUserOnLogin: Document NOT found for UID: ${firebaseUser.uid}. Creating new document.`);
      
      // Get role from custom claims, default to 'user' if not present
      const claims = await firebaseUser.getIdTokenResult(true); // Force refresh to get latest claims
      const role: UserRole = (claims.claims.role as UserRole) || 'user';

      console.log(`[users.ts] upsertUserOnLogin: Assigning role: "${role}" for email: ${firebaseUser.email}`);
      
      const newUser: Omit<User, 'createdAt' | 'lastLogin'> & { createdAt: any; lastLogin: any } = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        role: role,
        displayName: firebaseUser.displayName,
        createdAt: now,
        lastLogin: now,
      };

      await setDoc(userDocRef, newUser);
      console.log(`[users.ts] upsertUserOnLogin: Successfully created new user document for UID: ${firebaseUser.uid}`);
    }
    
    // Return the latest user document from Firestore
    return await getUserDocument(firebaseUser.uid);

  } catch (error) {
    console.error(`[users.ts] upsertUserOnLogin: Error upserting user document for UID ${firebaseUser.uid}:`, error);
    return null;
  }
};
