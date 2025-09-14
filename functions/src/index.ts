import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Callable function for admin to create new users
export const createNewUser = functions.https.onCall(async (data, context) => {
  // 1. Check if the caller is authenticated and is an admin
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const callerUid = context.auth.uid;
  const callerUserRecord = await admin.auth().getUser(callerUid);
  if (!callerUserRecord.customClaims || !callerUserRecord.customClaims.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can create new users.'
    );
  }

  const { email, password, role } = data;

  if (!email || !password || !role) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with an email, password, and role.'
    );
  }

  if (role !== 'admin' && role !== 'user') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The role must be either "admin" or "user".'
    );
  }

  try {
    // 2. Create user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      emailVerified: true, // Assume admin-created users are verified
      disabled: false,
    });

    // 3. Set custom claims for the user's role
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: role });

    // 4. Create user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: userRecord.email,
      role: role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp(), // Set initial lastLogin
    });

    return { uid: userRecord.uid, email: userRecord.email, role: role };

  } catch (error: any) {
    if (error.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError(
        'already-exists',
        'The email address is already in use by another account.'
      );
    }
    console.error('Error creating new user:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to create new user.',
      error.message
    );
  }
});

// Auth trigger to create a user document in Firestore when a new user signs up
export const onAuthUserCreate = functions.auth.user().onCreate(async (user) => {
  if (!user.email) {
    console.warn(`User ${user.uid} created without an email. Skipping Firestore document creation.`);
    return null;
  }

  try {
    // Set default role to 'user'
    const defaultRole = 'user';

    // Set custom claims for the user's role
    await admin.auth().setCustomUserClaims(user.uid, { role: defaultRole });

    // Create user document in Firestore
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      email: user.email,
      role: defaultRole,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Firestore user document created for UID: ${user.uid} with role: ${defaultRole}`);
    return null; // Cloud Functions should return null or a Promise<any>
  } catch (error) {
    console.error(`Error creating Firestore user document for UID: ${user.uid}`, error);
    return null;
  }
});