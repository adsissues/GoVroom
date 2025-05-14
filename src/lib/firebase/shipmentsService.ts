
import { db } from './config';
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter,
  endBefore,
  where,
  Timestamp,
  writeBatch,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
  type DocumentSnapshot,
  collectionGroup,
  runTransaction,
  getCountFromServer,
} from 'firebase/firestore';
import type { Shipment, ShipmentDetail, ShipmentStatus, DropdownItem } from '@/lib/types';
import { ASENDIA_CUSTOMER_VALUE } from '@/lib/constants';

// --- Helper Functions ---

/**
 * Converts a Firestore document snapshot into a Shipment object.
 * Handles Timestamp conversions.
 */
export const shipmentFromFirestore = (docSnap: DocumentSnapshot<DocumentData>): Shipment => {
  const data = docSnap.data();
  if (!data) {
    throw new Error(`Document data missing for snapshot ID: ${docSnap.id}`);
  }
  return {
    id: docSnap.id,
    carrierId: data.carrierId || '',
    subcarrierId: data.subcarrierId || undefined,
    driverName: data.driverName || '',
    departureDate: data.departureDate instanceof Timestamp ? data.departureDate : Timestamp.now(),
    arrivalDate: data.arrivalDate instanceof Timestamp ? data.arrivalDate : Timestamp.now(),
    status: data.status === 'Completed' ? 'Completed' : 'Pending',
    sealNumber: data.sealNumber || undefined,
    truckRegistration: data.truckRegistration || undefined,
    trailerRegistration: data.trailerRegistration || undefined,
    senderAddress: data.senderAddress || '',
    consigneeAddress: data.consigneeAddress || '',
    lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated : Timestamp.now(),
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
    totalPallets: typeof data.totalPallets === 'number' ? data.totalPallets : undefined,
    totalBags: typeof data.totalBags === 'number' ? data.totalBags : undefined,
    totalGrossWeight: typeof data.totalGrossWeight === 'number' ? data.totalGrossWeight : undefined,
    totalTareWeight: typeof data.totalTareWeight === 'number' ? data.totalTareWeight : undefined,
    totalNetWeight: typeof data.totalNetWeight === 'number' ? data.totalNetWeight : undefined,
    asendiaGrossWeight: typeof data.asendiaGrossWeight === 'number' ? data.asendiaGrossWeight : undefined,
    asendiaTareWeight: typeof data.asendiaTareWeight === 'number' ? data.asendiaTareWeight : undefined,
    asendiaNetWeight: typeof data.asendiaNetWeight === 'number' ? data.asendiaNetWeight : undefined,
    pdfUrls: data.pdfUrls || undefined,
    scannedDocuments: Array.isArray(data.scannedDocuments) ? data.scannedDocuments : undefined,
  } as Shipment;
};

/**
 * Converts a Firestore document snapshot from the 'details' subcollection into a ShipmentDetail object.
 */
export const detailFromFirestore = (docSnap: DocumentSnapshot<DocumentData>): ShipmentDetail => {
    const data = docSnap.data();
    if (!data) {
        throw new Error(`Document data missing for detail snapshot ID: ${docSnap.id}`);
    }
    const grossWeight = typeof data.grossWeight === 'number' ? data.grossWeight : 0;
    const tareWeight = typeof data.tareWeight === 'number' ? data.tareWeight : 0;
    const netWeight = parseFloat((grossWeight - tareWeight).toFixed(3));

    return {
        id: docSnap.id,
        shipmentId: docSnap.ref.parent.parent?.id || '', 
        numPallets: typeof data.numPallets === 'number' ? data.numPallets : 0,
        numBags: typeof data.numBags === 'number' ? data.numBags : 0,
        customerId: data.customerId || '',
        serviceId: data.serviceId || '',
        formatId: data.formatId || '',
        tareWeight: tareWeight,
        grossWeight: grossWeight,
        netWeight: netWeight, 
        dispatchNumber: data.dispatchNumber || undefined,
        doeId: data.doeId || undefined,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
        lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated : Timestamp.now(),
    } as ShipmentDetail;
};


// --- Shipment CRUD ---

export const addShipment = async (shipmentData: Omit<Shipment, 'id' | 'createdAt' | 'lastUpdated' | 'totalPallets' | 'totalBags' | 'totalGrossWeight' | 'totalTareWeight' | 'totalNetWeight' | 'asendiaGrossWeight' | 'asendiaTareWeight' | 'asendiaNetWeight'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'shipments'), {
      ...shipmentData,
      departureDate: shipmentData.departureDate instanceof Date ? Timestamp.fromDate(shipmentData.departureDate) : shipmentData.departureDate,
      arrivalDate: shipmentData.arrivalDate instanceof Date ? Timestamp.fromDate(shipmentData.arrivalDate) : shipmentData.arrivalDate,
      totalPallets: 0,
      totalBags: 0,
      totalGrossWeight: 0,
      totalTareWeight: 0,
      totalNetWeight: 0,
      asendiaGrossWeight: 0,
      asendiaTareWeight: 0,
      asendiaNetWeight: 0,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding shipment:", error);
    throw error; 
  }
};

