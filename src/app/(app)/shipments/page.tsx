
"use client";
import { useState, useMemo, useEffect } from 'react';
import SearchFilterBar from '@/components/shipments/search-filter-bar';
import { ShipmentsTable } from '@/components/shipments/shipments-table';
import type { Shipment } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getShipmentsFromFirestore, deleteShipmentFromFirestore } from '@/lib/firebase/shipments';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export default function ShipmentsPage() {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: shipments = [], isLoading, error, refetch } = useQuery<Shipment[]>({
    queryKey: ['shipments'],
    queryFn: () => getShipmentsFromFirestore(), 
  });

  const filteredShipments = useMemo(() => {
    if (isLoading || !shipments) return [];
    return shipments.filter(shipment => {
      let matches = true;
      if (filters.carrier && filters.carrier !== 'all_items_selection_sentinel' && shipment.carrier !== filters.carrier) matches = false;
      if (filters.driverName && shipment.driverName && !shipment.driverName.toLowerCase().includes(filters.driverName.toLowerCase())) matches = false;
      if (filters.status && filters.status !== 'all_items_selection_sentinel' && shipment.status !== filters.status) matches = false;
      
      const departureDate = shipment.departureDate instanceof Date ? shipment.departureDate : new Date(shipment.departureDate);
      const arrivalDate = shipment.arrivalDate instanceof Date ? shipment.arrivalDate : new Date(shipment.arrivalDate);

      if (filters.dateRange?.from && departureDate < new Date(filters.dateRange.from)) matches = false;
      if (filters.dateRange?.to && arrivalDate > new Date(filters.dateRange.to)) matches = false;
      
      return matches;
    });
  }, [shipments, filters, isLoading]);

  const handleSearch = (searchCriteria: Record<string, any>) => {
    setFilters(searchCriteria);
    // Client-side filtering is primary. If server-side filtering was implemented with query keys:
    // queryClient.invalidateQueries({ queryKey: ['shipments', searchCriteria] });
    // refetch(); // or let invalidation trigger refetch
  };

  const deleteMutation = useMutation({
    mutationFn: deleteShipmentFromFirestore,
    onSuccess: async () => {
      // Invalidate and refetch the shipments query to update the list
      await queryClient.invalidateQueries({ queryKey: ['shipments'] });
      // Optionally, refetch directly if preferred, though invalidate is usually enough
      // await refetch(); 
      
      // Invalidate any other queries that might be affected, e.g., dashboard summaries
      // The dashboard page uses onSnapshot, so direct invalidation might not be strictly needed for it,
      // but it's good practice if there were other dashboard-related queries.
      // await queryClient.invalidateQueries({ queryKey: ['dashboardStats'] }); // Example if such a query existed

      toast({
        title: 'Shipment Deleted',
        description: 'The shipment has been successfully deleted.',
      });
    },
    onError: (err) => {
      toast({
        title: 'Error Deleting Shipment',
        description: err instanceof Error ? err.message : 'Could not delete shipment.',
        variant: 'destructive',
      });
    },
  });

  const handleDeleteShipment = (shipmentId: string) => {
    if (window.confirm('Are you sure you want to delete this shipment? This action cannot be undone if the shipment has associated details.')) {
      deleteMutation.mutate(shipmentId);
    }
  };

  // Placeholder for future edit functionality
  const handleEditShipment = (shipmentId: string) => {
    console.log("Edit shipment:", shipmentId); 
    // Example: router.push(`/shipments/edit/${shipmentId}`);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-xl rounded-xl">
        <CardHeader>
            <CardTitle className="text-2xl">Shipment Search &amp; Filter</CardTitle>
        </CardHeader>
        <CardContent>
            <SearchFilterBar onSearch={handleSearch} />
        </CardContent>
      </Card>
      
      <Card className="shadow-xl rounded-xl">
        <CardHeader>
            <CardTitle className="text-2xl">Shipment List</CardTitle>
        </CardHeader>
        <CardContent>
            {isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {error instanceof Error ? error.message : "Failed to load shipments."}
                </AlertDescription>
              </Alert>
            )}
            {!isLoading && !error && (
              <ShipmentsTable 
                shipments={filteredShipments} 
                onEdit={handleEditShipment} // Pass edit handler
                onDelete={handleDeleteShipment}
              />
            )}
        </CardContent>
      </Card>
    </div>
  );
}
