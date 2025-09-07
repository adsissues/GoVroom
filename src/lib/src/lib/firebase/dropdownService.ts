
import { db } from './config';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
  writeBatch,
  Timestamp, // Import Timestamp
} from 'firebase/firestore';
import type { DropdownItem } from '@/lib/types';

// Helper to convert Firestore doc to DropdownItem type
const itemFromFirestore = (docSnap: QueryDocumentSnapshot<DocumentData>): DropdownItem => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      // Ensure label and value are strings, provide fallbacks
      label: typeof data.label === 'string' ? data.label : `Missing Label (${docSnap.id})`,
      value: typeof data.value === 'string' ? data.value : docSnap.id,
      // Convert Timestamps if they exist
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
      lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated : undefined,
    } as DropdownItem;
};


/**
 * Fetch options for a specific dropdown collection, ordered by label.
 * @param collectionName The name of the Firestore collection.
 * @returns A promise resolving to an array of DropdownItem objects.
 */
export const getDropdownOptions = async (collectionName: string): Promise<DropdownItem[]> => {
  if (!collectionName || typeof collectionName !== 'string') {
      console.warn("getDropdownOptions called with invalid collection name:", collectionName);
      return [];
  }
  try {
      // Order by 'label' for user-friendly display in dropdowns
      const q = query(collection(db, collectionName), orderBy('label', 'asc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(itemFromFirestore);
  } catch (error) {
      console.error(`Error fetching options for collection "${collectionName}":`, error);
      // Return empty array to allow the UI to load, maybe show an error message via toast elsewhere
      return [];
  }
};

/**
 * Add a new item to a dropdown collection.
 * @param collectionName The name of the Firestore collection.
 * @param itemData An object containing the 'label' and 'value' for the new item.
 * @returns A promise resolving to the ID of the newly created document.
 */
export const addDropdownItem = async (collectionName: string, itemData: { label: string; value: string }): Promise<string> => {
    if (!collectionName || !itemData || !itemData.label || !itemData.value) {
        throw new Error("Collection name, label, and value are required to add a dropdown item.");
    }
    try {
        const docRef = await addDoc(collection(db, collectionName), {
            label: itemData.label,
            value: itemData.value,
            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp(),
        });
        return docRef.id;
    } catch (error) {
        console.error(`Error adding item to collection "${collectionName}":`, error);
        throw error; // Re-throw to be handled by the caller UI
    }
};

/**
 * Update an existing dropdown item.
 * @param collectionName The name of the Firestore collection.
 * @param itemId The ID of the document to update.
 * @param updates An object containing the fields to update (e.g., { label: 'New Label' }).
 */
export const updateDropdownItem = async (collectionName: string, itemId: string, updates: Partial<{ label: string; value: string }>): Promise<void> => {
    if (!collectionName || !itemId || !updates || Object.keys(updates).length === 0) {
        throw new Error("Collection name, item ID, and updates are required to update a dropdown item.");
    }
    const docRef = doc(db, collectionName, itemId);
    try {
        await updateDoc(docRef, {
            ...updates,
            lastUpdated: serverTimestamp(),
        });
    } catch (error) {
        console.error(`Error updating item ${itemId} in collection "${collectionName}":`, error);
        throw error;
    }
};

/**
 * Delete a dropdown item.
 * @param collectionName The name of the Firestore collection.
 * @param itemId The ID of the document to delete.
 */
export const deleteDropdownItem = async (collectionName: string, itemId: string): Promise<void> => {
    if (!collectionName || !itemId) {
        throw new Error("Collection name and item ID are required to delete a dropdown item.");
    }
    // Optional: Add checks here to see if this item is currently used in any shipments/details.
    // This is complex and might be better handled by UI constraints or background cleanup.
    // Example check (pseudo-code):
    // const isInUse = await isDropdownValueInUse(collectionName, itemId);
    // if (isInUse) throw new Error("Cannot delete item, it is currently in use.");

    const docRef = doc(db, collectionName, itemId);
    try {
        await deleteDoc(docRef);
    } catch (error) {
        console.error(`Error deleting item ${itemId} from collection "${collectionName}":`, error);
        throw error;
    }
};


/**
 * Batch delete multiple dropdown items.
 * @param collectionName The name of the Firestore collection.
 * @param itemIds An array of document IDs to delete.
 */
export const deleteDropdownItemsBatch = async (collectionName: string, itemIds: string[]): Promise<void> => {
    if (!collectionName || !Array.isArray(itemIds) || itemIds.length === 0) {
        throw new Error("Collection name and an array of item IDs are required for batch delete.");
    }
    const batch = writeBatch(db);
    itemIds.forEach(id => {
        if (typeof id === 'string' && id.trim() !== '') {
             const docRef = doc(db, collectionName, id);
             batch.delete(docRef);
        } else {
            console.warn(`Invalid item ID found in batch delete for collection ${collectionName}: ${id}`);
        }
    });
    try {
        await batch.commit();
    } catch (error) {
        console.error(`Error batch deleting items from collection "${collectionName}":`, error);
        throw error;
    }
};

/**
 * Fetch multiple dropdown collections and return them as value-label maps.
 * Useful for displaying labels corresponding to stored values.
 * @param collectionNames An array of collection names to fetch.
 * @returns A promise resolving to a record where keys are collection names and values are value-label maps.
 */
export const getDropdownOptionsMap = async (collectionNames: string[]): Promise<Record<string, Record<string, string>>> => {
    const results: Record<string, Record<string, string>> = {};
    if (!Array.isArray(collectionNames) || collectionNames.length === 0) {
        return results;
    }

    const fetchPromises = collectionNames.map(async (name) => {
        try {
            const options = await getDropdownOptions(name); // Reuse the single fetch function
            const map: Record<string, string> = {};
            options.forEach(option => {
                // Ensure value exists and is a string before adding to map
                if (option.value && typeof option.value === 'string') {
                    map[option.value] = option.label;
                } else {
                     console.warn(`Invalid value found for item ${option.id} in collection ${name}`);
                }
            });
            results[name] = map;
        } catch (error) {
            // Log error but continue fetching others
            console.error(`Failed to fetch or map options for collection "${name}":`, error);
            results[name] = {}; // Assign empty map on error for this specific collection
        }
    });

    await Promise.all(fetchPromises);
    return results;
};
