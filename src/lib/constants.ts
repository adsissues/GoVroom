import type { SelectOption } from './types';
import { Truck, Gauge, PackagePlus, AlertTriangle, CheckCircle2, Weight } from 'lucide-react';

export const APP_NAME = "GoVroom";

// CARRIERS, SUBCARRIERS, and CUSTOMERS are now fetched from Firestore.
// See src/lib/firebase/dropdowns.ts and components using them.

// Example services, assuming these might also come from Firestore or be relatively static
export const SERVICES_OPTIONS: SelectOption[] = [
  { value: 'prior', label: 'Priority Service' },
  { value: 'eco', label: 'Economy Service' },
  { value: 's3c', label: 'Special Service 3C' },
  { value: 'standard', label: 'Standard' },
  { value: 'express', label: 'Express' },
  { value: 'overnight', label: 'Overnight' },
];

// Mapping from service value to the Firestore collection name for formats
export const SERVICE_FORMAT_MAPPING: { [serviceValue: string]: string } = {
  'prior': 'formats_prior',
  'eco': 'formats_eco',
  's3c': 'formats_s3c',
  // Add other services and their format collections if needed
  // 'standard': 'formats_standard', // example
};


export const SIDEBAR_NAV_ITEMS = [
  { title: 'Dashboard', href: '/dashboard', icon: Gauge },
  { title: 'Shipments', href: '/shipments', icon: Truck },
  { title: 'Add Shipment', href: '/shipments/new', icon: PackagePlus },
  // { title: 'Customers', href: '/customers', icon: Users },
  // { title: 'Settings', href: '/settings', icon: Settings },
];

// For dashboard summary cards
export const DASHBOARD_STATS_MAP = {
  pendingShipments: { title: "Pending Shipments", icon: AlertTriangle, bgColorClass: "bg-amber-100", textColorClass: "text-amber-600" },
  completedShipments: { title: "Completed Shipments", icon: CheckCircle2, bgColorClass: "bg-green-100", textColorClass: "text-green-600" },
  totalWeight: { title: "Total Weight Handled", icon: Weight, unit: "kg", bgColorClass: "bg-blue-100", textColorClass: "text-blue-600" },
  totalCarriers: { title: "Active Carriers", icon: Truck, bgColorClass: "bg-indigo-100", textColorClass: "text-indigo-600" },
};

export const DEFAULT_SENDER_ADDRESS = "Asendia UK, Unit 5, The Hub, Solent Business Park, Fareham, PO15 7FH";
export const DEFAULT_CONSIGNEE_ADDRESS = "La Poste, Avenue de la Poste, 75000 Paris, France";

export const TARE_WEIGHT_DEFAULT = 25.7;
export const BAG_WEIGHT_MULTIPLIER = 0.125;
