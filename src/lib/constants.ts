
import type { SelectOption } from './types';
import { 
  Truck, 
  Gauge, 
  PackagePlus, 
  Settings, 
  ListPlus, 
  Users, 
  CalendarClock 
} from 'lucide-react';
// Note: AlertTriangle, CheckCircle2, Weight are used in DASHBOARD_STATS_MAP but passed as components
// to SummaryCard from DashboardPage, so they are imported in DashboardPage.

export const APP_NAME = "GoVroom";

// For sidebar navigation
export interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  children?: NavItem[]; // For sub-menus, if needed in future
}

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: Gauge },
  { title: 'Shipments', href: '/shipments', icon: Truck },
  { title: 'Add Shipment', href: '/shipments/new', icon: PackagePlus },
  { title: 'Dropdown Admin', href: '/admin/dropdowns', icon: Settings, adminOnly: true },
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

export interface DropdownCollectionConfig {
  id: string; // Firestore collection name
  name: string; // User-friendly name for UI
  description: string;
}

export const MANAGED_DROPDOWN_COLLECTIONS: DropdownCollectionConfig[] = [
  { id: 'carriers', name: 'Carriers', description: 'Manage carrier options for shipments.' },
  { id: 'subcarriers', name: 'Subcarriers', description: 'Manage subcarrier options.' },
  { id: 'customers', name: 'Customers', description: 'Manage customer names and identifiers.' },
  { id: 'services', name: 'Services', description: 'Manage service types offered.' },
  { id: 'doe', name: 'DOE Options', description: 'Manage Date Of Entry (or similar) options.' },
  { id: 'formats', name: 'General Formats', description: 'Manage general format options (if any).' },
  { id: 'formats_prior', name: 'Formats (Priority)', description: 'Manage format options for Priority service.' },
  { id: 'formats_eco', name: 'Formats (Economy)', description: 'Manage format options for Economy service.' },
  { id: 'formats_s3c', name: 'Formats (Special S3C)', description: 'Manage format options for Special S3C service.' },
  // Add other format collections as specified, e.g., formats_standard
];

export const DROPDOWN_COLLECTION_ICONS: { [key: string]: React.ElementType } = {
  carriers: Truck,
  subcarriers: Truck,
  customers: Users, 
  services: Settings,
  doe: CalendarClock, 
  formats: ListPlus,
  formats_prior: ListPlus,
  formats_eco: ListPlus,
  formats_s3c: ListPlus,
  default: ListPlus,
};

// Icons like AlertTriangle, CheckCircle2, Weight used in DASHBOARD_STATS_MAP
// are imported in the DashboardPage component where SummaryCard is instantiated.
// Users, CalendarClock, Gauge etc. if used in THIS file must be imported at the top.
