
'use server';

import { db } from './config';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import type { ShipmentDetail } from '@/lib/types';

const fromFirestoreToShipmentDetail = (docSnap: QueryDocumentSnapshot<DocumentData>): ShipmentDetail => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    shipmentId: data.shipmentId, // This will be the parent shipment's ID
    numberOfPallets: data.numberOfPallets,
    numberOfBags: data.numberOfBags,
    customer: data.customer,
    service: data.service,
    format: data.format,
    tareWeight: data.tareWeight,
    grossWeight: data.grossWeight,
    dispatchNumber: data.dispatchNumber,
    doe: data.doe,
    // createdAt: (data.createdAt as Timestamp)?.toDate(), // Example if you add timestamps
    // updatedAt: (data.updatedAt as Timestamp)?.toDate(), // Example
  };
};

export async function getShipmentDetailsFromFirestore(shipmentId: string): Promise<ShipmentDetail[]> {
  if (!shipmentId) {
    console.error("Shipment ID is required to fetch details.");
    return [];
  }
  try {
    const detailsColRef = collection(db, 'shipments', shipmentId, 'details');
    // You might want to order by a specific field, e.g., createdAt or an order field
    const q = query(detailsColRef, orderBy('numberOfPallets')); // Example ordering
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(fromFirestoreToShipmentDetail);
  } catch (error) {
    console.error(`Error fetching details for shipment ${shipmentId}:`, error);
    throw new Error(`Could not fetch shipment details. Original error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function addShipmentDetailToFirestore(
  shipmentId: string,
  detailData: Omit<ShipmentDetail, 'id' | 'shipmentId'>
): Promise<string> {
  if (!shipmentId) {
    throw new Error("Shipment ID is required to add a detail.");
  }
  try {
    const detailsColRef = collection(db, 'shipments', shipmentId, 'details');
    const docRef = await addDoc(detailsColRef, {
      ...detailData,
      shipmentId, // Ensure parent ID is stored
      // createdAt: serverTimestamp(), // Example
      // updatedAt: serverTimestamp(), // Example
    });
    return docRef.id;
  } catch (error) {
    console.error(`Error adding detail to shipment ${shipmentId}:`, error);
    throw new Error(`Could not add shipment detail. Original error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function updateShipmentDetailInFirestore(
  shipmentId: string,
  detailId: string,
  updates: Partial<Omit<ShipmentDetail, 'id' | 'shipmentId'>>
): Promise<void> {
  if (!shipmentId || !detailId) {
    throw new Error("Shipment ID and Detail ID are required to update a detail.");
  }
  try {
    const detailDocRef = doc(db, 'shipments', shipmentId, 'details', detailId);
    await updateDoc(detailDocRef, {
      ...updates,
      // updatedAt: serverTimestamp(), // Example
    });
  } catch (error) {
    console.error(`Error updating detail ${detailId} for shipment ${shipmentId}:`, error);
    throw new Error(`Could not update shipment detail. Original error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function deleteShipmentDetailFromFirestore(shipmentId: string, detailId: string): Promise<void> {
  if (!shipmentId || !detailId) {
    throw new Error("Shipment ID and Detail ID are required to delete a detail.");
  }
  try {
    const detailDocRef = doc(db, 'shipments', shipmentId, 'details', detailId);
    await deleteDoc(detailDocRef);
  } catch (error) {
    console.error(`Error deleting detail ${detailId} for shipment ${shipmentId}:`, error);
    throw new Error(`Could not delete shipment detail. Original error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function countShipmentDetails(shipmentId: string): Promise<number> {
    if (!shipmentId) return 0;
    const detailsColRef = collection(db, 'shipments', shipmentId, 'details');
    const snapshot = await getDocs(query(detailsColRef)); // Basic query to get all docs
    return snapshot.size;
}
