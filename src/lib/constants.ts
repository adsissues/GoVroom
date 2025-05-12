
import type { SelectOption } from './types';
import {
  LayoutDashboard,
  Settings,
  PackageSearch, // For App Logo
  Ship, // Placeholder for Shipments Nav Item
  List, // Placeholder for Dropdown Management
  Users, // Placeholder for Customers
  Truck, // Placeholder for Carriers/Subcarriers
  Wrench, // Placeholder for Services
  Boxes, // Placeholder for Formats
  CalendarDays, // Placeholder for DOE
  AlertTriangle, // For dashboard stats
  CheckCircle2, // For dashboard stats
  Weight, // For dashboard stats
  PlusCircle, // For Add New Shipment
} from 'lucide-react';


export const APP_NAME = "GoVroom";

// For sidebar navigation
export interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  children?: NavItem[];
  matchExact?: boolean; // Optional: for precise active link matching
}

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, matchExact: true },
  {
    title: 'Shipments',
    href: '/shipments',
    icon: Truck, // Changed icon
    children: [
      { title: 'View All', href: '/shipments', icon: List, matchExact: true },
      { title: 'Add New', href: '/shipments/new', icon: PlusCircle, matchExact: true },
    ],
  },
  {
    title: 'Admin',
    href: '/admin',
    icon: Settings,
    adminOnly: true,
    children: [
      { title: 'Dropdowns', href: '/admin/dropdowns', icon: List, adminOnly: true },
      // Add other admin pages here later (e.g., Users, Settings)
    ]
  },
];

// Constants for Dropdown Management (used in Admin UI and Forms)
export interface DropdownCollectionConfig {
  id: string; // Firestore collection name
  name: string; // User-friendly name
  description: string;
  icon: React.ElementType; // Icon for the admin UI
}
export const MANAGED_DROPDOWN_COLLECTIONS: DropdownCollectionConfig[] = [
  { id: 'carriers', name: 'Carriers', description: 'Manage transport carriers', icon: Truck },
  { id: 'subcarriers', name: 'Subcarriers', description: 'Manage specific sub-carrier services', icon: Truck },
  { id: 'customers', name: 'Customers', description: 'Manage customer accounts', icon: Users },
  { id: 'services', name: 'Services', description: 'Manage shipment service types', icon: Wrench },
  { id: 'formats_prior', name: 'Formats (Priority)', description: 'Manage formats for Priority service', icon: Boxes },
  { id: 'formats_eco', name: 'Formats (Economy)', description: 'Manage formats for Economy service', icon: Boxes },
  { id: 'formats_s3c', name: 'Formats (S3C)', description: 'Manage formats for S3C service', icon: Boxes },
  { id: 'doe', name: 'DOE', description: 'Manage Date of Entry options', icon: CalendarDays },
  // Note: '/formats' itself might not be directly managed if sub-formats cover all cases.
];

// Mapping for service-specific format collections
export const SERVICE_FORMAT_MAPPING: { [serviceValue: string]: string } = {
  'priority': 'formats_prior',
  'economy': 'formats_eco',
  's3c': 'formats_s3c',
  // Add other service values and their corresponding format collection IDs here
};

// Default addresses (will be part of Admin Settings feature)
export const DEFAULT_SENDER_ADDRESS = "Asendia UK, Unit 5, The Hub, Solent Business Park, Fareham, PO15 7FH";
export const DEFAULT_CONSIGNEE_ADDRESS = "La Poste, Avenue de la Poste, 75000 Paris, France";

// Value for Asendia customer (will be used in Shipment Calculations feature)
export const ASENDIA_CUSTOMER_VALUE = "asendia";


// Constants for calculations (will be used in Details Form & Shipment Calculations features)
export const TARE_WEIGHT_DEFAULT = 25.7;
export const BAG_WEIGHT_MULTIPLIER = 0.125;

// For dashboard summary cards
export const DASHBOARD_STATS_MAP: { [key: string]: { title: string; icon: React.ElementType; unit?: string; bgColorClass: string; textColorClass: string } } = {
  pendingShipments: { title: "Pending Shipments", icon: AlertTriangle, bgColorClass: "bg-amber-100", textColorClass: "text-amber-600" },
  completedShipments: { title: "Completed Shipments", icon: CheckCircle2, bgColorClass: "bg-green-100", textColorClass: "text-green-600" },
  totalWeight: { title: "Total Gross Weight", icon: Weight, unit: "kg", bgColorClass: "bg-blue-100", textColorClass: "text-blue-600" },
  totalCarriers: { title: "Active Carriers", icon: Truck, bgColorClass: "bg-indigo-100", textColorClass: "text-indigo-600" }, // Example, might change
};
