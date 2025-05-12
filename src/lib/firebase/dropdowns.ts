
'use server';

import { db } from './config';
import { collection, getDocs, query, orderBy, DocumentData, QueryDocumentSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { SelectOption } from '@/lib/types';

export interface DropdownOptionWithId extends SelectOption {
  id: string;
}

export async function getDropdownOptions(collectionName: string): Promise<SelectOption[]> {
  try {
    const q = query(collection(db, collectionName), orderBy('label')); 
    const querySnapshot = await getDocs(q);
    const options: SelectOption[] = [];
    querySnapshot.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
      const data = docSnap.data();
      if (typeof data.value === 'string' && typeof data.label === 'string') {
        options.push({ value: data.value, label: data.label });
      } else {
        console.warn(`Document ${docSnap.id} in ${collectionName} is missing 'value' or 'label' fields, or they are not strings. Document data:`, data);
      }
    });
    return options;
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('Failed to get document because the client is offline') || 
        errorMessage.includes('The Cloud Firestore API is not available') ||
        errorMessage.includes('FIRESTORE_UNAVAILABLE') || 
        errorMessage.includes('Missing or insufficient permissions')) {
      throw new Error(`Could not fetch ${collectionName}. Please ensure Firestore is enabled, properly configured, and that you have the necessary permissions for your Firebase project. Original error: ${errorMessage}`);
    }
    throw new Error(`Could not fetch ${collectionName}. Ensure the collection exists, documents have 'value' and 'label' string fields, and are readable. Original error: ${errorMessage}`);
  }
}

export async function getDropdownOptionsWithIds(collectionName: string): Promise<DropdownOptionWithId[]> {
  try {
    const q = query(collection(db, collectionName), orderBy('label'));
    const querySnapshot = await getDocs(q);
    const options: DropdownOptionWithId[] = [];
    querySnapshot.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
      const data = docSnap.data();
      if (typeof data.value === 'string' && typeof data.label === 'string') {
        options.push({ id: docSnap.id, value: data.value, label: data.label });
      } else {
        console.warn(`Document ${docSnap.id} in ${collectionName} is missing 'value' or 'label' fields, or they are not strings for admin view.`);
      }
    });
    return options;
  } catch (error) {
    console.error(`Error fetching ${collectionName} with IDs:`, error);
    // Similar error handling as getDropdownOptions
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
     if (errorMessage.includes('Missing or insufficient permissions')) {
      throw new Error(`Could not fetch ${collectionName} with IDs. Permissions error. Original: ${errorMessage}`);
    }
    throw new Error(`Could not fetch ${collectionName} with IDs. Original error: ${errorMessage}`);
  }
}

export async function addDropdownOption(collectionName: string, optionData: { label: string; value: string }): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, collectionName), optionData);
    return docRef.id;
  } catch (error) {
    console.error(`Error adding option to ${collectionName}:`, error);
    throw new Error(`Could not add option to ${collectionName}. Original: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function updateDropdownOption(collectionName: string, docId: string, optionData: { label: string; value: string }): Promise<void> {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, optionData);
  } catch (error) {
    console.error(`Error updating option ${docId} in ${collectionName}:`, error);
    throw new Error(`Could not update option in ${collectionName}. Original: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function deleteDropdownOption(collectionName: string, docId: string): Promise<void> {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting option ${docId} from ${collectionName}:`, error);
    throw new Error(`Could not delete option from ${collectionName}. Original: ${error instanceof Error ? error.message : String(error)}`);
  }
}