export const updateShipment = async (shipmentId: string, updates: Partial<Omit<Shipment, 'id' | 'createdAt'>>): Promise<void> => {
  const shipmentRef = doc(db, 'shipments', shipmentId);
  try {
    const dataToUpdate: DocumentData = { ...updates };
    if (updates.departureDate instanceof Date) {
      dataToUpdate.departureDate = Timestamp.fromDate(updates.departureDate);
    }
     if (updates.arrivalDate instanceof Date) {
       dataToUpdate.arrivalDate = Timestamp.fromDate(updates.arrivalDate);
    }
    dataToUpdate.lastUpdated = serverTimestamp();

    await updateDoc(shipmentRef, dataToUpdate);

    if (updates.status === 'Completed') {
       // Placeholder for future PDF generation and notifications
    }
  } catch (error) {
    console.error(`Error updating shipment ${shipmentId}:`, error);
    throw error;
  }
};

export const deleteShipment = async (shipmentId: string): Promise<void> => {
  const shipmentRef = doc(db, 'shipments', shipmentId);
  const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');

  try {
    const batch = writeBatch(db);
    const detailsSnapshot = await getDocs(query(detailsCollectionRef));
    detailsSnapshot.docs.forEach((detailDoc) => {
      batch.delete(detailDoc.ref);
    });
    batch.delete(shipmentRef);
    await batch.commit();
  } catch (error) {
    console.error(`Error deleting shipment ${shipmentId}:`, error);
    throw error;
  }
};

export const getShipmentById = async (shipmentId: string): Promise<Shipment | null> => {
    if (!shipmentId) {
        console.warn("getShipmentById called with no ID.");
        return null;
    }
    const shipmentRef = doc(db, 'shipments', shipmentId);
    try {
        const docSnap = await getDoc(shipmentRef);
        if (docSnap.exists()) {
        return shipmentFromFirestore(docSnap);
        } else {
        return null;
        }
    } catch (error) {
        console.error(`Error fetching shipment ${shipmentId}:`, error);
        throw error; 
    }
};

