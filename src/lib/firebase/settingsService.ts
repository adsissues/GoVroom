import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./config";
import type { AppSettings } from "../types";

const settingsDocRef = doc(db, "settings", "app");
  
export const getAppSettings = async (): Promise<AppSettings | null> => {
    try {
      const docSnap = await getDoc(settingsDocRef);
      if (docSnap.exists()) {
        return docSnap.data() as AppSettings;
      }
      return null;
    } catch (error) {
      console.error("Error fetching app settings:", error);
      return null;
    }
  };

export const updateAppSettings = async (settings: Partial<AppSettings>): Promise<void> => {
    try {
        await setDoc(settingsDocRef, settings, { merge: true });
    } catch (error) {
        console.error("Error updating app settings:", error);
        throw error;
    }
};

export const getRecipients = async (): Promise<string[]> => {
  try {
    const settings = await getAppSettings();
    return settings?.recipients || [];
  } catch (error) {
    console.error("Error fetching recipients:", error);
    return [];
  }
};

export const updateRecipients = async (recipients: string[]): Promise<void> => {
  try {
    await updateAppSettings({ recipients });
  } catch (error) {
    console.error("Error updating recipients:", error);
    throw error;
  }
};