
export type ShipmentStatus = 'Pending' | 'Completed';

export interface Shipment {
  id: string;
  carrier: string;
  subcarrier: string;
  driverName: string;
  departureDate: Date;
  arrivalDate: Date;
  status: ShipmentStatus;
  sealNumber?: string;
  truckRegistration?: string;
  trailerRegistration?: string;
  senderAddress?: string;
  consigneeAddress?: string;
  totalWeight?: number; // Calculated or entered
  lastUpdated: Date;
  details?: ShipmentDetail[]; // Optional: if details are part of main shipment doc
}

export interface ShipmentDetail {
  id: string;
  shipmentId: string;
  numberOfPallets: number;
  numberOfBags?: number; // Shown if Pallets > 0
  customer: string;
  service: string;
  format?: string; // Filtered by Service
  tareWeight: number; // Default or auto-calculated
  grossWeight: number;
  dispatchNumber?: string;
  doe?: string; // Dropdown from Firestore
}

export interface SummaryStat {
  title: string;
  value: string | number;
  icon: React.ElementType;
  bgColorClass?: string;
  textColorClass?: string;
  change?: string; // e.g., "+5% from last month"
}

// For dropdown options
export type SelectOption = {
  value: string;
  label: string;
};

// For AI suggestions
export type AISuggestion = {
  numberOfBags: number;
  customer: string;
  service: string;
};

// User type for authentication
export type UserRole = 'admin' | 'user';

export interface User {
  uid: string;
  email: string | null;
  role: UserRole | null; // Role can be null if not set or during loading
}
