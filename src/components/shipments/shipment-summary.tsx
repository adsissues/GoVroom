
"use client";

import type { Shipment } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { getDropdownOptionsMap } from '@/lib/firebase/dropdownService';
import { Skeleton } from '../ui/skeleton';

interface ShipmentSummaryProps {
  shipment: Shipment;
}

const formatDateForSummary = (timestamp: Timestamp | undefined): string => {
  if (!timestamp) return 'N/A';
  try {
    return format(timestamp.toDate(), "PP"); // e.g., Sep 24, 2023
  } catch (error) {
    console.error("Error formatting date for summary:", error);
    return 'Invalid Date';
  }
};

export default function ShipmentSummary({ shipment }: ShipmentSummaryProps) {
  const { data: dropdownMaps, isLoading: isLoadingMaps } = useQuery({
    queryKey: ['dropdownMapsForSummary', shipment.carrierId, shipment.subcarrierId],
    queryFn: () => getDropdownOptionsMap(['carriers', 'subcarriers']),
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000,
  });

  const getLabel = (collectionId: string, value: string | undefined | null, defaultValue: string = 'N/A'): string => {
    if (!value) return defaultValue;
    if (isLoadingMaps || !dropdownMaps) return 'Loading...';
    return dropdownMaps[collectionId]?.[value] || value;
  };

  const carrierLabel = getLabel('carriers', shipment.carrierId);
  const subcarrierLabel = shipment.subcarrierId ? getLabel('subcarriers', shipment.subcarrierId) : '';

  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between items-start">
        <Badge variant={shipment.status === 'Completed' ? 'default' : 'secondary'}
               className={`text-xs px-2 py-0.5 ${shipment.status === 'Completed' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
          Status: {shipment.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        <p><span className="font-semibold">Carrier:</span> {carrierLabel}</p>
        {subcarrierLabel && <p><span className="font-semibold">Subcarrier:</span> {subcarrierLabel}</p>}
        <p><span className="font-semibold">Driver:</span> {shipment.driverName || 'N/A'}</p>
        <p><span className="font-semibold">Departure:</span> {formatDateForSummary(shipment.departureDate)}</p>
        <p><span className="font-semibold">Arrival:</span> {formatDateForSummary(shipment.arrivalDate)}</p>
        {shipment.sealNumber && <p><span className="font-semibold">Seal #:</span> {shipment.sealNumber}</p>}
        {shipment.truckRegistration && <p><span className="font-semibold">Truck Reg:</span> {shipment.truckRegistration}</p>}
        {shipment.trailerRegistration && <p><span className="font-semibold">Trailer Reg:</span> {shipment.trailerRegistration}</p>}
      </div>
    </div>
  );
}
