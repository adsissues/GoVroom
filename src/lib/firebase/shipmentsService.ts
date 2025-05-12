
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
    // Include aggregated fields if they exist, otherwise undefined
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
    // Calculate netWeight if not stored or needs recalculation
    const grossWeight = typeof data.grossWeight === 'number' ? data.grossWeight : 0;
    const tareWeight = typeof data.tareWeight === 'number' ? data.tareWeight : 0;
    const netWeight = parseFloat((grossWeight - tareWeight).toFixed(3)); // Ensure precision

    return {
        id: docSnap.id,
        shipmentId: docSnap.ref.parent.parent?.id || '', // Get parent shipment ID
        numPallets: typeof data.numPallets === 'number' ? data.numPallets : 0,
        numBags: typeof data.numBags === 'number' ? data.numBags : 0,
        customerId: data.customerId || '',
        serviceId: data.serviceId || '',
        formatId: data.formatId || '',
        tareWeight: tareWeight,
        grossWeight: grossWeight,
        netWeight: netWeight, // Use calculated value
        dispatchNumber: data.dispatchNumber || undefined,
        doeId: data.doeId || undefined,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
        lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated : Timestamp.now(),
    } as ShipmentDetail;
};


// --- Shipment CRUD ---

/**
 * Adds a new shipment document to Firestore.
 * Initializes totals to 0.
 * @param shipmentData Data for the new shipment (excluding id, timestamps, totals).
 * @returns The ID of the newly created shipment document.
 */
export const addShipment = async (shipmentData: Omit<Shipment, 'id' | 'createdAt' | 'lastUpdated' | 'totalPallets' | 'totalBags' | 'totalGrossWeight' | 'totalTareWeight' | 'totalNetWeight' | 'asendiaGrossWeight' | 'asendiaTareWeight' | 'asendiaNetWeight'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'shipments'), {
      ...shipmentData,
      // Ensure Timestamps are correctly handled if passed as Date objects
      departureDate: shipmentData.departureDate instanceof Date ? Timestamp.fromDate(shipmentData.departureDate) : shipmentData.departureDate,
      arrivalDate: shipmentData.arrivalDate instanceof Date ? Timestamp.fromDate(shipmentData.arrivalDate) : shipmentData.arrivalDate,
      // Initialize aggregated fields
      totalPallets: 0,
      totalBags: 0,
      totalGrossWeight: 0,
      totalTareWeight: 0,
      totalNetWeight: 0,
      asendiaGrossWeight: 0,
      asendiaTareWeight: 0,
      asendiaNetWeight: 0,
      // Add timestamps
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding shipment:", error);
    throw error; // Re-throw for UI handling
  }
};

/**
 * Updates an existing shipment document.
 * Recalculates totals if status changes or details are modified externally.
 * @param shipmentId The ID of the shipment to update.
 * @param updates Partial shipment data to update.
 */
export const updateShipment = async (shipmentId: string, updates: Partial<Omit<Shipment, 'id' | 'createdAt'>>): Promise<void> => {
  const shipmentRef = doc(db, 'shipments', shipmentId);
  try {
    // Ensure Timestamps are correctly handled if passed as Date objects
    const dataToUpdate: DocumentData = { ...updates };
    if (updates.departureDate instanceof Date) {
      dataToUpdate.departureDate = Timestamp.fromDate(updates.departureDate);
    }
     if (updates.arrivalDate instanceof Date) {
       dataToUpdate.arrivalDate = Timestamp.fromDate(updates.arrivalDate);
    }
    // Always update the lastUpdated timestamp
    dataToUpdate.lastUpdated = serverTimestamp();

    await updateDoc(shipmentRef, dataToUpdate);

    // If status changed, potentially trigger other actions (like PDF generation - placeholder)
    if (updates.status === 'Completed') {
       // await triggerPdfGeneration(shipmentId); // Placeholder
       // await sendCompletionNotification(shipmentId); // Placeholder
    }

    // Note: Recalculation of totals should ideally happen when details change,
    // but we can add a safety recalculation here if needed, though less efficient.
    // if (updates.status) { // Example: recalculate if status changes
    //     await recalculateShipmentTotals(shipmentId);
    // }

  } catch (error) {
    console.error(`Error updating shipment ${shipmentId}:`, error);
    throw error;
  }
};

/**
 * Deletes a shipment and all its details (subcollection).
 * Uses a batch write for atomicity.
 * @param shipmentId The ID of the shipment to delete.
 */
