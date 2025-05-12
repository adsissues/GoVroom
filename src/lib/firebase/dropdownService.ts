
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
} from 'firebase/firestore';
import type { DropdownItem } from '@/lib/types';


// Helper to convert Firestore doc to DropdownItem type
const itemFromFirestore = (doc: QueryDocumentSnapshot<DocumentData>): DropdownItem => {
    const data = doc.data();
    return {
      id: doc.id,
      label: data.label || `Missing Label (${doc.id})`, // Provide a fallback label
      value: data.value || doc.id, // Provide a fallback value using ID
    } as DropdownItem;
};


// Fetch options for a specific dropdown collection
export const getDropdownOptions = async (collectionName: string): Promise<DropdownItem[]> => {
  if (!collectionName) {
      console.warn("getDropdownOptions called with empty collection name.");
      return [];
  }
  try {
      const q = query(collection(db, collectionName), orderBy('label', 'asc')); // Order by label for display
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(itemFromFirestore);
  } catch (error) {
      console.error(`Error fetching options for ${collectionName}:`, error);
      // Depending on how critical dropdowns are, you might re-throw or return empty
      // Returning empty allows the form to load, but with potentially missing options
      return [];
  }
};

// Add a new item to a dropdown collection
export const addDropdownItem = async (collectionName: string, itemData: { label: string; value: string }): Promise<string> => {
    const docRef = await addDoc(collection(db, collectionName), {
        ...itemData,
        createdAt: serverTimestamp(), // Optional: track creation time
    });
    return docRef.id;
};

// Update an existing dropdown item
export const updateDropdownItem = async (collectionName: string, itemId: string, updates: Partial<{ label: string; value: string }>): Promise<void> => {
    const docRef = doc(db, collectionName, itemId);
    await updateDoc(docRef, {
        ...updates,
        lastUpdated: serverTimestamp(), // Optional: track update time
    });
};

// Delete a dropdown item
export const deleteDropdownItem = async (collectionName: string, itemId: string): Promise<void> => {
    // Optional: Add checks here to see if this item is currently used in any shipments/details
    // This might involve querying the shipments/details collections, which can be complex/slow.
    // Consider handling this via UI constraints or background cleanup functions instead.

    const docRef = doc(db, collectionName, itemId);
    await deleteDoc(docRef);
};


// Batch delete multiple dropdown items
export const deleteDropdownItemsBatch = async (collectionName: string, itemIds: string[]): Promise<void> => {
    const batch = writeBatch(db);
    itemIds.forEach(id => {
        const docRef = doc(db, collectionName, id);
        batch.delete(docRef);
    });
    await batch.commit();
};

// Fetch multiple dropdown collections and return them as value-label maps
export const getDropdownOptionsMap = async (collectionNames: string[]): Promise<Record<string, Record<string, string>>> => {
    const results: Record<string, Record<string, string>> = {};
    const promises = collectionNames.map(async (name) => {
        try {
            const options = await getDropdownOptions(name);
            const map: Record<string, string> = {};
            options.forEach(option => {
                map[option.value] = option.label;
            });
            results[name] = map;
        } catch (error) {
            console.error(`Failed to fetch or map options for ${name}:`, error);
            results[name] = {}; // Assign empty map on error
        }
    });
    await Promise.all(promises);
    return results;
};
```