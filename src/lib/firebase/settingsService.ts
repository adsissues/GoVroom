
"use client"; // If any part of this might be imported by client components directly

import { db } from './config';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { AppSettings } from '@/lib/types';

const SETTINGS_COLLECTION_ID = 'app_settings';
const GLOBAL_SETTINGS_DOC_ID = 'global';

/**
 * Fetches the global application settings from Firestore.
 * @returns A promise resolving to the AppSettings object or null if not found/error.
 */
export const getAppSettings = async (): Promise<AppSettings | null> => {
  const settingsDocRef = doc(db, SETTINGS_COLLECTION_ID, GLOBAL_SETTINGS_DOC_ID);
  try {
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: 'global',
        defaultSenderAddress: data.defaultSenderAddress || '',
        defaultConsigneeAddress: data.defaultConsigneeAddress || '',
        logoutAfterMinutes: typeof data.logoutAfterMinutes === 'number' ? data.logoutAfterMinutes : undefined,
        lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated : undefined,
      } as AppSettings;
      
    }
    return null; // No settings document found
  } catch (error) {
    console.error("Error fetching app settings:", error);
    // Optionally, rethrow or handle more gracefully depending on use case
    // For now, returning null allows the UI to use fallbacks.
    return null;
  }
};

/**
 * Updates the global application settings in Firestore.
 * @param settings An object containing the settings to update (e.g., { defaultSenderAddress: 'new address' }).
 * @returns A promise resolving when the update is complete.
 */
export const updateAppSettings = async (settings: Partial<Omit<AppSettings, 'id' | 'lastUpdated'>>): Promise<void> => {
  if (!settings || Object.keys(settings).length === 0) {
    throw new Error("No settings provided to update.");
  }
  const settingsDocRef = doc(db, SETTINGS_COLLECTION_ID, GLOBAL_SETTINGS_DOC_ID);
  try {
    await setDoc(settingsDocRef, {
      ...settings,
      lastUpdated: serverTimestamp(),
    }, { merge: true }); // Use merge:true to only update provided fields and add if doc doesn't exist
  } catch (error) {
    console.error("Error updating app settings:", error);
    throw error; // Re-throw to be handled by the caller UI
  }
};