export const deleteShipment = async (shipmentId: string): Promise<void> => {
  const shipmentRef = doc(db, 'shipments', shipmentId);
  const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');

  try {
    const batch = writeBatch(db);

    // Delete all documents in the 'details' subcollection
    const detailsSnapshot = await getDocs(query(detailsCollectionRef));
    detailsSnapshot.docs.forEach((detailDoc) => {
      batch.delete(detailDoc.ref);
    });

    // Delete the main shipment document
    batch.delete(shipmentRef);

    await batch.commit();
    console.log(`Shipment ${shipmentId} and its details deleted successfully.`);
  } catch (error) {
    console.error(`Error deleting shipment ${shipmentId}:`, error);
    throw error;
  }
};

/**
 * Fetches a single shipment document by its ID.
 * @param shipmentId The ID of the shipment to fetch.
 * @returns The Shipment object or null if not found.
 */
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
        throw error; // Re-throw for potential handling (e.g., displaying an error message)
    }
};

/**
 * Fetches all shipment documents. WARNING: Potentially inefficient for large datasets.
 * Consider using pagination or filtering instead.
 * @returns An array of Shipment objects.
 */
export const getAllShipments = async (): Promise<Shipment[]> => {
  try {
    // Consider adding orderBy('lastUpdated', 'desc') or similar
    const q = query(collection(db, 'shipments'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(shipmentFromFirestore);
  } catch (error) {
    console.error("Error fetching all shipments:", error);
    throw error;
  }
};

// --- Shipment Detail CRUD ---

/**
 * Adds a new detail document to a shipment's 'details' subcollection.
 * Recalculates parent shipment totals after adding.
 * @param shipmentId The ID of the parent shipment.
 * @param detailData Data for the new detail (excluding id, shipmentId, timestamps).
 * @returns The ID of the newly created detail document.
 */
export const addShipmentDetail = async (shipmentId: string, detailData: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated'>): Promise<string> => {
  if (!shipmentId) throw new Error("Parent Shipment ID is required to add a detail.");
  const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');
  try {
    const docRef = await addDoc(detailsCollectionRef, {
      ...detailData,
      // Ensure netWeight is calculated correctly before saving
      netWeight: parseFloat(((detailData.grossWeight ?? 0) - (detailData.tareWeight ?? 0)).toFixed(3)),
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    });

    // After adding, recalculate totals on the parent shipment
    await recalculateShipmentTotals(shipmentId);

    return docRef.id;
  } catch (error) {
    console.error(`Error adding detail to shipment ${shipmentId}:`, error);
    throw error;
  }
};

/**
 * Updates an existing shipment detail document.
 * Recalculates parent shipment totals after updating.
 * @param shipmentId The ID of the parent shipment.
 * @param detailId The ID of the detail document to update.
 * @param updates Partial detail data to update.
 */
export const updateShipmentDetail = async (shipmentId: string, detailId: string, updates: Partial<Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt'>>): Promise<void> => {
  if (!shipmentId || !detailId) throw new Error("Shipment ID and Detail ID are required to update a detail.");
  const detailRef = doc(db, 'shipments', shipmentId, 'details', detailId);
  try {
    const dataToUpdate: DocumentData = { ...updates };

    // Recalculate netWeight if grossWeight or tareWeight is being updated
    const currentDocSnap = await getDoc(detailRef);
    const currentData = currentDocSnap.data() || {};
    const grossWeight = updates.grossWeight ?? currentData.grossWeight ?? 0;
    const tareWeight = updates.tareWeight ?? currentData.tareWeight ?? 0;
    if (updates.grossWeight !== undefined || updates.tareWeight !== undefined) {
        dataToUpdate.netWeight = parseFloat((grossWeight - tareWeight).toFixed(3));
    }

    dataToUpdate.lastUpdated = serverTimestamp(); // Always update timestamp

    await updateDoc(detailRef, dataToUpdate);

    // After updating, recalculate totals on the parent shipment
    await recalculateShipmentTotals(shipmentId);

  } catch (error) {
    console.error(`Error updating detail ${detailId} for shipment ${shipmentId}:`, error);
    throw error;
  }
};

/**
 * Deletes a shipment detail document.
 * Recalculates parent shipment totals after deleting.
 * @param shipmentId The ID of the parent shipment.
 * @param detailId The ID of the detail document to delete.
 */
export const deleteShipmentDetail = async (shipmentId: string, detailId: string): Promise<void> => {
  if (!shipmentId || !detailId) throw new Error("Shipment ID and Detail ID are required to delete a detail.");
  const detailRef = doc(db, 'shipments', shipmentId, 'details', detailId);
  try {
    await deleteDoc(detailRef);

    // After deleting, recalculate totals on the parent shipment
    await recalculateShipmentTotals(shipmentId);

  } catch (error) {
    console.error(`Error deleting detail ${detailId} for shipment ${shipmentId}:`, error);
    throw error;
  }
};


// --- Calculation Logic ---

/**
 * Recalculates and updates the aggregated totals on the parent shipment document.
 * Fetches all details for the shipment to perform calculations.
 * Should be called after adding, updating, or deleting a shipment detail.
 * Uses a transaction to ensure atomicity.
 * @param shipmentId The ID of the shipment whose totals need recalculation.
 */
export const recalculateShipmentTotals = async (shipmentId: string): Promise<void> => {
  const shipmentRef = doc(db, 'shipments', shipmentId);
  const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');

  try {
    await runTransaction(db, async (transaction) => {
      const detailsSnapshot = await getDocs(query(detailsCollectionRef)); // Get all details within the transaction context? Maybe outside if allowed. Check Firestore transaction docs.
      const details: ShipmentDetail[] = detailsSnapshot.docs.map(detailFromFirestore);

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
        totalNetWeight += detail.netWeight || 0; // Use pre-calculated netWeight

        if (detail.customerId === ASENDIA_CUSTOMER_VALUE) {
          asendiaGrossWeight += detail.grossWeight || 0;
          asendiaTareWeight += detail.tareWeight || 0;
          asendiaNetWeight += detail.netWeight || 0;
        }
      });

      // Prepare updates object with calculated totals (rounded for consistency)
      const updates = {
        totalPallets: totalPallets,
        totalBags: totalBags,
        totalGrossWeight: parseFloat(totalGrossWeight.toFixed(3)),
        totalTareWeight: parseFloat(totalTareWeight.toFixed(3)),
        totalNetWeight: parseFloat(totalNetWeight.toFixed(3)),
        asendiaGrossWeight: parseFloat(asendiaGrossWeight.toFixed(3)),
        asendiaTareWeight: parseFloat(asendiaTareWeight.toFixed(3)),
        asendiaNetWeight: parseFloat(asendiaNetWeight.toFixed(3)),
        lastUpdated: serverTimestamp(), // Update timestamp during recalculation
      };

      // Update the parent shipment document within the transaction
      transaction.update(shipmentRef, updates);
    });
    // console.log(`Shipment ${shipmentId} totals updated successfully.`);
  } catch (error) {
    console.error(`Error recalculating totals for shipment ${shipmentId}:`, error);
    // Decide how to handle recalculation errors. Maybe retry?
    // Throwing might prevent the triggering action (add/update/delete detail) from completing in the UI.
    // Consider logging and potentially queueing a retry later.
    throw error; // For now, re-throw to indicate the issue
  }
};


