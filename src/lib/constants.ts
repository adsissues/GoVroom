
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
  AlertTriangle, // For dashboard stats & pending shipments
  CheckCircle2, // For dashboard stats & completed shipments
  Weight, // For dashboard stats
  PlusCircle, // For Add New Shipment
  FileText, // For Audit Logs / PDF
  Bell, // For Notifications
  Camera, // For Mobile Camera
  Database, // For Offline Mode
  CloudUpload, // For CSV Import/Export
  UserCog, // For User Management (Admin)
  Sheet, // For CSV Import/Export icon
} from 'lucide-react';
import type React from 'react'; // Import React for type React.ElementType


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
    icon: Truck,
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
      { title: 'Settings', href: '/admin/settings', icon: UserCog, adminOnly: true },
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
  { id: 'formats_prior', name: 'Formats (Priority)', description: 'Manage formats for "Priority" service type (e.g., when service value is "priority")', icon: Boxes },
  { id: 'formats_eco', name: 'Formats (Economy)', description: 'Manage formats for "Economy" service type (e.g., when service value is "economy")', icon: Boxes },
  { id: 'formats_s3c', name: 'Formats (S3C)', description: 'Manage formats for "S3C" service type (e.g., when service value is "s3c")', icon: Boxes },
  { id: 'doe', name: 'DOE', description: 'Manage Date of Entry options', icon: CalendarDays },
];

/**
 * Mapping for service-specific format collections.
 * IMPORTANT: The keys in this object MUST match the *value* field (converted to lowercase)
 * from your '/services' Firestore collection.
 * For example, if a service document in '/services' has { label: "Priority Express", value: "PRIO_EXP" },
 * then the mapping here should be: 'prio_exp': 'formats_prior_express_collection_name'
 */
export const SERVICE_FORMAT_MAPPING: { [serviceValue: string]: string } = {
  // Ensure these keys (e.g., 'priority') match the 'value' field (lowercase)
  // of the corresponding documents in your '/services' Firestore collection.
  'priority': 'formats_prior',
  'economy': 'formats_eco',
  's3c': 'formats_s3c',
  // Add other service values and their corresponding format collection IDs here
  // Example: 'express_freight': 'formats_express_freight_options',
};

// Default addresses (will be part of Admin Settings feature)
export const DEFAULT_SENDER_ADDRESS = "Asendia UK, Unit 5, The Hub, Solent Business Park, Fareham, PO15 7FH";
export const DEFAULT_CONSIGNEE_ADDRESS = "La Poste, Avenue de la Poste, 75000 Paris, France";

// Value for Asendia customer (used in Shipment Calculations feature)
// Ensure this value matches a 'value' in your 'customers' Firestore collection.
export const ASENDIA_CUSTOMER_VALUE = "asendia";


// Constants for calculations (used in Details Form & Shipment Calculations features)
export const TARE_WEIGHT_DEFAULT = 25.7; // Default tare weight if no bags
export const BAG_WEIGHT_MULTIPLIER = 0.125; // Weight per bag in kg

// For dashboard summary cards
export const DASHBOARD_STATS_MAP: { [key: string]: { title: string; icon: React.ElementType; unit?: string; bgColorClass: string; textColorClass: string } } = {
  pendingShipments: { title: "Pending Shipments", icon: AlertTriangle, bgColorClass: "bg-amber-100", textColorClass: "text-amber-600" },
  completedShipments: { title: "Completed Shipments", icon: CheckCircle2, bgColorClass: "bg-green-100", textColorClass: "text-green-600" },
  totalGrossWeight: { title: "Total Gross Weight", icon: Weight, unit: "kg", bgColorClass: "bg-blue-100", textColorClass: "text-blue-600" },
  lastUpdated: { title: "Last Updated", icon: CalendarDays, unit: "", bgColorClass: "bg-gray-100", textColorClass: "text-gray-600" },
};