export const getAllShipments = async (): Promise<Shipment[]> => {
  try {
    const q = query(collection(db, 'shipments'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(shipmentFromFirestore);
  } catch (error) {
    console.error("Error fetching all shipments:", error);
    throw error;
  }
};

// --- Shipment Detail CRUD ---

export const addShipmentDetail = async (shipmentId: string, detailData: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated'>): Promise<string> => {
  if (!shipmentId) throw new Error("Parent Shipment ID is required to add a detail.");
  const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');
  try {
    const docRef = await addDoc(detailsCollectionRef, {
      ...detailData,
      netWeight: parseFloat(((detailData.grossWeight ?? 0) - (detailData.tareWeight ?? 0)).toFixed(3)),
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    });
    await recalculateShipmentTotals(shipmentId);
    return docRef.id;
  } catch (error) {
    console.error(`Error adding detail to shipment ${shipmentId}:`, error);
    throw error;
  }
};

export const updateShipmentDetail = async (shipmentId: string, detailId: string, updates: Partial<Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt'>>): Promise<void> => {
  if (!shipmentId || !detailId) throw new Error("Shipment ID and Detail ID are required to update a detail.");
  const detailRef = doc(db, 'shipments', shipmentId, 'details', detailId);
  try {
    const dataToUpdate: DocumentData = { ...updates };
    const currentDocSnap = await getDoc(detailRef);
    const currentData = currentDocSnap.data() || {};
    const grossWeight = updates.grossWeight ?? currentData.grossWeight ?? 0;
    const tareWeight = updates.tareWeight ?? currentData.tareWeight ?? 0;
    if (updates.grossWeight !== undefined || updates.tareWeight !== undefined) {
        dataToUpdate.netWeight = parseFloat((grossWeight - tareWeight).toFixed(3));
    }
    dataToUpdate.lastUpdated = serverTimestamp(); 
    await updateDoc(detailRef, dataToUpdate);
    await recalculateShipmentTotals(shipmentId);
  } catch (error) {
    console.error(`Error updating detail ${detailId} for shipment ${shipmentId}:`, error);
    throw error;
  }
};

export const deleteShipmentDetail = async (shipmentId: string, detailId: string): Promise<void> => {
  if (!shipmentId || !detailId) throw new Error("Shipment ID and Detail ID are required to delete a detail.");
  const detailRef = doc(db, 'shipments', shipmentId, 'details', detailId);
  try {
    await deleteDoc(detailRef);
    await recalculateShipmentTotals(shipmentId);
  } catch (error) {
    console.error(`Error deleting detail ${detailId} for shipment ${shipmentId}:`, error);
    throw error;
  }
};

/**
 * Gets the count of detail items for a given shipment.
 * @param shipmentId The ID of the shipment.
 * @returns A promise resolving to the number of detail items.
 */
export const getShipmentDetailsCount = async (shipmentId: string): Promise<number> => {
    if (!shipmentId) {
        console.warn("getShipmentDetailsCount called with no shipmentId.");
        return 0;
    }
    const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');
    try {
        const snapshot = await getCountFromServer(query(detailsCollectionRef));
        return snapshot.data().count;
    } catch (error) {
        console.error(`Error getting details count for shipment ${shipmentId}:`, error);
        throw error; // Re-throw for caller to handle
    }
};


// --- Calculation Logic ---

export const recalculateShipmentTotals = async (shipmentId: string): Promise<void> => {
  const shipmentRef = doc(db, 'shipments', shipmentId);
  const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');

  try {
    await runTransaction(db, async (transaction) => {
      const detailsQuerySnapshot = await getDocs(query(detailsCollectionRef)); // Fetch details
      const details: ShipmentDetail[] = detailsQuerySnapshot.docs.map(d => detailFromFirestore(d as QueryDocumentSnapshot<DocumentData>));

      let totalPallets = 0;
      let totalBags = 0;
      let totalGrossWeight = 0;
      let totalTareWeight = 0;
      let totalNetWeight = 0;
      let asendiaGrossWeight = 0;
      let asendiaTareWeight = 0;
      let asendiaNetWeight = 0;

      details.forEach(detail => {
        totalPallets += detail.numPallets || 0;
        totalBags += detail.numBags || 0;
        totalGrossWeight += detail.grossWeight || 0;
        totalTareWeight += detail.tareWeight || 0;
        totalNetWeight += detail.netWeight || 0; 

        if (detail.customerId === ASENDIA_CUSTOMER_VALUE) {
          asendiaGrossWeight += detail.grossWeight || 0;
          asendiaTareWeight += detail.tareWeight || 0;
          asendiaNetWeight += detail.netWeight || 0;
        }
      });

      const updates = {
        totalPallets: totalPallets,
        totalBags: totalBags,
        totalGrossWeight: parseFloat(totalGrossWeight.toFixed(3)),
        totalTareWeight: parseFloat(totalTareWeight.toFixed(3)),
        totalNetWeight: parseFloat(totalNetWeight.toFixed(3)),
        asendiaGrossWeight: parseFloat(asendiaGrossWeight.toFixed(3)),
        asendiaTareWeight: parseFloat(asendiaTareWeight.toFixed(3)),
        asendiaNetWeight: parseFloat(asendiaNetWeight.toFixed(3)),
        lastUpdated: serverTimestamp(), 
      };
      transaction.update(shipmentRef, updates);
    });
  } catch (error) {
    console.error(`Error recalculating totals for shipment ${shipmentId}:`, error);
    throw error; 
  }
};


// --- Dashboard Specific Queries ---

export const getDashboardStats = async (): Promise<{
    pendingCount: number;
    completedCount: number;
    totalGrossWeightSum: number; 
    lastUpdateTimestamp: Timestamp | null;
}> => {
    const shipmentsCollection = collection(db, 'shipments');
    try {
        const pendingQuery = query(shipmentsCollection, where('status', '==', 'Pending'));
        const completedQuery = query(shipmentsCollection, where('status', '==', 'Completed'));
        const pendingSnapshot = await getCountFromServer(pendingQuery);
        const completedSnapshot = await getCountFromServer(completedQuery);

        const lastUpdatedQuery = query(shipmentsCollection, orderBy('lastUpdated', 'desc'), limit(1));
        const lastUpdatedSnapshot = await getDocs(lastUpdatedQuery);
        const lastUpdateTimestamp = lastUpdatedSnapshot.empty ? null : (lastUpdatedSnapshot.docs[0].data().lastUpdated as Timestamp);

        let totalGrossWeightSum = 0;
        // This is inefficient for large datasets. Consider server-side aggregation for production.
        const allShipmentsSnapshot = await getDocs(query(shipmentsCollection));
        allShipmentsSnapshot.forEach(doc => {
            totalGrossWeightSum += doc.data().totalGrossWeight || 0;
        });

        return {
            pendingCount: pendingSnapshot.data().count,
            completedCount: completedSnapshot.data().count,
            totalGrossWeightSum: parseFloat(totalGrossWeightSum.toFixed(3)),
            lastUpdateTimestamp: lastUpdateTimestamp,
        };
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        throw error;
    }
};
