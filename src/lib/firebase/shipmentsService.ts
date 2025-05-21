
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
import { PRIMARY_ASENDIA_CUSTOMER_ID_FOR_DASHBOARD_BREAKDOWN } from '@/lib/constants';

// --- Helper Functions ---

export const shipmentFromFirestore = (docSnap: DocumentSnapshot<DocumentData>): Shipment => {
  const data = docSnap.data();
  if (!data) {
    // This case should ideally not happen if docSnap.exists() is checked before calling
    console.error(`Document data missing for snapshot ID: ${docSnap.id}`);
    // Return a minimal Shipment object or throw an error
    return { id: docSnap.id } as Shipment; // Or handle more gracefully
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
    totalPallets: typeof data.totalPallets === 'number' ? data.totalPallets : 0,
    totalBags: typeof data.totalBags === 'number' ? data.totalBags : 0,
    totalGrossWeight: typeof data.totalGrossWeight === 'number' ? data.totalGrossWeight : 0,
    totalTareWeight: typeof data.totalTareWeight === 'number' ? data.totalTareWeight : 0,
    totalNetWeight: typeof data.totalNetWeight === 'number' ? data.totalNetWeight : 0,
    asendiaGrossWeight: typeof data.asendiaGrossWeight === 'number' ? data.asendiaGrossWeight : 0,
    asendiaTareWeight: typeof data.asendiaTareWeight === 'number' ? data.asendiaTareWeight : 0,
    asendiaNetWeight: typeof data.asendiaNetWeight === 'number' ? data.asendiaNetWeight : 0,
    pdfUrls: data.pdfUrls || undefined,
    scannedDocuments: Array.isArray(data.scannedDocuments) ? data.scannedDocuments : undefined,
  } as Shipment;
};

export const detailFromFirestore = (docSnap: DocumentSnapshot<DocumentData>): ShipmentDetail => {
    const data = docSnap.data();
    if (!data) {
        console.error(`Document data missing for detail snapshot ID: ${docSnap.id}`);
        return { id: docSnap.id, shipmentId: docSnap.ref.parent.parent?.id || '' } as ShipmentDetail;
    }
    const grossWeight = typeof data.grossWeight === 'number' ? data.grossWeight : 0;
    const tareWeight = typeof data.tareWeight === 'number' ? data.tareWeight : 0;
    const netWeight = parseFloat((grossWeight - tareWeight).toFixed(3));

    return {
        id: docSnap.id,
        shipmentId: docSnap.ref.parent.parent?.id || '', // Get parent shipmentId
        numPallets: typeof data.numPallets === 'number' ? data.numPallets : 0,
        numBags: typeof data.numBags === 'number' ? data.numBags : 0,
        customerId: data.customerId || '',
        serviceId: data.serviceId || '',
        formatId: data.formatId || '',
        tareWeight: tareWeight,
        grossWeight: grossWeight,
        netWeight: netWeight, // Calculated net weight
        dispatchNumber: data.dispatchNumber || undefined,
        doeId: data.doeId || undefined,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
        lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated : Timestamp.now(),
    } as ShipmentDetail;
};


// --- Shipment CRUD ---

export const addShipment = async (shipmentData: Partial<Omit<Shipment, 'id' | 'createdAt' | 'lastUpdated' | 'totalPallets' | 'totalBags' | 'totalGrossWeight' | 'totalTareWeight' | 'totalNetWeight' | 'asendiaGrossWeight' | 'asendiaTareWeight' | 'asendiaNetWeight'>>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'shipments'), {
      ...shipmentData,
      // Ensure dates are Timestamps if they are Date objects
      departureDate: shipmentData.departureDate instanceof Date ? Timestamp.fromDate(shipmentData.departureDate) : shipmentData.departureDate,
      arrivalDate: shipmentData.arrivalDate instanceof Date ? Timestamp.fromDate(shipmentData.arrivalDate) : shipmentData.arrivalDate,
      // Initialize totals
      totalPallets: 0,
      totalBags: 0,
      totalGrossWeight: 0,
      totalTareWeight: 0,
      totalNetWeight: 0,
      asendiaGrossWeight: 0,
      asendiaTareWeight: 0,
      asendiaNetWeight: 0,
      status: shipmentData.status || 'Pending', // Default status
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding shipment:", error);
    throw error; // Re-throw to be handled by the caller
  }
};

