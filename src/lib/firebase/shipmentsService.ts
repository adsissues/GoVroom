
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
import { getDropdownOptionsMap } from './dropdownService'; // Import the map helper
import { ASENDIA_CUSTOMER_VALUE } from '@/lib/constants'; // Import constant

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
      totalPallets: data.totalPallets ?? 0,
      totalBags: data.totalBags ?? 0,
      totalGrossWeight: data.totalGrossWeight ?? 0,
      totalTareWeight: data.totalTareWeight ?? 0,
      totalNetWeight: data.totalNetWeight ?? 0,
      asendiaGrossWeight: data.asendiaGrossWeight ?? 0,
      asendiaTareWeight: data.asendiaTareWeight ?? 0,
      asendiaNetWeight: data.asendiaNetWeight ?? 0,
    } as Shipment;
};

// Helper to convert Firestore doc to ShipmentDetail type
export const detailFromFirestore = (doc: QueryDocumentSnapshot<DocumentData>): ShipmentDetail => {
    const data = doc.data();
    return {
        id: doc.id,
        shipmentId: data.shipmentId, // Should match parent doc ID ideally, but might be stored for context
        numPallets: data.numPallets ?? 0,
        numBags: data.numBags ?? 0,
        customerId: data.customerId,
        serviceId: data.serviceId,
        formatId: data.formatId,
        tareWeight: data.tareWeight ?? 0,
        grossWeight: data.grossWeight ?? 0,
        dispatchNumber: data.dispatchNumber,
        doeId: data.doeId,
        createdAt: data.createdAt,
        lastUpdated: data.lastUpdated,
        netWeight: data.netWeight ?? 0, // Gross - Tare calculation is done separately
    } as ShipmentDetail;
};


