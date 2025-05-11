'use server';

import { db } from './config';
import { collection, getDocs, query, orderBy, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import type { SelectOption } from '@/lib/types';

export async function getDropdownOptions(collectionName: string): Promise<SelectOption[]> {
  try {
    const q = query(collection(db, collectionName), orderBy('label')); // Order by label for better UX
    const querySnapshot = await getDocs(q);
    const options: SelectOption[] = [];
    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      // Ensure 'value' and 'label' fields exist and are strings
      if (typeof data.value === 'string' && typeof data.label === 'string') {
        options.push({ value: data.value, label: data.label });
      } else {
        console.warn(`Document ${doc.id} in ${collectionName} is missing 'value' or 'label' fields, or they are not strings. Document data:`, data);
      }
    });
    return options;
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('Failed to get document because the client is offline') || 
        errorMessage.includes('The Cloud Firestore API is not available') ||
        errorMessage.includes('FIRESTORE_UNAVAILABLE') || // Common gRPC error code
        errorMessage.includes('Missing or insufficient permissions')) { // Permissions issue
      throw new Error(`Could not fetch ${collectionName}. Please ensure Firestore is enabled, properly configured, and that you have the necessary permissions for your Firebase project. Original error: ${errorMessage}`);
    }
    throw new Error(`Could not fetch ${collectionName}. Ensure the collection exists, documents have 'value' and 'label' string fields, and are readable. Original error: ${errorMessage}`);
  }
}
