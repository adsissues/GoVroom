
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
  // details are now fetched separately
}

export interface ShipmentDetail {
  id: string; // Firestore document ID
  shipmentId: string; // Parent shipment ID
  numberOfPallets: number;
  numberOfBags?: number; // Shown if Pallets > 0
  customer: string; // Customer ID/value from dropdown
  service: string; // Service ID/value from dropdown
  format?: string; // Format ID/value from dropdown, dynamically loaded based on service
  tareWeight: number;
  grossWeight: number;
  dispatchNumber?: string;
  doe?: string; // DOE ID/value from dropdown
  // Timestamps can be added if needed
  // createdAt?: Date;
  // updatedAt?: Date;
}

// For displaying shipment along with its details
export interface ShipmentWithDetails extends Shipment {
  details: ShipmentDetail[];
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

export interface AppSettings {
  defaultSenderAddress: string;
  defaultConsigneeAddress: string;
}
