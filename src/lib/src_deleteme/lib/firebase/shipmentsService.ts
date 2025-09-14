 
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
 getCountFromServer
} from 'firebase/firestore';
import type { Shipment, ShipmentDetail, ShipmentStatus, DropdownItem } from '@/lib/types';
import { 
    PRIMARY_ASENDIA_CUSTOMER_ID_FOR_DASHBOARD_BREAKDOWN,
    ASENDIA_UK_CUSTOMER_ID,
    TRANSIT_LIGHT_CUSTOMER_ID,
    ASENDIA_UK_BAGS_CUSTOMER_ID,
} from '@/lib/constants';

// --- Helper Functions ---

export const shipmentFromFirestore = (docSnap: DocumentSnapshot<DocumentData>): Shipment => {
  const data = docSnap.data();
  if (!data) {
    console.error(`[ShipmentService] Document data missing for snapshot ID: ${docSnap.id}`);
    return { 
        id: docSnap.id, 
        carrierId: '', 
        driverName: '', 
        departureDate: Timestamp.now(), 
        arrivalDate: Timestamp.now(), 
        status: 'Pending', 
        senderAddress: '', 
        consigneeAddress: '', 
        lastUpdated: Timestamp.now(), 
        createdAt: Timestamp.now(),
        totalNetWeight: 0,
        asendiaACNetWeight: 0,
        asendiaUKNetWeight: 0,
        transitLightNetWeight: 0,
        remainingCustomersNetWeight: 0,
    } as Shipment;
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
    descriptionOfGoods: data && data.descriptionOfGoods !== undefined && data.descriptionOfGoods !== null ? data.descriptionOfGoods : '',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
    totalPallets: typeof data.totalPallets === 'number' ? data.totalPallets : 0,
    totalBags: typeof data.totalBags === 'number' ? data.totalBags : 0,
    totalGrossWeight: typeof data.totalGrossWeight === 'number' ? data.totalGrossWeight : 0,
    totalTareWeight: typeof data.totalTareWeight === 'number' ? data.totalTareWeight : 0,
    totalNetWeight: typeof data.totalNetWeight === 'number' ? data.totalNetWeight : 0,
    
    asendiaACNetWeight: typeof data.asendiaACNetWeight === 'number' ? data.asendiaACNetWeight : 0,
    asendiaUKNetWeight: typeof data.asendiaUKNetWeight === 'number' ? data.asendiaUKNetWeight : 0,
    transitLightNetWeight: typeof data.transitLightNetWeight === 'number' ? data.transitLightNetWeight : 0,
    remainingCustomersNetWeight: typeof data.remainingCustomersNetWeight === 'number' ? data.remainingCustomersNetWeight : 0,

 lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated : Timestamp.now(),
    pdfUrls: data.pdfUrls || undefined,
    scannedDocuments: Array.isArray(data.scannedDocuments) ? data.scannedDocuments : undefined,
  } as Shipment;
};

