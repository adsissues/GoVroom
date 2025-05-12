
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
  where,
  orderBy,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
  writeBatch,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  serverTimestamp,
  getCountFromServer,
} from 'firebase/firestore';
import type { Shipment, ShipmentStatus, ShipmentDetail } from '@/lib/types';

const shipmentsCollection = collection(db, 'shipments');

// Helper to convert Firestore doc to Shipment type
export const fromFirestore = (doc: QueryDocumentSnapshot<DocumentData>): Shipment => {
    const data = doc.data();
    return {
      id: doc.id,
      carrierId: data.carrierId,
      subcarrierId: data.subcarrierId,
      driverName: data.driverName,
      departureDate: data.departureDate, // Assume it's already a Timestamp
      arrivalDate: data.arrivalDate,     // Assume it's already a Timestamp
      status: data.status,
      sealNumber: data.sealNumber,
      truckRegistration: data.truckRegistration,
      trailerRegistration: data.trailerRegistration,
      senderAddress: data.senderAddress,
      consigneeAddress: data.consigneeAddress,
      lastUpdated: data.lastUpdated, // Assume it's already a Timestamp
      createdAt: data.createdAt,     // Assume it's already a Timestamp
      totalPallets: data.totalPallets,
      totalBags: data.totalBags,
      totalGrossWeight: data.totalGrossWeight,
      totalTareWeight: data.totalTareWeight,
      totalNetWeight: data.totalNetWeight,
      asendiaGrossWeight: data.asendiaGrossWeight,
      asendiaTareWeight: data.asendiaTareWeight,
      asendiaNetWeight: data.asendiaNetWeight,
    } as Shipment;
};

// Helper to convert Firestore doc to ShipmentDetail type
export const detailFromFirestore = (doc: QueryDocumentSnapshot<DocumentData>): ShipmentDetail => {
    const data = doc.data();
    return {
        id: doc.id,
        shipmentId: data.shipmentId, // Should match parent doc ID ideally, but might be stored for context
        numPallets: data.numPallets,
        numBags: data.numBags,
        customerId: data.customerId,
        serviceId: data.serviceId,
        formatId: data.formatId,
        tareWeight: data.tareWeight,
        grossWeight: data.grossWeight,
        dispatchNumber: data.dispatchNumber,
        doeId: data.doeId,
        createdAt: data.createdAt,
        lastUpdated: data.lastUpdated,
        netWeight: data.netWeight,
    } as ShipmentDetail;
};


// Add a new shipment
export const addShipment = async (shipmentData: Omit<Shipment, 'id' | 'lastUpdated' | 'createdAt'>): Promise<string> => {
  const docRef = await addDoc(shipmentsCollection, {
    ...shipmentData,
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
  });
  return docRef.id;
};