export const updateShipment = async (shipmentId: string, updates: Partial<Omit<Shipment, 'id' | 'createdAt'>>): Promise<void> => {
  const shipmentRef = doc(db, 'shipments', shipmentId);
  try {
    const dataToUpdate: DocumentData = { ...updates };
    // Convert Date objects to Timestamps if present
    if (updates.departureDate instanceof Date) {
      dataToUpdate.departureDate = Timestamp.fromDate(updates.departureDate);
    }
     if (updates.arrivalDate instanceof Date) {
       dataToUpdate.arrivalDate = Timestamp.fromDate(updates.arrivalDate);
    }
    dataToUpdate.lastUpdated = serverTimestamp(); // Always update lastUpdated timestamp

    await updateDoc(shipmentRef, dataToUpdate);
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
          console.log(`No shipment found with ID: ${shipmentId}`);
          return null;
        }
    } catch (error) {
        console.error(`Error fetching shipment ${shipmentId}:`, error);
        throw error;
    }
};

export const getAllShipments = async (): Promise<Shipment[]> => {
  try {
    const q = query(collection(db, 'shipments'), orderBy('lastUpdated', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => shipmentFromFirestore(docSnap));
  } catch (error) {
    console.error("Error fetching all shipments:", error);
    throw error;
  }
};

// --- Shipment Detail CRUD ---

export const addShipmentDetail = async (shipmentId: string, detailData: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated' | 'netWeight'>): Promise<string> => {
  if (!shipmentId) throw new Error("Parent Shipment ID is required to add a detail.");
  const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');
  try {
    const netWeight = parseFloat(((detailData.grossWeight ?? 0) - (detailData.tareWeight ?? 0)).toFixed(3));
    const docRef = await addDoc(detailsCollectionRef, {
      ...detailData,
      netWeight: netWeight,
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

export const updateShipmentDetail = async (shipmentId: string, detailId: string, updates: Partial<Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'netWeight'>>): Promise<void> => {
  if (!shipmentId || !detailId) throw new Error("Shipment ID and Detail ID are required to update a detail.");
  const detailRef = doc(db, 'shipments', shipmentId, 'details', detailId);
  try {
    const dataToUpdate: DocumentData = { ...updates };
    if (updates.grossWeight !== undefined || updates.tareWeight !== undefined) {
      const currentDocSnap = await getDoc(detailRef);
      const currentData = currentDocSnap.data() || {};
      const grossWeight = updates.grossWeight !== undefined ? updates.grossWeight : currentData.grossWeight;
      const tareWeight = updates.tareWeight !== undefined ? updates.tareWeight : currentData.tareWeight;
      dataToUpdate.netWeight = parseFloat(((grossWeight ?? 0) - (tareWeight ?? 0)).toFixed(3));
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

export const deleteShipmentDetailsBatch = async (shipmentId: string, detailIds: string[]): Promise<void> => {
  if (!shipmentId) throw new Error("Parent Shipment ID is required for batch delete.");
  if (!detailIds || detailIds.length === 0) {
    console.log("No detail IDs provided for batch delete.");
    return;
  }
  const batch = writeBatch(db);
  detailIds.forEach(id => {
    const detailRef = doc(db, 'shipments', shipmentId, 'details', id);
    batch.delete(detailRef);
  });
  try {
    await batch.commit();
    await recalculateShipmentTotals(shipmentId);
  } catch (error)
{
    console.error(`Error batch deleting details for shipment ${shipmentId}:`, error);
    throw error;
  }
};

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
        throw error;
    }
};

// --- Calculation Logic ---

export const recalculateShipmentTotals = async (shipmentId: string): Promise<void> => {
  if (!shipmentId) {
    console.warn("[ShipmentService DEBUG] recalculateShipmentTotals called with invalid shipmentId:", shipmentId);
    return;
  }
  console.log(`[ShipmentService DEBUG] Recalculating totals for shipment: ${shipmentId}. Using PRIMARY_ASENDIA_CUSTOMER_ID_FOR_DASHBOARD_BREAKDOWN: "${PRIMARY_ASENDIA_CUSTOMER_ID_FOR_DASHBOARD_BREAKDOWN}"`);

  const shipmentRef = doc(db, 'shipments', shipmentId);
  const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');

  try {
    await runTransaction(db, async (transaction) => {
      const detailsQuerySnapshot = await getDocs(query(detailsCollectionRef));
      const details: ShipmentDetail[] = detailsQuerySnapshot.docs.map(d => detailFromFirestore(d as QueryDocumentSnapshot<DocumentData>));
      console.log(`[ShipmentService DEBUG] Shipment ${shipmentId}: Found ${details.length} detail items for recalculation.`);

      let totalPallets = 0;
      let totalBags = 0;
      let totalGrossWeight = 0;
      let totalTareWeight = 0;
      let totalNetWeight = 0;
      let primaryAsendiaGrossWeight = 0;
      let primaryAsendiaTareWeight = 0;
      let primaryAsendiaNetWeight = 0;

      details.forEach((detail, index) => {
        const itemNetWeight = detail.netWeight !== undefined ? detail.netWeight : 0;
        const itemGrossWeight = detail.grossWeight !== undefined ? detail.grossWeight : 0;
        const itemTareWeight = detail.tareWeight !== undefined ? detail.tareWeight : 0;

        console.log(`[ShipmentService DEBUG] Detail item ${index + 1} (ID: ${detail.id}): Customer ID: "${detail.customerId}", Gross: ${itemGrossWeight.toFixed(3)}, Tare: ${itemTareWeight.toFixed(3)}, Net: ${itemNetWeight.toFixed(3)}`);
        
        totalPallets += detail.numPallets || 0;
        totalBags += detail.numBags || 0;
        totalGrossWeight += itemGrossWeight;
        totalTareWeight += itemTareWeight;
        totalNetWeight += itemNetWeight;

        if (detail.customerId === PRIMARY_ASENDIA_CUSTOMER_ID_FOR_DASHBOARD_BREAKDOWN) {
          console.log(`[ShipmentService DEBUG]   ^-- Item MATCHED PRIMARY_ASENDIA_CUSTOMER_ID. Adding its Net Wt: ${itemNetWeight.toFixed(3)} to primaryAsendiaNetWeight.`);
          primaryAsendiaGrossWeight += itemGrossWeight;
          primaryAsendiaTareWeight += itemTareWeight;
          primaryAsendiaNetWeight += itemNetWeight;
        } else {
          console.log(`[ShipmentService DEBUG]   ^-- Item DID NOT MATCH PRIMARY_ASENDIA_CUSTOMER_ID. (Detail CustID: "${detail.customerId}", Primary Const: "${PRIMARY_ASENDIA_CUSTOMER_ID_FOR_DASHBOARD_BREAKDOWN}")`);
        }
      });

      console.log(`[ShipmentService DEBUG] Calculated FINAL Totals - totalNetWeight: ${totalNetWeight.toFixed(3)}, primaryAsendiaNetWeight: ${primaryAsendiaNetWeight.toFixed(3)}`);

      const updates = {
        totalPallets: totalPallets,
        totalBags: totalBags,
        totalGrossWeight: parseFloat(totalGrossWeight.toFixed(3)),
        totalTareWeight: parseFloat(totalTareWeight.toFixed(3)),
        totalNetWeight: parseFloat(totalNetWeight.toFixed(3)),
        asendiaGrossWeight: parseFloat(primaryAsendiaGrossWeight.toFixed(3)),
        asendiaTareWeight: parseFloat(primaryAsendiaTareWeight.toFixed(3)),
        asendiaNetWeight: parseFloat(primaryAsendiaNetWeight.toFixed(3)),
        lastUpdated: serverTimestamp(),
      };
      console.log(`[ShipmentService DEBUG] Updating shipment ${shipmentId} in Firestore with:`, updates);
      transaction.update(shipmentRef, updates);
    });
    console.log(`[ShipmentService DEBUG] Successfully recalculated and updated totals for shipment ${shipmentId}.`);
  } catch (error) {
    console.error(`[ShipmentService DEBUG] Error recalculating totals for shipment ${shipmentId}:`, error);
    throw error;
  }
};


// --- Dashboard Specific Queries ---

export const getDashboardStats = async (): Promise<{
    pendingCount: number | null;
    completedCount: number | null;
    totalGrossWeightSum: number | null; 
    lastUpdateTimestamp: Timestamp | null;
}> => {
    const shipmentsCollection = collection(db, 'shipments');
    try {
        const pendingQuery = query(shipmentsCollection, where('status', '==', 'Pending'));
        const completedQuery = query(shipmentsCollection, where('status', '==', 'Completed'));

        const [pendingSnapshot, completedSnapshot] = await Promise.all([
            getCountFromServer(pendingQuery),
            getCountFromServer(completedQuery)
        ]);

        const lastUpdatedQuery = query(shipmentsCollection, orderBy('lastUpdated', 'desc'), limit(1));
        const lastUpdatedSnapshot = await getDocs(lastUpdatedQuery);
        const lastUpdateTimestamp = lastUpdatedSnapshot.empty ? null : (lastUpdatedSnapshot.docs[0].data().lastUpdated as Timestamp);
        
        // TotalGrossWeightSum is marked as null, as client-side calculation is inefficient.
        // This requires backend aggregation (e.g., Cloud Function) for production.
        const totalGrossWeightSum = null; 

        return {
            pendingCount: pendingSnapshot.data().count,
            completedCount: completedSnapshot.data().count,
            totalGrossWeightSum: totalGrossWeightSum,
            lastUpdateTimestamp: lastUpdateTimestamp,
        };
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        return {
            pendingCount: null,
            completedCount: null,
            totalGrossWeightSum: null,
            lastUpdateTimestamp: null,
        };
    }
};