export const detailFromFirestore = (docSnap: DocumentSnapshot<DocumentData>): ShipmentDetail => {
    const data = docSnap.data();
    if (!data) {
        console.error(`[ShipmentService] Document data missing for detail snapshot ID: ${docSnap.id}`);
        return { 
            id: docSnap.id, 
            shipmentId: docSnap.ref.parent.parent?.id || '', 
            numPallets: 0, 
            numBags: 0, 
            customerId: '', 
            serviceId: '', 
            formatId: '', 
            tareWeight: 0, 
            grossWeight: 0, 
            netWeight: 0, 
            createdAt: Timestamp.now(), 
            lastUpdated: Timestamp.now() 
        } as ShipmentDetail;
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

export const addShipment = async (shipmentData: Partial<Omit<Shipment, 'id' | 'createdAt' | 'lastUpdated' | 'totalPallets' | 'totalBags' | 'totalGrossWeight' | 'totalTareWeight' | 'totalNetWeight' | 'asendiaACNetWeight' | 'asendiaUKNetWeight' | 'transitLightNetWeight' | 'remainingCustomersNetWeight' >>): Promise<string> => {
  try {
    const baseDataToSave: DocumentData = {
      driverName: shipmentData.driverName || '',
 departureDate: shipmentData.departureDate, // Assume already Timestamp or Date handled before
 arrivalDate: shipmentData.arrivalDate, // Assume already Timestamp or undefined handled before
      sealNumber: shipmentData.sealNumber || undefined,
      truckRegistration: shipmentData.truckRegistration || undefined,
      trailerRegistration: shipmentData.trailerRegistration || undefined,
      senderAddress: shipmentData.senderAddress || '',
      consigneeAddress: shipmentData.consigneeAddress || '',
      descriptionOfGoods: shipmentData.descriptionOfGoods || '', // Explicitly include
      totalPallets: 0,
      totalBags: 0,
      totalGrossWeight: 0,
      totalTareWeight: 0,
      totalNetWeight: 0,
      asendiaACNetWeight: 0,
      asendiaUKNetWeight: 0,
      remainingCustomersNetWeight: 0,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
      status: shipmentData.status || 'Pending',
    };

    const dataToSave = { ...baseDataToSave };
    if (shipmentData.subcarrierId) {
 dataToSave.subcarrierId = shipmentData.subcarrierId;
    }
 if (shipmentData.carrierId) {
 dataToSave.carrierId = shipmentData.carrierId;
    }
    console.log('[ShipmentService] Data being sent to addDoc:', JSON.parse(JSON.stringify(dataToSave)));
    const docRef = await addDoc(collection(db, 'shipments'), dataToSave);
    return docRef.id;
  } catch (error) {
    console.error("[ShipmentService] Error adding shipment:", error); // Log the full error object
    console.log('[ShipmentService] Failed data:', JSON.parse(JSON.stringify((error as any).customData?.content || shipmentData))); // Log data that caused failure if available, fallback to input data
    throw error; 
  }
};

export const updateShipment = async (shipmentId: string, updates: Partial<Omit<Shipment, 'id' | 'createdAt'>>): Promise<void> => {
  console.log(`[ShipmentService] Attempting to update shipment with ID: ${shipmentId}`);
  const shipmentRef = doc(db, 'shipments', shipmentId);
  try {
    const dataToUpdate: DocumentData = {
      carrierId: updates.carrierId,
      subcarrierId: updates.subcarrierId,
      driverName: updates.driverName,
      status: updates.status,
      sealNumber: updates.sealNumber,
      truckRegistration: updates.truckRegistration,
      trailerRegistration: updates.trailerRegistration,
      senderAddress: updates.senderAddress,
      consigneeAddress: updates.consigneeAddress,
       descriptionOfGoods: updates.descriptionOfGoods, // Explicitly include
    };
if (updates.departureDate instanceof Date) {
  // Handle JavaScript Date
  dataToUpdate.departureDate = Timestamp.fromDate(updates.departureDate);
} else if (updates.departureDate instanceof Timestamp) {
  // Handle Firestore Timestamp
  dataToUpdate.departureDate = updates.departureDate;
}

if (updates.arrivalDate instanceof Date) {
  // Handle JavaScript Date
  dataToUpdate.arrivalDate = Timestamp.fromDate(updates.arrivalDate);
} else if (updates.arrivalDate instanceof Timestamp) {
  // Handle Firestore Timestamp
  dataToUpdate.arrivalDate = updates.arrivalDate;
} else if (updates.arrivalDate === null || updates.arrivalDate === undefined) {
  // Explicitly clear the field
  dataToUpdate.arrivalDate = null;
}    dataToUpdate.lastUpdated = serverTimestamp();

 console.log('[ShipmentService] Data being sent to updateDoc:', JSON.parse(JSON.stringify(dataToUpdate)));
    await updateDoc(shipmentRef, dataToUpdate);
  } catch (error) {
    console.error(`[ShipmentService] Error updating shipment ${shipmentId}:`, error); // Log the full error object
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
    console.error(`[ShipmentService] Error deleting shipment ${shipmentId}:`, error);
    throw error;
  }
};

export const getShipmentById = async (shipmentId: string): Promise<Shipment | null> => {
    if (!shipmentId) {
        console.warn("[ShipmentService] getShipmentById called with no ID.");
        return null;
    }
    const shipmentRef = doc(db, 'shipments', shipmentId);
    try {
        const docSnap = await getDoc(shipmentRef);
        if (docSnap.exists()) {
          return shipmentFromFirestore(docSnap);
        } else {
          console.log(`[ShipmentService] No shipment found with ID: ${shipmentId}`);
          return null;
        }
    } catch (error) {
        console.error(`[ShipmentService] Error fetching shipment ${shipmentId}:`, error);
        throw error;
    }
};

export const getAllShipments = async (): Promise<Shipment[]> => {
  try {
    const q = query(collection(db, 'shipments'), orderBy('lastUpdated', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => shipmentFromFirestore(docSnap));
  } catch (error) {
    console.error("[ShipmentService] Error fetching all shipments:", error);
    throw error;
  }
};

// --- Shipment Detail CRUD ---

export const addShipmentDetail = async (shipmentId: string, detailData: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated' | 'netWeight'>): Promise<string> => {
  if (!shipmentId) throw new Error("[ShipmentService] Parent Shipment ID is required to add a detail.");
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
    console.error(`[ShipmentService] Error adding detail to shipment ${shipmentId}:`, error);
    throw error;
  }
};

export const updateShipmentDetail = async (shipmentId: string, detailId: string, updates: Partial<Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'netWeight'>>): Promise<void> => {
  if (!shipmentId || !detailId) throw new Error("[ShipmentService] Shipment ID and Detail ID are required to update a detail.");
  const detailRef = doc(db, 'shipments', shipmentId, 'details', detailId);
  try {
    const dataToUpdate: DocumentData = { 
      ...updates,
 descriptionOfGoods: updates.descriptionOfGoods || undefined, // Include descriptionOfGoods
    };
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
    console.error(`[ShipmentService] Error updating detail ${detailId} for shipment ${shipmentId}:`, error);
    throw error;
  }
};

export const deleteShipmentDetail = async (shipmentId: string, detailId: string): Promise<void> => {
  if (!shipmentId || !detailId) throw new Error("[ShipmentService] Shipment ID and Detail ID are required to delete a detail.");
  const detailRef = doc(db, 'shipments', shipmentId, 'details', detailId);
  try {
    await deleteDoc(detailRef);
    await recalculateShipmentTotals(shipmentId);
  } catch (error) {
    console.error(`[ShipmentService] Error deleting detail ${detailId} for shipment ${shipmentId}:`, error);
    throw error;
  }
};

export const deleteShipmentDetailsBatch = async (shipmentId: string, detailIds: string[]): Promise<void> => {
  if (!shipmentId) throw new Error("[ShipmentService] Parent Shipment ID is required for batch delete.");
  if (!detailIds || detailIds.length === 0) {
    console.log("[ShipmentService] No detail IDs provided for batch delete.");
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
  } catch (error) {
    console.error(`[ShipmentService] Error batch deleting details for shipment ${shipmentId}:`, error);
    throw error;
  }
};

export const getShipmentDetailsCount = async (shipmentId: string): Promise<number> => {
    if (!shipmentId) {
        console.warn("[ShipmentService] getShipmentDetailsCount called with no shipmentId.");
        return 0;
    }
    const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');
    try {
        const snapshot = await getCountFromServer(query(detailsCollectionRef));
        return snapshot.data().count;
    } catch (error) {
        console.error(`[ShipmentService] Error getting details count for shipment ${shipmentId}:`, error);
        throw error;
    }
};

// --- Calculation Logic ---

export const recalculateShipmentTotals = async (shipmentId: string): Promise<void> => {
  if (!shipmentId) {
    console.warn("[ShipmentService DEBUG] recalculateShipmentTotals called with invalid shipmentId:", shipmentId);
    return;
  }
  console.log(`[ShipmentService DEBUG] Recalculating totals for shipment: ${shipmentId}. Using:
    PRIMARY_ASENDIA_CUSTOMER_ID: "${PRIMARY_ASENDIA_CUSTOMER_ID_FOR_DASHBOARD_BREAKDOWN}"
    ASENDIA_UK_CUSTOMER_ID: "${ASENDIA_UK_CUSTOMER_ID}"
    TRANSIT_LIGHT_CUSTOMER_ID: "${TRANSIT_LIGHT_CUSTOMER_ID}"`);

  const shipmentRef = doc(db, 'shipments', shipmentId);
  const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');

  try {
    await runTransaction(db, async (transaction) => {
      const detailsQuerySnapshot = await getDocs(query(detailsCollectionRef));
      const details: ShipmentDetail[] = detailsQuerySnapshot.docs.map(d => detailFromFirestore(d as QueryDocumentSnapshot<DocumentData>));
      console.log(`[ShipmentService DEBUG] Shipment ${shipmentId}: Found ${details.length} detail items for recalculation.`);

      let totalPallets = 0;
      let totalBags = 0;
      let overallTotalGrossWeight = 0;
      let overallTotalTareWeight = 0;
      let overallTotalNetWeight = 0;
      let specificAsendiaACNetWeight = 0;
      let remainingCustomersAggregateNetWeight = 0;
      
      details.forEach((detail, index) => {
        const itemNetWeight = detail.netWeight !== undefined ? detail.netWeight : 0;
        const itemGrossWeight = detail.grossWeight !== undefined ? detail.grossWeight : 0;
        const itemTareWeight = detail.tareWeight !== undefined ? detail.tareWeight : 0;

        console.log(`[ShipmentService DEBUG] Detail item ${index + 1} (ID: ${detail.id}): Customer ID: "${detail.customerId}", Net Wt: ${itemNetWeight.toFixed(3)}`);
        
        totalPallets += detail.numPallets || 0;
        totalBags += detail.numBags || 0;
        overallTotalGrossWeight += (detail.grossWeight || 0);
 overallTotalTareWeight += (detail.tareWeight || 0);
        overallTotalNetWeight += itemNetWeight;

        // Aggregate net weight based on customer ID
        if (detail.customerId === PRIMARY_ASENDIA_CUSTOMER_ID_FOR_DASHBOARD_BREAKDOWN) {
 console.log(`[ShipmentService DEBUG]   ^-- Item MATCHED PRIMARY_ASENDIA_CUSTOMER_ID ("${PRIMARY_ASENDIA_CUSTOMER_ID_FOR_DASHBOARD_BREAKDOWN}"). Adding its Net Wt: ${itemNetWeight.toFixed(3)} to Asendia A/C totals.`);
          specificAsendiaACNetWeight += itemNetWeight;
        } else {
          // All other customer IDs (including ASENDIA_UK, Transit Light, ASENDIA UK/BAGS, and any others) go into remainingCustomersAggregateNetWeight
          console.log(`[ShipmentService DEBUG]   ^-- Item DID NOT MATCH PRIMARY_ASENDIA_CUSTOMER_ID ("${PRIMARY_ASENDIA_CUSTOMER_ID_FOR_DASHBOARD_BREAKDOWN}"). Adding its Net Wt: ${itemNetWeight.toFixed(3)} to remaining customers totals.`);
          remainingCustomersAggregateNetWeight += itemNetWeight;
 }
      });

      console.log(`[ShipmentService DEBUG] Calculated FINAL Overall Totals - Total Net: ${overallTotalNetWeight.toFixed(3)}, Total Gross: ${overallTotalGrossWeight.toFixed(3)}, Total Tare: ${overallTotalTareWeight.toFixed(3)}`);

      const updates = {
        totalPallets: totalPallets,
        totalBags: totalBags,
        totalGrossWeight: parseFloat(overallTotalGrossWeight.toFixed(3)),
        totalTareWeight: parseFloat(overallTotalTareWeight.toFixed(3)),
        totalNetWeight: parseFloat(overallTotalNetWeight.toFixed(3)),
        
        asendiaACNetWeight: parseFloat(specificAsendiaACNetWeight.toFixed(3)),
        // All other customer net weights are aggregated into remainingCustomersNetWeight
        remainingCustomersNetWeight: parseFloat(remainingCustomersAggregateNetWeight.toFixed(3)),
        
        lastUpdated: serverTimestamp(),
      };
      console.log(`[ShipmentService DEBUG] Updating shipment ${shipmentId} in Firestore with:`, JSON.stringify(updates, null, 2));
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
    lastUpdateTimestamp: Timestamp | null;
    // totalGrossWeightSum: number | null; // Removed for performance
}> => {
    const shipmentsCollection = collection(db, 'shipments');
    // let totalGrossWeightSum: number | null = 0; // Removed for performance

    try {
        const pendingQuery = query(shipmentsCollection, where('status', '==', 'Pending'));
        const completedQuery = query(shipmentsCollection, where('status', '==', 'Completed'));

        const [pendingSnapshot, completedSnapshot/*, allShipmentsSnapshot*/] = await Promise.all([
            getCountFromServer(pendingQuery),
            getCountFromServer(completedQuery),
            // getDocs(query(shipmentsCollection)) // Removed for performance
        ]);
        
        // Removed gross weight sum calculation for performance
        // allShipmentsSnapshot.forEach(doc => {
        //     totalGrossWeightSum += doc.data().totalGrossWeight || 0;
        // });
        // if (allShipmentsSnapshot.empty) totalGrossWeightSum = null;

        const lastUpdatedQuery = query(shipmentsCollection, orderBy('lastUpdated', 'desc'), limit(1));
        const lastUpdatedSnapshot = await getDocs(lastUpdatedQuery);
        const lastUpdateTimestamp = lastUpdatedSnapshot.empty ? null : (lastUpdatedSnapshot.docs[0].data().lastUpdated as Timestamp);
        
        return {
            pendingCount: pendingSnapshot.data().count,
            completedCount: completedSnapshot.data().count,
            lastUpdateTimestamp: lastUpdateTimestamp,
            // totalGrossWeightSum: totalGrossWeightSum, // Removed
        };
    } catch (error) {
        console.error("[ShipmentService] Error fetching dashboard stats:", error);
        return {
            pendingCount: null,
            completedCount: null,
            lastUpdateTimestamp: null,
            // totalGrossWeightSum: null, // Removed
        };
    }
};