// Get all shipments (consider pagination for large datasets)
export const getAllShipments = async (): Promise<Shipment[]> => {
  const q = query(shipmentsCollection, orderBy('lastUpdated', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(fromFirestore);
};

// Get shipments by status (for dashboard) - potentially limited
export const getShipmentsByStatus = async (status: ShipmentStatus, countLimit: number = 5): Promise<Shipment[]> => {
  const q = query(
    shipmentsCollection,
    where('status', '==', status),
    orderBy('lastUpdated', 'desc'),
    limit(countLimit)
   );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(fromFirestore);
};

// Get dashboard summary stats (example: count pending/completed)
export const getDashboardStats = async () => {
    const pendingQuery = query(shipmentsCollection, where('status', '==', 'Pending'));
    const completedQuery = query(shipmentsCollection, where('status', '==', 'Completed'));

    const pendingSnapshot = await getCountFromServer(pendingQuery);
    const completedSnapshot = await getCountFromServer(completedQuery);

    // Note: Calculating total weight requires fetching documents or using aggregation (more complex/costly).
    // This might be better done via a Cloud Function triggered on updates.
    // For now, we'll just return counts.

    // Fetch the most recently updated shipment to show 'Last Updated'
    let lastUpdated: Timestamp | null = null;
    const lastUpdatedQuery = query(shipmentsCollection, orderBy('lastUpdated', 'desc'), limit(1));
    const lastUpdatedSnapshot = await getDocs(lastUpdatedQuery);
    if (!lastUpdatedSnapshot.empty) {
        lastUpdated = lastUpdatedSnapshot.docs[0].data().lastUpdated as Timestamp;
    }


    return {
        pendingCount: pendingSnapshot.data().count,
        completedCount: completedSnapshot.data().count,
        lastUpdateTimestamp: lastUpdated,
        // totalWeight: 0, // Placeholder - implement aggregation separately
    };
};


// Get a single shipment by ID
export const getShipmentById = async (id: string): Promise<Shipment | null> => {
  const docRef = doc(db, 'shipments', id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? fromFirestore(docSnap as QueryDocumentSnapshot<DocumentData>) : null;
};

// Update a shipment
export const updateShipment = async (id: string, updates: Partial<Shipment>): Promise<void> => {
  const docRef = doc(db, 'shipments', id);
  await updateDoc(docRef, {
      ...updates,
      lastUpdated: serverTimestamp(), // Always update the timestamp
  });
};

// Delete a shipment (Use with caution! Consider soft delete or archiving)
export const deleteShipment = async (id: string): Promise<void> => {
    const shipmentRef = doc(db, 'shipments', id);
    const detailsCollectionRef = collection(db, 'shipments', id, 'details');

    // Check if details exist before deleting the parent
    const detailsSnapshot = await getDocs(query(detailsCollectionRef, limit(1)));
    if (!detailsSnapshot.empty) {
        throw new Error("Cannot delete shipment with existing detail items. Please delete items first.");
        // OR: Implement cascading delete using batch writes or Cloud Function
    }

    await deleteDoc(shipmentRef);
};


// --- Shipment Detail Functions ---

const getDetailsCollectionRef = (shipmentId: string) => collection(db, 'shipments', shipmentId, 'details');

// Add a new shipment detail
export const addShipmentDetail = async (shipmentId: string, detailData: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated'>): Promise<string> => {
  const detailsCollectionRef = getDetailsCollectionRef(shipmentId);
  const docRef = await addDoc(detailsCollectionRef, {
    ...detailData,
    shipmentId: shipmentId, // Ensure parent ID is stored
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
  });

  // TODO: Trigger recalculation of parent shipment totals (Cloud Function recommended)
  // await recalculateShipmentTotals(shipmentId);

  return docRef.id;
};

// Update a shipment detail
export const updateShipmentDetail = async (shipmentId: string, detailId: string, updates: Partial<Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt'>>): Promise<void> => {
  const detailDocRef = doc(db, 'shipments', shipmentId, 'details', detailId);
  await updateDoc(detailDocRef, {
    ...updates,
    lastUpdated: serverTimestamp(),
  });

   // TODO: Trigger recalculation of parent shipment totals (Cloud Function recommended)
   // await recalculateShipmentTotals(shipmentId);
};

// Delete a shipment detail
export const deleteShipmentDetail = async (shipmentId: string, detailId: string): Promise<void> => {
  const detailDocRef = doc(db, 'shipments', shipmentId, 'details', detailId);
  await deleteDoc(detailDocRef);

  // TODO: Trigger recalculation of parent shipment totals (Cloud Function recommended)
  // await recalculateShipmentTotals(shipmentId);
};

// Get all details for a specific shipment (used in ShipmentDetailsList)
// Note: Real-time listening is handled directly in the component for this subcollection.
// This function could be used for one-time fetches if needed.
export const getShipmentDetails = async (shipmentId: string): Promise<ShipmentDetail[]> => {
    const detailsCollectionRef = getDetailsCollectionRef(shipmentId);
    const q = query(detailsCollectionRef, orderBy('createdAt', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => detailFromFirestore(doc as QueryDocumentSnapshot<DocumentData>));
};

// --- Recalculation Logic (Placeholder - Best as Cloud Function) ---
// This is a basic client-side example. A Cloud Function triggered by detail writes is more robust.
export const recalculateShipmentTotals = async (shipmentId: string): Promise<void> => {
     console.log(`Placeholder: Recalculating totals for shipment ${shipmentId}`);
    // const shipmentRef = doc(db, 'shipments', shipmentId);
    // const details = await getShipmentDetails(shipmentId);

    // let totalPallets = 0;
    // let totalBags = 0;
    // let totalGrossWeight = 0;
    // let totalTareWeight = 0;
    // let asendiaGrossWeight = 0;
    // let asendiaTareWeight = 0;

    // const customerMap = await getDropdownOptionsMap(['customers']); // Fetch customer labels if needed

    // for (const detail of details) {
    //     totalPallets += detail.numPallets;
    //     totalBags += detail.numBags;
    //     totalGrossWeight += detail.grossWeight;
    //     totalTareWeight += detail.tareWeight;

    //     // Check if customer is Asendia (using ASENDIA_CUSTOMER_VALUE constant)
    //     if (detail.customerId === ASENDIA_CUSTOMER_VALUE) {
    //         asendiaGrossWeight += detail.grossWeight;
    //         asendiaTareWeight += detail.tareWeight;
    //     }
    // }

    // const totalNetWeight = totalGrossWeight - totalTareWeight;
    // const asendiaNetWeight = asendiaGrossWeight - asendiaTareWeight;

    // const updates: Partial<Shipment> = {
    //     totalPallets,
    //     totalBags,
    //     totalGrossWeight: parseFloat(totalGrossWeight.toFixed(3)),
    //     totalTareWeight: parseFloat(totalTareWeight.toFixed(3)),
    //     totalNetWeight: parseFloat(totalNetWeight.toFixed(3)),
    //     asendiaGrossWeight: parseFloat(asendiaGrossWeight.toFixed(3)),
    //     asendiaTareWeight: parseFloat(asendiaTareWeight.toFixed(3)),
    //     asendiaNetWeight: parseFloat(asendiaNetWeight.toFixed(3)),
    //     lastUpdated: serverTimestamp(), // Update parent timestamp as well
    // };

    // await updateDoc(shipmentRef, updates);
    // console.log(`Shipment ${shipmentId} totals updated.`);
};
```