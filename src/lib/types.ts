
export type ShipmentStatus = 'Pending' | 'Completed';

// Minimal Shipment interface for now, will be expanded later.
export interface Shipment {
  id: string;
  carrier: string;
  driverName: string;
  status: ShipmentStatus;
  // ... other fields will be added in later steps
}

// Minimal ShipmentDetail interface for now.
export interface ShipmentDetail {
  id: string;
  shipmentId: string;
  // ... other fields will be added in later steps
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
