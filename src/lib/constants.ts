
import type { SelectOption } from './types';
import {
  LayoutDashboard,
  Settings,
  PackageSearch, // For App Logo
} from 'lucide-react';


export const APP_NAME = "GoVroom";

// For sidebar navigation
export interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  children?: NavItem[];
}

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    title: 'Admin',
    href: '/admin',
    icon: Settings,
    adminOnly: true,
    // Children can be added in later steps as admin features are built
    // children: [
    //   { title: 'Sub Admin Page', href: '/admin/subpage', icon: Settings, adminOnly: true },
    // ]
  },
];

// Constants for Dropdown Management (will be populated in a later step)
export interface DropdownCollectionConfig {
  id: string;
  name: string;
  description: string;
}
export const MANAGED_DROPDOWN_COLLECTIONS: DropdownCollectionConfig[] = [];
export const DROPDOWN_COLLECTION_ICONS: { [key: string]: React.ElementType } = {};


// Default addresses (will be part of Admin Settings feature)
export const DEFAULT_SENDER_ADDRESS = "Asendia UK, Unit 5, The Hub, Solent Business Park, Fareham, PO15 7FH";
export const DEFAULT_CONSIGNEE_ADDRESS = "La Poste, Avenue de la Poste, 75000 Paris, France";

// Value for Asendia customer (will be used in Shipment Calculations feature)
export const ASENDIA_CUSTOMER_VALUE = "asendia";


// Constants for calculations (will be used in Details Form & Shipment Calculations features)
export const TARE_WEIGHT_DEFAULT = 25.7;
export const BAG_WEIGHT_MULTIPLIER = 0.125;

// Mapping for service-specific formats (will be used in Details Form feature)
export const SERVICE_FORMAT_MAPPING: { [serviceValue: string]: string } = {};
