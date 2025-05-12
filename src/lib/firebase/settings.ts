
'use server';

import { db } from './config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { AppSettings } from '@/lib/types';
import { DEFAULT_SENDER_ADDRESS, DEFAULT_CONSIGNEE_ADDRESS } from '@/lib/constants';

const APP_SETTINGS_COLLECTION = 'config'; // A general collection for config/settings
const APP_SETTINGS_DOC_ID = 'appSettings';    // Specific document for app-wide settings

export async function getAppSettingsFromFirestore(): Promise<AppSettings | null> {
  try {
    const settingsDocRef = doc(db, APP_SETTINGS_COLLECTION, APP_SETTINGS_DOC_ID);
    const docSnap = await getDoc(settingsDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        defaultSenderAddress: data.defaultSenderAddress || DEFAULT_SENDER_ADDRESS,
        defaultConsigneeAddress: data.defaultConsigneeAddress || DEFAULT_CONSIGNEE_ADDRESS,
      };
    } else {
      // If no settings document exists, return constants as defaults
      // Optionally, create the document here with default values
      // await updateAppSettingsInFirestore({ defaultSenderAddress: DEFAULT_SENDER_ADDRESS, defaultConsigneeAddress: DEFAULT_CONSIGNEE_ADDRESS });
      return {
        defaultSenderAddress: DEFAULT_SENDER_ADDRESS,
        defaultConsigneeAddress: DEFAULT_CONSIGNEE_ADDRESS,
      };
    }
  } catch (error) {
    console.error("Error fetching app settings from Firestore:", error);
    // Fallback to constants in case of error
    return {
        defaultSenderAddress: DEFAULT_SENDER_ADDRESS,
        defaultConsigneeAddress: DEFAULT_CONSIGNEE_ADDRESS,
    };
  }
}

export async function updateAppSettingsInFirestore(settings: AppSettings): Promise<void> {
  try {
    const settingsDocRef = doc(db, APP_SETTINGS_COLLECTION, APP_SETTINGS_DOC_ID);
    await setDoc(settingsDocRef, { 
      ...settings, 
      lastUpdated: serverTimestamp() 
    }, { merge: true }); // Merge true to avoid overwriting other potential settings in the doc
  } catch (error) {
    console.error("Error updating app settings in Firestore:", error);
    throw new Error(`Could not update app settings. Original: ${error instanceof Error ? error.message : String(error)}`);
  }
}
