
import type { Timestamp } from 'firebase/firestore';

export type ShipmentStatus = 'Pending' | 'Completed';

// Main Shipment document
export interface Shipment {
  id: string; // Firestore document ID
  carrierId: string; // Reference to /carriers/{id} -> value field
  subcarrierId?: string; // Reference to /subcarriers/{id} -> value field
  driverName: string;
  departureDate: Timestamp;
  arrivalDate: Timestamp;
  status: ShipmentStatus;
  sealNumber?: string;
  truckRegistration?: string;
  trailerRegistration?: string;
  senderAddress: string; // Editable only by admin, defaults from settings
  consigneeAddress: string; // Editable only by admin, defaults from settings
  lastUpdated: Timestamp;
  createdAt: Timestamp;

  // Aggregated fields (calculated via Cloud Function or on write/update)
  totalPallets?: number;
  totalBags?: number;
  totalGrossWeight?: number; // Sum of gross weights of all details
  totalTareWeight?: number;  // Sum of tare weights of all details
  totalNetWeight?: number;   // Sum of net weights of all details (totalGrossWeight - totalTareWeight)

  // Specific customer net weights for dashboard breakdown
  asendiaACNetWeight?: number;   // Net weight for customer specified by PRIMARY_ASENDIA_CUSTOMER_ID_FOR_DASHBOARD_BREAKDOWN
  asendiaUKNetWeight?: number;   // Net weight for customer specified by ASENDIA_UK_CUSTOMER_ID
  transitLightNetWeight?: number; // Net weight for customer specified by TRANSIT_LIGHT_CUSTOMER_ID
  remainingCustomersNetWeight?: number; // Net weight for all other customers

  // Gross and Tare for Asendia A/C (if needed for other reports, otherwise can be derived if only net is stored)
  asendiaACGrossWeight?: number;
  asendiaACTareWeight?: number;


  pdfUrls?: { // Placeholder for PDF generation feature
    preAlert?: string;
    cmr?: string;
  };
  scannedDocuments?: string[]; // Placeholder for mobile camera upload
}


// ShipmentDetail document (subcollection of shipments)
export interface ShipmentDetail {
  id: string; // Firestore document ID
  shipmentId: string; // Parent shipment ID (for potential queries, though direct path is primary)
  numPallets: number;
  numBags: number;
  customerId: string; // Reference to /customers/{id} -> value field
  serviceId: string; // Reference to /services/{id} -> value field
  formatId: string; // Reference to /formats.../{id} -> value field (depends on service)
  tareWeight: number;
  grossWeight: number;
  dispatchNumber?: string;
  doeId?: string; // Reference to /doe/{id} -> value field
  createdAt: Timestamp;
  lastUpdated: Timestamp;
  // Calculated
  netWeight: number; // Gross - Tare (Ensure this is always calculated on write/update)
}

export interface SelectOption {
  value: string;
  label: string;
}

export type UserRole = 'admin' | 'user';

// User document (/users/{uid})
export interface User {
  uid: string;
  email: string | null;
  role: UserRole; // Ensure role is always set
  createdAt?: Timestamp; // Optional: track user creation
  lastLogin?: Timestamp; // Optional: track last login
}

// Application Settings document (stored in /app_settings/global)
export interface AppSettings {
  id?: 'global'; // Fixed ID for the global settings document
  defaultSenderAddress: string;
  defaultConsigneeAddress: string;
  // Add other global settings as needed
  lastUpdated?: Timestamp;
}

// Dropdown Item document (used in /carriers, /customers, etc.)
export interface DropdownItem {
  id: string; // Firestore document ID
  label: string;
  value: string; // Unique value used for storing references
  createdAt?: Timestamp; // Optional
  lastUpdated?: Timestamp; // Optional
}

// Placeholder for Audit Log document (/audit_logs/{logId})
export interface AuditLog {
    id: string;
    timestamp: Timestamp;
    userId: string; // UID of the user performing the action
    userEmail?: string; // Email for easier reading
    action: string; // e.g., 'create_shipment', 'update_detail', 'delete_dropdown'
    collectionPath: string; // e.g., 'shipments', 'shipments/abc/details'
    documentId: string;
    changes?: Record<string, { oldValue: any; newValue: any }>; // Optional: Log specific field changes
    details?: string; // Optional: More context
}

// Placeholder for Notification document (/notifications/{notificationId})
export interface Notification {
    id: string;
    userId: string; // Target user UID
    title: string;
    body: string;
    shipmentId?: string; // Optional: Link to relevant shipment
    read: boolean;
    createdAt: Timestamp;
}
