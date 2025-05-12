
import type { SelectOption } from './types';
import {
  Truck,
  LayoutDashboard,
  PackagePlus,
  Settings,
  ListChecks as ListChecksIcon,
  Users,
  CalendarClock,
  Weight, // Explicitly import used icons
  FileText, // For App Settings
  AlertTriangle, // No longer used here, but keep import if needed elsewhere
  CheckCircle2, // No longer used here
} from 'lucide-react';


export const APP_NAME = "GoVroom";
// Make sure this value matches the 'value' field in your Firestore /customers collection for Asendia
export const ASENDIA_CUSTOMER_VALUE = "asendia"; 

// For sidebar navigation
export interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  children?: NavItem[]; // For sub-menus, if needed in future
}

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Shipments', href: '/shipments', icon: Truck },
  { title: 'Add Shipment', href: '/shipments/new', icon: PackagePlus },
  {
    title: 'Admin',
    href: '/admin',
    icon: Settings,
    adminOnly: true,
    children: [
      { title: 'Dropdowns', href: '/admin/dropdowns', icon: ListChecksIcon, adminOnly: true },
      { title: 'App Settings', href: '/admin/settings', icon: FileText, adminOnly: true },
    ]
  },
];


// For dashboard summary cards - This map is illustrative, dashboard page uses direct icons.
// export const DASHBOARD_STATS_MAP = {
//   pendingShipments: { title: "Pending Shipments", icon: AlertTriangle, bgColorClass: "bg-amber-100", textColorClass: "text-amber-600" },
//   completedShipments: { title: "Completed Shipments", icon: CheckCircle2, bgColorClass: "bg-green-100", textColorClass: "text-green-600" },
//   totalWeight: { title: "Total Weight Handled", icon: Weight, unit: "kg", bgColorClass: "bg-blue-100", textColorClass: "text-blue-600" },
//   totalCarriers: { title: "Active Carriers", icon: Truck, bgColorClass: "bg-indigo-100", textColorClass: "text-indigo-600" },
// };

// Default addresses (can be overridden in Admin Settings)
export const DEFAULT_SENDER_ADDRESS = "Asendia UK, Unit 5, The Hub, Solent Business Park, Fareham, PO15 7FH";
export const DEFAULT_CONSIGNEE_ADDRESS = "La Poste, Avenue de la Poste, 75000 Paris, France";

// Constants for calculations
export const TARE_WEIGHT_DEFAULT = 25.7; // Default tare weight if no bags
export const BAG_WEIGHT_MULTIPLIER = 0.125; // Weight per bag for auto tare calculation

// Static service options (can be moved to Firestore if needed)
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
  // 'standard': 'formats_standard', // example - add mappings for other services if they have specific formats
};

// Configuration for dropdown management in Admin UI
export interface DropdownCollectionConfig {
  id: string; // Firestore collection name
  name: string; // User-friendly name for UI
  description: string;
}

export const MANAGED_DROPDOWN_COLLECTIONS: DropdownCollectionConfig[] = [
  { id: 'carriers', name: 'Carriers', description: 'Manage carrier options used in shipment forms.' },
  { id: 'subcarriers', name: 'Subcarriers', description: 'Manage subcarrier options for logistics.' },
  { id: 'customers', name: 'Customers', description: 'Manage customer profiles and identifiers.' },
  { id: 'services', name: 'Services', description: 'Manage the types of services offered.' },
  { id: 'doe', name: 'DOE Options', description: 'Manage Date Of Entry (or similar reference) options.' },
  { id: 'formats', name: 'General Formats', description: 'Manage general format options (use if no service-specific formats apply).' },
  { id: 'formats_prior', name: 'Formats (Priority)', description: 'Manage format options specifically for Priority service.' },
  { id: 'formats_eco', name: 'Formats (Economy)', description: 'Manage format options specifically for Economy service.' },
  { id: 'formats_s3c', name: 'Formats (Special S3C)', description: 'Manage format options for Special Service 3C.' },
  // Add entries for other service-specific format collections (e.g., formats_standard) if they exist
];

// Icons for the dropdown management page
export const DROPDOWN_COLLECTION_ICONS: { [key: string]: React.ElementType } = {
  carriers: Truck,
  subcarriers: Truck,
  customers: Users,
  services: Settings,
  doe: CalendarClock,
  formats: ListChecksIcon,
  formats_prior: ListChecksIcon,
  formats_eco: ListChecksIcon,
  formats_s3c: ListChecksIcon,
  default: ListChecksIcon, // Fallback icon
};

