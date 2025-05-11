
import type { Shipment, SelectOption } from './types';
import { Package, Truck, User, CalendarDays, AlertTriangle, CheckCircle2, Weight, Gauge, PackagePlus } from 'lucide-react';

export const APP_NAME = "GoVroom";

export const CARRIERS: SelectOption[] = [
  { value: 'dhl', label: 'DHL' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'ups', label: 'UPS' },
  { value: 'speedylogistics', label: 'Speedy Logistics' },
];

export const SUBCARRIERS: SelectOption[] = [
  { value: 'local_a', label: 'Local Route A' },
  { value: 'regional_b', label: 'Regional Route B' },
  { value: 'express_air', label: 'Express Air' },
];

export const CUSTOMERS: SelectOption[] = [
  { value: 'techcorp', label: 'TechCorp' },
  { value: 'retailgiant', label: 'RetailGiant' },
  { value: 'pharmainc', label: 'PharmaInc' },
];

export const SERVICES: SelectOption[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'express', label: 'Express' },
  { value: 'overnight', label: 'Overnight' },
];

export const MOCK_SHIPMENTS: Shipment[] = [
  {
    id: '1',
    carrier: 'DHL',
    subcarrier: 'Local Route A',
    driverName: 'John Doe',
    departureDate: new Date(new Date().setDate(new Date().getDate() - 2)),
    arrivalDate: new Date(new Date().setDate(new Date().getDate() -1)),
    status: 'Completed',
    sealNumber: 'SEAL123',
    truckRegistration: 'TRUCK001',
    trailerRegistration: 'TRAIL001',
    totalWeight: 1200,
    lastUpdated: new Date(new Date().setDate(new Date().getDate() - 1)),
  },
  {
    id: '2',
    carrier: 'FedEx',
    subcarrier: 'Regional Route B',
    driverName: 'Jane Smith',
    departureDate: new Date(),
    arrivalDate: new Date(new Date().setDate(new Date().getDate() + 1)),
    status: 'Pending',
    sealNumber: 'SEAL456',
    truckRegistration: 'TRUCK002',
    trailerRegistration: 'TRAIL002',
    totalWeight: 850,
    lastUpdated: new Date(),
  },
  {
    id: '3',
    carrier: 'UPS',
    subcarrier: 'Express Air',
    driverName: 'Mike Johnson',
    departureDate: new Date(new Date().setDate(new Date().getDate() - 5)),
    arrivalDate: new Date(new Date().setDate(new Date().getDate() -4)),
    status: 'Completed',
    truckRegistration: 'TRUCK003',
    totalWeight: 2000,
    lastUpdated: new Date(new Date().setDate(new Date().getDate() - 4)),
  },
  {
    id: '4',
    carrier: 'Speedy Logistics',
    subcarrier: 'Local Route A',
    driverName: 'Sarah Williams',
    departureDate: new Date(new Date().setDate(new Date().getDate() + 1)),
    arrivalDate: new Date(new Date().setDate(new Date().getDate() + 2)),
    status: 'Pending',
    truckRegistration: 'TRUCK004',
    totalWeight: 500,
    lastUpdated: new Date(),
  },
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