// Add a new shipment
export const addShipment = async (shipmentData: Omit<Shipment, 'id' | 'lastUpdated' | 'createdAt' | 'totalPallets' | 'totalBags' | 'totalGrossWeight' | 'totalTareWeight' | 'totalNetWeight' | 'asendiaGrossWeight' | 'asendiaTareWeight' | 'asendiaNetWeight'>): Promise<string> => {
  const docRef = await addDoc(shipmentsCollection, {
    ...shipmentData,
    // Initialize totals to 0
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

// Get dashboard summary stats (using client-side aggregation for now)
export const getDashboardStats = async () => {
    const pendingQuery = query(shipmentsCollection, where('status', '==', 'Pending'));
    const completedQuery = query(shipmentsCollection, where('status', '==', 'Completed'));
    const allShipmentsQuery = query(shipmentsCollection, orderBy('lastUpdated', 'desc')); // Get all for weight calc

    const [pendingSnapshot, completedSnapshot, allShipmentsSnapshot] = await Promise.all([
        getCountFromServer(pendingQuery),
        getCountFromServer(completedQuery),
        getDocs(allShipmentsQuery)
    ]);

    let lastUpdated: Timestamp | null = null;
    let totalWeight = 0;

    if (!allShipmentsSnapshot.empty) {
        lastUpdated = allShipmentsSnapshot.docs[0].data().lastUpdated as Timestamp;
        allShipmentsSnapshot.docs.forEach(doc => {
            totalWeight += doc.data().totalGrossWeight ?? 0; // Sum up totalGrossWeight
        });
    }

    return {
        pendingCount: pendingSnapshot.data().count,
        completedCount: completedSnapshot.data().count,
        lastUpdateTimestamp: lastUpdated,
        totalWeight: totalWeight, // Return calculated total weight
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
  // Ensure lastUpdated is included in the updates
  const dataToUpdate = {
      ...updates,
      lastUpdated: serverTimestamp(), // Always update the timestamp
  };
  await updateDoc(docRef, dataToUpdate);
};


// Delete a shipment
export const deleteShipment = async (id: string): Promise<void> => {
    const shipmentRef = doc(db, 'shipments', id);
    const detailsCollectionRef = collection(db, 'shipments', id, 'details');

    // Delete all detail documents first using batch writes
    const detailsQuery = query(detailsCollectionRef);
    const detailsSnapshot = await getDocs(detailsQuery);
    if (!detailsSnapshot.empty) {
        const batch = writeBatch(db);
        detailsSnapshot.docs.forEach(detailDoc => {
            batch.delete(detailDoc.ref);
        });
        await batch.commit();
        console.log(`Deleted ${detailsSnapshot.size} detail items for shipment ${id}.`);
    } else {
         console.log(`No detail items found for shipment ${id}.`)
    }

    // Now delete the parent shipment document
    await deleteDoc(shipmentRef);
    console.log(`Shipment ${id} deleted successfully.`)
};


// --- Shipment Detail Functions ---

const getDetailsCollectionRef = (shipmentId: string) => collection(db, 'shipments', shipmentId, 'details');

// Add a new shipment detail
export const addShipmentDetail = async (shipmentId: string, detailData: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated'>): Promise<string> => {
  const detailsCollectionRef = getDetailsCollectionRef(shipmentId);
  const netWeight = (detailData.grossWeight ?? 0) - (detailData.tareWeight ?? 0); // Calculate net weight before saving
  const docRef = await addDoc(detailsCollectionRef, {
    ...detailData,
    netWeight: parseFloat(netWeight.toFixed(3)), // Store calculated net weight
    shipmentId: shipmentId, // Ensure parent ID is stored
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
  });

  // Trigger recalculation after adding
  await recalculateShipmentTotals(shipmentId);

  return docRef.id;
};

// Update a shipment detail
export const updateShipmentDetail = async (shipmentId: string, detailId: string, updates: Partial<Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt'>>): Promise<void> => {
  const detailDocRef = doc(db, 'shipments', shipmentId, 'details', detailId);
  let dataToUpdate = { ...updates };

  // Recalculate net weight if gross or tare weight is updated
  if (updates.grossWeight !== undefined || updates.tareWeight !== undefined) {
     const currentDetailSnap = await getDoc(detailDocRef);
     if (currentDetailSnap.exists()) {
         const currentData = currentDetailSnap.data() as ShipmentDetail;
         const grossWeight = updates.grossWeight ?? currentData.grossWeight;
         const tareWeight = updates.tareWeight ?? currentData.tareWeight;
         const netWeight = grossWeight - tareWeight;
         dataToUpdate.netWeight = parseFloat(netWeight.toFixed(3));
     }
  }

  await updateDoc(detailDocRef, {
    ...dataToUpdate,
    lastUpdated: serverTimestamp(),
  });

   // Trigger recalculation after updating
   await recalculateShipmentTotals(shipmentId);
};

// Delete a shipment detail
export const deleteShipmentDetail = async (shipmentId: string, detailId: string): Promise<void> => {
  const detailDocRef = doc(db, 'shipments', shipmentId, 'details', detailId);
  await deleteDoc(detailDocRef);

  // Trigger recalculation after deleting
  await recalculateShipmentTotals(shipmentId);
};

// Get all details for a specific shipment
export const getShipmentDetails = async (shipmentId: string): Promise<ShipmentDetail[]> => {
    const detailsCollectionRef = getDetailsCollectionRef(shipmentId);
    const q = query(detailsCollectionRef, orderBy('createdAt', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => detailFromFirestore(doc as QueryDocumentSnapshot<DocumentData>));
};

// --- Recalculation Logic (Client-Side Implementation) ---
export const recalculateShipmentTotals = async (shipmentId: string): Promise<void> => {
    console.log(`Recalculating totals for shipment ${shipmentId}`);
    const shipmentRef = doc(db, 'shipments', shipmentId);
    const details = await getShipmentDetails(shipmentId);

    let totalPallets = 0;
    let totalBags = 0;
    let totalGrossWeight = 0;
    let totalTareWeight = 0;
    let asendiaGrossWeight = 0;
    let asendiaTareWeight = 0;

    // Fetching map is not strictly needed here if we use the constant value
    // const customerMap = await getDropdownOptionsMap(['customers']);

    for (const detail of details) {
        totalPallets += detail.numPallets;
        totalBags += detail.numBags;
        totalGrossWeight += detail.grossWeight;
        totalTareWeight += detail.tareWeight;

        // Check if customer is Asendia using ASENDIA_CUSTOMER_VALUE constant
        if (detail.customerId === ASENDIA_CUSTOMER_VALUE) {
            asendiaGrossWeight += detail.grossWeight;
            asendiaTareWeight += detail.tareWeight;
        }
    }

    const totalNetWeight = totalGrossWeight - totalTareWeight;
    const asendiaNetWeight = asendiaGrossWeight - asendiaTareWeight;

    const updates: Partial<Shipment> = {
        totalPallets,
        totalBags,
        totalGrossWeight: parseFloat(totalGrossWeight.toFixed(3)),
        totalTareWeight: parseFloat(totalTareWeight.toFixed(3)),
        totalNetWeight: parseFloat(totalNetWeight.toFixed(3)),
        asendiaGrossWeight: parseFloat(asendiaGrossWeight.toFixed(3)),
        asendiaTareWeight: parseFloat(asendiaTareWeight.toFixed(3)),
        asendiaNetWeight: parseFloat(asendiaNetWeight.toFixed(3)),
        lastUpdated: serverTimestamp(), // Update parent timestamp as well
    };

    try {
        await updateDoc(shipmentRef, updates);
        console.log(`Shipment ${shipmentId} totals updated successfully.`);
    } catch (error) {
        console.error(`Error updating shipment ${shipmentId} totals:`, error);
    }
};
