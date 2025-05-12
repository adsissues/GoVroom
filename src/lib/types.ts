
import type { Timestamp } from 'firebase/firestore';

export type ShipmentStatus = 'Pending' | 'Completed';

// Expanded Shipment interface
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
  senderAddress?: string; // Only editable by admin
  consigneeAddress?: string; // Only editable by admin
  lastUpdated: Timestamp;
  createdAt: Timestamp;
  // Aggregated fields (calculated later)
  totalPallets?: number;
  totalBags?: number;
  totalGrossWeight?: number;
  totalTareWeight?: number;
  totalNetWeight?: number;
  asendiaGrossWeight?: number;
  asendiaTareWeight?: number;
  asendiaNetWeight?: number;
}


// ShipmentDetail interface for the subcollection
export interface ShipmentDetail {
  id: string; // Firestore document ID
  shipmentId: string; // Parent shipment ID
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
  netWeight?: number; // Gross - Tare
}

export interface SelectOption {
  value: string;
  label: string;
}

export type UserRole = 'admin' | 'user';

export interface User {
  uid: string;
  email: string | null;
  role: UserRole | null;
}

// AppSettings will be defined when the Admin Settings feature is implemented.
export interface AppSettings {
  defaultSenderAddress: string;
  defaultConsigneeAddress: string;
}

// Interface for Dropdown items fetched from Firestore
export interface DropdownItem {
  id: string; // Firestore document ID
  label: string;
  value: string;
}
```