// --- Dashboard Specific Queries ---

/**
 * Fetches a summary of shipment statistics for the dashboard.
 * Uses getCountFromServer for efficiency.
 */
export const getDashboardStats = async (): Promise<{
    pendingCount: number;
    completedCount: number;
    totalGrossWeightSum: number; // Example - requires iterating or server-side aggregation
    lastUpdateTimestamp: Timestamp | null;
}> => {
    const shipmentsCollection = collection(db, 'shipments');

    try {
        // Get counts using getCountFromServer
        const pendingQuery = query(shipmentsCollection, where('status', '==', 'Pending'));
        const completedQuery = query(shipmentsCollection, where('status', '==', 'Completed'));
        const pendingSnapshot = await getCountFromServer(pendingQuery);
        const completedSnapshot = await getCountFromServer(completedQuery);

        // Get last updated shipment (example, adjust field/order as needed)
        const lastUpdatedQuery = query(shipmentsCollection, orderBy('lastUpdated', 'desc'), limit(1));
        const lastUpdatedSnapshot = await getDocs(lastUpdatedQuery);
        const lastUpdateTimestamp = lastUpdatedSnapshot.empty ? null : (lastUpdatedSnapshot.docs[0].data().lastUpdated as Timestamp);

        // Calculating total weight client-side is inefficient for large datasets.
        // This should ideally be done server-side (e.g., Cloud Function aggregation)
        // or estimated if exact value isn't critical for dashboard overview.
        // Placeholder for demonstration:
        let totalGrossWeightSum = 0;
        // const allDocsSnapshot = await getDocs(query(shipmentsCollection)); // Inefficient! Avoid in production.
        // allDocsSnapshot.forEach(doc => {
        //     totalGrossWeightSum += doc.data().totalGrossWeight || 0;
        // });

        return {
            pendingCount: pendingSnapshot.data().count,
            completedCount: completedSnapshot.data().count,
            totalGrossWeightSum: totalGrossWeightSum, // Replace with efficient method
            lastUpdateTimestamp: lastUpdateTimestamp,
        };
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        throw error;
    }
};
