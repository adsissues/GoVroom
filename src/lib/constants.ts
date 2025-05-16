
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
  // These are the collections that will hold the format options specific to each service.
  // The 'id' here MUST match the value used in SERVICE_FORMAT_MAPPING below.
  { id: 'formats_prior', name: 'Formats (Priority)', description: 'Manage formats for "Priority" service', icon: Boxes },
  { id: 'formats_eco', name: 'Formats (Economy)', description: 'Manage formats for "Economy" service', icon: Boxes },
  { id: 'formats_s3c', name: 'Formats (S3C)', description: 'Manage formats for "S3C" service', icon: Boxes },
  { id: 'doe', name: 'DOE', description: 'Manage Date of Entry options', icon: CalendarDays },
];

/**
 * Mapping for service-specific format collections.
 * IMPORTANT: The keys in this object MUST match the *value* field (converted to lowercase)
 * from your '/services' Firestore collection.
 *
 * The application code will convert the selected service's value to lowercase before
 * looking it up in this map.
 *
 * Example:
 * If a service document in your '/services' Firestore collection has:
 *   { label: "Priority Express Mail", value: "priority_express_mail" } // value field
 *
 * Then the mapping here MUST include:
 *   'priority_express_mail': 'formats_prior' // key is the lowercase version of the value field
 *
 * If a service document in your '/services' Firestore collection has:
 *   { label: "Prior", value: "E" } // As per your screenshot
 *
 * Then the mapping here MUST include:
 *   'e': 'formats_prior' // key is 'e' (lowercase of "E")
 */
export const SERVICE_FORMAT_MAPPING: { [serviceValueKey: string]: string | null } = {
  // --- IMPORTANT: Update these keys to match your Firestore /services `value` fields (in lowercase) ---
  'e': 'formats_prior',              // For service "Prior" which has value: "E" in Firestore
  'priority': 'formats_prior',       // Keep for flexibility if you change "E" to "priority"
  'prior': 'formats_prior',          // Keep for flexibility

  'c': 'formats_eco',                // Assuming "Eco" service might have value: "C" (add your actual value)
  'economy': 'formats_eco',          // Keep for flexibility
  'eco': 'formats_eco',              // Keep for flexibility

  's': 'formats_s3c',                // Assuming "S3C" service might have value: "S" (add your actual value)
  's3c': 'formats_s3c',              // Keep for flexibility
  // Add more mappings as needed for ALL your services that have distinct format dropdowns.
  // If a service does NOT have a specific format dropdown, you can either omit its key
  // or map it to `null` (the ShipmentDetailForm will not show a format dropdown if the mapping is null or not found).
  // 'another_service_value': 'formats_another',
  // 'service_without_formats': null,
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
