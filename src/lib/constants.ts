import type { SelectOption } from './types';
import { Truck, Gauge, PackagePlus, AlertTriangle, CheckCircle2, Weight } from 'lucide-react';

export const APP_NAME = "GoVroom";

// CARRIERS, SUBCARRIERS, and CUSTOMERS are now fetched from Firestore.
// See src/lib/firebase/dropdowns.ts and components using them.

export const SERVICES: SelectOption[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'express', label: 'Express' },
  { value: 'overnight', label: 'Overnight' },
];

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
