import type { SelectOption } from './types';
import {
  LayoutDashboard,
  Settings,
  PackageSearch,
  Truck,
  List,
  Users,
  Wrench,
  Boxes,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  Weight,
  PlusCircle,
  FileText,
  Bell,
  Camera,
  Database,
  CloudUpload,
  UserCog,
  Sheet,
  Users2,
  ListChecks,
  Menu
} from 'lucide-react';
import type React from 'react';

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
  { title: 'Manage Dropdowns', href: '/admin/dropdowns', icon: ListChecks, adminOnly: true },
  { title: 'App Settings', href: '/admin/settings', icon: UserCog, adminOnly: true },
  { title: 'User Management', href: '/admin/users', icon: Users2, adminOnly: true },
];

// Constants for Dropdown Management (used in Admin UI and Forms)
export interface DropdownCollectionConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
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

// Customer IDs for specific dashboard breakdowns
// These values must match the 'value' field in your Firestore /customers collection
export const PRIMARY_ASENDIA_CUSTOMER_ID_FOR_DASHBOARD_BREAKDOWN = '2'; // Asendia A/C
export const ASENDIA_UK_CUSTOMER_ID = '3';                              // Asendia UK
export const ASENDIA_UK_BAGS_CUSTOMER_ID = '4';                         // Asendia UK/BAGS
export const TRANSIT_LIGHT_CUSTOMER_ID = '5';                           // Transit Light

// Constants for calculations
export const TARE_WEIGHT_DEFAULT = 25.7;
export const BAG_WEIGHT_MULTIPLIER = 0.11;

// For dashboard summary cards
export const DASHBOARD_STATS_MAP: {
  [key: string]: {
    title: string;
    icon: React.ElementType;
    unit?: string;
    bgColorClass: string;
    textColorClass: string;
    isUnavailable?: boolean;
  };
} = {
  lastUpdateTimestamp: {
    title: "Last Updated",
    icon: CalendarDays,
    unit: "",
    bgColorClass: "bg-gray-100",
    textColorClass: "text-gray-600",
  },
};

// Default values for dropdowns
export const DEFAULT_PRIOR_SERVICE_ID = "E";  // Must match 'value' in /services
export const DEFAULT_DOE_ID = "UZ1";          // Must match 'value' in /doe


