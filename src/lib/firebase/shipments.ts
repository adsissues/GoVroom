
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
  getDoc, // Added for fetching single shipment
} from 'firebase/firestore';
import type { Shipment, ShipmentStatus } from '@/lib/types';
import { countShipmentDetails } from './shipmentDetails'; // Import the counter

// Helper to convert Firestore document snapshot to Shipment type
const fromFirestoreToShipment = (docSnap: QueryDocumentSnapshot<DocumentData> | DocumentData): Shipment => {
  const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap; // Handle both snapshot and direct data
  const id = typeof (docSnap as QueryDocumentSnapshot<DocumentData>).id === 'string' ? (docSnap as QueryDocumentSnapshot<DocumentData>).id : '';
  
  return {
    id: id,
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
  };
};


export async function getShipmentFromFirestore(shipmentId: string): Promise<Shipment | null> {
  const shipmentDocRef = doc(db, 'shipments', shipmentId);
  const docSnap = await getDoc(shipmentDocRef);
  if (docSnap.exists()) {
    return fromFirestoreToShipment(docSnap);
  }
  return null;
}


export async function getShipmentsFromFirestore(filters?: Record<string, any>): Promise<Shipment[]> {
  const shipmentsCol = collection(db, 'shipments');
  let q = query(shipmentsCol, orderBy('lastUpdated', 'desc'));

  // Server-side filtering logic (can be expanded)
  if (filters) {
    if (filters.carrier && filters.carrier !== 'all_items_selection_sentinel') {
      q = query(q, where('carrier', '==', filters.carrier));
    }
    if (filters.status && filters.status !== 'all_items_selection_sentinel') {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters.dateRange?.from) {
      q = query(q, where('departureDate', '>=', Timestamp.fromDate(new Date(filters.dateRange.from))));
    }
    if (filters.dateRange?.to) {
      q = query(q, where('arrivalDate', '<=', Timestamp.fromDate(new Date(filters.dateRange.to))));
    }
  }

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => fromFirestoreToShipment(doc as QueryDocumentSnapshot<DocumentData>));
}

export async function addShipmentToFirestore(
  shipmentData: Omit<Shipment, 'id' | 'lastUpdated' | 'status'> & { status: boolean; departureDate: Date; arrivalDate: Date }
): Promise<string> {
  const { status, ...restOfData } = shipmentData;
  const docRef = await addDoc(collection(db, 'shipments'), {
    ...restOfData,
    departureDate: Timestamp.fromDate(shipmentData.departureDate),
    arrivalDate: Timestamp.fromDate(shipmentData.arrivalDate),
    lastUpdated: serverTimestamp(), 
    status: status ? 'Completed' : 'Pending', 
  });
  return docRef.id;
}

export async function deleteShipmentFromFirestore(shipmentId: string): Promise<void> {
  // Check if the shipment has any details
  const detailsCount = await countShipmentDetails(shipmentId);
  if (detailsCount > 0) {
    throw new Error(`Cannot delete shipment. It has ${detailsCount} associated detail(s). Please delete them first.`);
  }
  await deleteDoc(doc(db, 'shipments', shipmentId));
}

// getShipmentStats is kept as it might be useful for other non-realtime summaries or reports.
// The dashboard page now calculates its stats client-side from real-time data.
export async function getShipmentStats() {
    const shipmentsCol = collection(db, 'shipments');
    
    const pendingQuery = query(shipmentsCol, where('status', '==', 'Pending'));
    const completedQuery = query(shipmentsCol, where('status', '==', 'Completed'));

    let pendingCount = 0;
    let completedCount = 0;
    let totalWeight = 0;
    let lastUpdated: Date | null = null;

    try {
        const pendingSnapshot = await getCountFromServer(pendingQuery);
        pendingCount = pendingSnapshot.data().count;

        const completedSnapshot = await getCountFromServer(completedQuery);
        completedCount = completedSnapshot.data().count;
    
        const allShipmentsSnapshot = await getDocs(query(shipmentsCol, orderBy('lastUpdated', 'desc')));
        totalWeight = allShipmentsSnapshot.docs.reduce((acc, currDoc) => acc + (currDoc.data().totalWeight || 0), 0);
        
        if (allShipmentsSnapshot.docs.length > 0) {
            const mostRecentShipmentData = allShipmentsSnapshot.docs[0].data();
            if (mostRecentShipmentData.lastUpdated) {
                 lastUpdated = (mostRecentShipmentData.lastUpdated as Timestamp).toDate();
            }
        }
    } catch (e) {
        console.error("Error fetching shipment stats: ", e);
        if (e instanceof Error && (e.message.includes("Missing or insufficient permissions") || e.message.includes("The caller does not have permission"))) {
            throw new Error("Missing or insufficient permissions to fetch shipment stats. Please check your Firestore security rules.");
        } else if (e instanceof Error && e.message.includes("The database (default) does not exist")) {
            throw new Error("Firestore database not found. Please ensure Firestore is enabled for your Firebase project and environment variables are correct.");
        }
        throw e; // Re-throw other errors
    }


    return {
        pendingCount,
        completedCount,
        totalWeight,
        lastUpdated,
    };
}

