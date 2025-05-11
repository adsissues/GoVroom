
import { db } from './config';
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
  query,
  orderBy,
  serverTimestamp,
  DocumentData,
  QueryDocumentSnapshot,
  where,
  getCountFromServer,
} from 'firebase/firestore';
import type { Shipment, ShipmentStatus } from '@/lib/types';

// Helper to convert Firestore document snapshot to Shipment type
const fromFirestore = (docSnap: QueryDocumentSnapshot<DocumentData>): Shipment => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    carrier: data.carrier,
    subcarrier: data.subcarrier,
    driverName: data.driverName,
    departureDate: (data.departureDate as Timestamp)?.toDate(),
    arrivalDate: (data.arrivalDate as Timestamp)?.toDate(),
    status: data.status as ShipmentStatus,
    sealNumber: data.sealNumber,
    truckRegistration: data.truckRegistration,
    trailerRegistration: data.trailerRegistration,
    senderAddress: data.senderAddress,
    consigneeAddress: data.consigneeAddress,
    totalWeight: data.totalWeight,
    lastUpdated: (data.lastUpdated as Timestamp)?.toDate(),
    // details field is not handled here, assuming it's fetched separately if needed
  };
};

export async function getShipmentsFromFirestore(filters?: Record<string, any>): Promise<Shipment[]> {
  const shipmentsCol = collection(db, 'shipments');
  let q = query(shipmentsCol, orderBy('lastUpdated', 'desc'));

  if (filters) {
    if (filters.carrier && filters.carrier !== 'all_items_selection_sentinel') {
      q = query(q, where('carrier', '==', filters.carrier));
    }
    if (filters.driverName) {
      // Firestore does not support case-insensitive partial string matches directly.
      // For a production app, consider using a search service like Algolia/Typesense
      // or structuring data for easier querying (e.g., an array of keywords).
      // This basic filter will look for exact matches or use client-side filtering.
      // For now, this server-side part of driverName filter will be an exact match if used.
      // The current app structure primarily filters client-side.
    }
    if (filters.status && filters.status !== 'all_items_selection_sentinel') {
      q = query(q, where('status', '==', filters.status));
    }
    // Date range filtering requires compound queries or careful structuring.
    // This is a simplified version.
    if (filters.dateRange?.from) {
      q = query(q, where('departureDate', '>=', Timestamp.fromDate(new Date(filters.dateRange.from))));
    }
    if (filters.dateRange?.to) {
      q = query(q, where('arrivalDate', '<=', Timestamp.fromDate(new Date(filters.dateRange.to))));
    }
    // Customer filter - assuming customer is a top-level field on shipment for this to work server-side
    // if (filters.customer && filters.customer !== 'all_items_selection_sentinel') {
    //   q = query(q, where('customer', '==', filters.customer)); // Requires 'customer' field in DB
    // }
  }

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(fromFirestore);
}

export async function addShipmentToFirestore(
  shipmentData: Omit<Shipment, 'id' | 'lastUpdated' | 'details' | 'status'> & { status: boolean; departureDate: Date; arrivalDate: Date }
): Promise<string> {
  const { status, ...restOfData } = shipmentData;
  const docRef = await addDoc(collection(db, 'shipments'), {
    ...restOfData,
    departureDate: Timestamp.fromDate(shipmentData.departureDate),
    arrivalDate: Timestamp.fromDate(shipmentData.arrivalDate),
    lastUpdated: serverTimestamp(), // Use server timestamp for reliability
    status: status ? 'Completed' : 'Pending', // Convert boolean from form to string
  });
  return docRef.id;
}

export async function deleteShipmentFromFirestore(shipmentId: string): Promise<void> {
  await deleteDoc(doc(db, 'shipments', shipmentId));
}

export async function getShipmentStats() {
    const shipmentsCol = collection(db, 'shipments');
    
    const pendingQuery = query(shipmentsCol, where('status', '==', 'Pending'));
    const completedQuery = query(shipmentsCol, where('status', '==', 'Completed'));

    const pendingSnapshot = await getCountFromServer(pendingQuery);
    const completedSnapshot = await getCountFromServer(completedQuery);

    // For total weight, we'd need to fetch all documents and sum, or maintain a counter.
    // This can be inefficient for large datasets. Fetching all for now:
    const allShipmentsSnapshot = await getDocs(query(shipmentsCol));
    const totalWeight = allShipmentsSnapshot.docs.reduce((acc, currDoc) => acc + (currDoc.data().totalWeight || 0), 0);
    
    let lastUpdated: Date | null = null;
    if (allShipmentsSnapshot.docs.length > 0) {
        const sortedByLastUpdated = allShipmentsSnapshot.docs
            .map(d => (d.data().lastUpdated as Timestamp)?.toDate())
            .filter(d => d instanceof Date)
            .sort((a, b) => b.getTime() - a.getTime());
        if (sortedByLastUpdated.length > 0) {
            lastUpdated = sortedByLastUpdated[0];
        }
    }

    return {
        pendingCount: pendingSnapshot.data().count,
        completedCount: completedSnapshot.data().count,
        totalWeight,
        lastUpdated,
    };
}
