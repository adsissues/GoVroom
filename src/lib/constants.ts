
import type { SelectOption } from './types';
import {
  LayoutDashboard,
  Settings,
  PackageSearch, // For App Logo
  Truck, // Placeholder for Shipments Nav Item
  List, // Placeholder for Dropdown Management
  Users, // Placeholder for Customers
  Wrench, // Placeholder for Services
  Boxes, // Placeholder for Formats
  CalendarDays, // Placeholder for DOE
  AlertTriangle, // For dashboard stats & pending shipments
  CheckCircle2, // For dashboard stats & completed shipments
  Weight, // For dashboard stats
  PlusCircle, // For Add New Shipment
  FileText, // For Audit Logs / PDF
  Bell, // For Notifications
  Camera, // For Mobile Camera
  Database, // For Offline Mode
  CloudUpload, // For CSV Import/Export
  UserCog, // For User Management (Admin) & App Settings
  Sheet, // For CSV Import/Export icon
  Users2, // Icon for User Management
  ListChecks, // Icon for Dropdown Management in AppHeader
  Menu // Icon for main navigation menu
} from 'lucide-react';
import type React from 'react'; // Import React for type React.ElementType


export const APP_NAME = "GoVroom";

// For main navigation menu in AppHeader
export interface NavMenuItem {
  title: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

export const HEADER_NAV_ITEMS: NavMenuItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'View All Shipments', href: '/shipments', icon: List },
  { title: 'Add New Shipment', href: '/shipments/new', icon: PlusCircle },
];

export const ADMIN_NAV_ITEMS: NavMenuItem[] = [
  // { title: 'Admin Dashboard', href: '/admin', icon: Settings, adminOnly: true },
  { title: 'Manage Dropdowns', href: '/admin/dropdowns', icon: ListChecks, adminOnly: true },
  { title: 'App Settings', href: '/admin/settings', icon: UserCog, adminOnly: true },
  { title: 'User Management', href: '/admin/users', icon: Users2, adminOnly: true },
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
  { id: 'formats_prior', name: 'Formats (Priority)', description: 'Manage formats for "Priority" service (e.g., service value "E", "prior", "priority")', icon: Boxes },
  { id: 'formats_eco', name: 'Formats (Economy)', description: 'Manage formats for "Economy" service (e.g., service value "C", "eco", "economy")', icon: Boxes },
  { id: 'formats_s3c', name: 'Formats (S3C)', description: 'Manage formats for "S3C" service (e.g., service value "S", "s3c")', icon: Boxes },
  { id: 'doe', name: 'DOE', description: 'Manage Date of Entry options', icon: CalendarDays },
];

/**
 * Mapping for service-specific format collections.
 * The keys in this object MUST match the *value* field (converted to lowercase)
 * from your '/services' Firestore collection.
 */
export const SERVICE_FORMAT_MAPPING: { [serviceValueKey: string]: string | null } = {
  'e': 'formats_prior',
  'prior': 'formats_prior',
  'priority': 'formats_prior',
  'c': 'formats_eco',
  'eco': 'formats_eco',
  'economy': 'formats_eco',
  's': 'formats_s3c',
  's3c': 'formats_s3c',
};


// Default addresses (will be part of Admin Settings feature)
export const DEFAULT_SENDER_ADDRESS = "Asendia UK, Unit 5, The Hub, Solent Business Park, Fareham, PO15 7FH";
export const DEFAULT_CONSIGNEE_ADDRESS = "La Poste, Avenue de la Poste, 75000 Paris, France";

// Value for the primary Asendia customer whose weight is tracked separately on the dashboard
// and used in the `recalculateShipmentTotals` function.
// *** THIS MUST BE THE Firestore 'value' (Internal ID) OF YOUR "Asendia A/C" CUSTOMER. ***
// You confirmed this ID is "123456789".
export const PRIMARY_ASENDIA_CUSTOMER_ID_FOR_DASHBOARD_BREAKDOWN = "123456789";


// Constants for calculations (used in Details Form & Shipment Calculations features)
export const TARE_WEIGHT_DEFAULT = 25.7; // Default tare weight if no bags
export const BAG_WEIGHT_MULTIPLIER = 0.125; // Weight per bag in kg

// For dashboard summary cards
export const DASHBOARD_STATS_MAP: { [key: string]: { title: string; icon: React.ElementType; unit?: string; bgColorClass: string; textColorClass: string, isUnavailable?: boolean } } = {
  lastUpdateTimestamp: { title: "Last Updated", icon: CalendarDays, unit: "", bgColorClass: "bg-gray-100", textColorClass: "text-gray-600" },
};

// Default "Prior" service VALUE (Internal ID) for ShipmentDetailForm
// This value MUST EXACTLY match the 'value' field of your "Prior" service document in Firestore.
// You indicated this is "E".
export const DEFAULT_PRIOR_SERVICE_ID = "E";

// Default "DOE" (Date of Entry) VALUE (Internal ID) for ShipmentDetailForm
// This value MUST EXACTLY match the 'value' field of your default DOE document in Firestore.
// You indicated this is "UZ1".
export const DEFAULT_DOE_ID = "UZ1";
