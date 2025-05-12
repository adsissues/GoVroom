
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getShipmentFromFirestore } from '@/lib/firebase/shipments';
import { getShipmentDetailsFromFirestore, deleteShipmentDetailFromFirestore } from '@/lib/firebase/shipmentDetails';
import type { Shipment, ShipmentDetail } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, PlusCircle, ListChecks, Users, BarChart3 } from 'lucide-react';
import ClientFormattedDate from '@/components/shared/client-formatted-date';
import ShipmentDetailDialog from '@/components/shipments/shipment-detail-dialog';
import ShipmentDetailCard from '@/components/shipments/shipment-detail-card';
import { useToast } from '@/hooks/use-toast';
import { ASENDIA_CUSTOMER_VALUE } from '@/lib/constants'; // For identifying Asendia customer

export default function ShipmentDetailPage() {
  const params = useParams();
  const shipmentId = typeof params.shipmentId === 'string' ? params.shipmentId : '';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editingDetail, setEditingDetail] = useState<ShipmentDetail | undefined>(undefined);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Fetch main shipment data
  const { data: shipment, isLoading: isLoadingShipment, error: shipmentError } = useQuery<Shipment | null>({
    queryKey: ['shipment', shipmentId],
    queryFn: () => getShipmentFromFirestore(shipmentId),
    enabled: !!shipmentId,
  });

  // Fetch shipment details subcollection
  const { data: details = [], isLoading: isLoadingDetails, error: detailsError, refetch: refetchDetails } = useQuery<ShipmentDetail[]>({
    queryKey: ['shipmentDetails', shipmentId],
    queryFn: () => getShipmentDetailsFromFirestore(shipmentId),
    enabled: !!shipmentId,
  });

  // Mutation for deleting a detail
  const deleteDetailMutation = useMutation({
    mutationFn: (detailId: string) => deleteShipmentDetailFromFirestore(shipmentId, detailId),
    onSuccess: () => {
      // Invalidate queries to refetch data and trigger recalculations
      queryClient.invalidateQueries({ queryKey: ['shipmentDetails', shipmentId] });
      // Optionally invalidate parent shipment if deletion affects overall totals (e.g., if parent stored summaries)
      // queryClient.invalidateQueries({ queryKey: ['shipment', shipmentId] }); 
      toast({ title: "Detail Deleted", description: "The shipment detail has been successfully deleted." });
    },
    onError: (err) => {
      toast({
        title: 'Error Deleting Detail',
        description: err instanceof Error ? err.message : 'Could not delete shipment detail.',
        variant: 'destructive',
      });
    },
  });

  // Handlers for opening/closing the detail dialog
  const handleAddDetail = () => {
    setEditingDetail(undefined); 
    setIsDetailDialogOpen(true); 
  };

  const handleEditDetail = (detailToEdit: ShipmentDetail) => {
    setEditingDetail(detailToEdit);
    setIsDetailDialogOpen(true); 
  };

  const handleDeleteDetail = (detailId: string) => {
    // Confirmation dialog is built into ShipmentDetailCard
    deleteDetailMutation.mutate(detailId);
  };

  // Called when the dialog successfully saves a detail
  const handleDialogSuccess = () => {
    refetchDetails(); // Refetch details to update the list and totals
    setIsDetailDialogOpen(false); 
    setEditingDetail(undefined); 
  };

  // --- Calculation Logic ---
  const calculateTotals = (detailsList: ShipmentDetail[]) => {
    const pallets = detailsList.reduce((sum, d) => sum + (d.numberOfPallets || 0), 0);
    const bags = detailsList.reduce((sum, d) => sum + (d.numberOfBags || 0), 0);
    const grossWeight = detailsList.reduce((sum, d) => sum + (d.grossWeight || 0), 0);
    const tareWeight = detailsList.reduce((sum, d) => sum + (d.tareWeight || 0), 0);
    const netWeight = grossWeight - tareWeight; // Calculated Net Weight

    return {
      pallets,
      bags,
      grossWeight: parseFloat(grossWeight.toFixed(3)), // Format to 3 decimal places
      tareWeight: parseFloat(tareWeight.toFixed(3)),   // Format to 3 decimal places
      netWeight: parseFloat(netWeight.toFixed(3)),     // Format to 3 decimal places
    };
  };

  // Calculate overall totals using useMemo for efficiency
  const overallTotals = useMemo(() => calculateTotals(details), [details]);
  
  // Filter details for Asendia and others
  const asendiaDetails = useMemo(() => details.filter(d => d.customer?.toLowerCase() === ASENDIA_CUSTOMER_VALUE.toLowerCase()), [details]);
  const otherDetails = useMemo(() => details.filter(d => d.customer?.toLowerCase() !== ASENDIA_CUSTOMER_VALUE.toLowerCase()), [details]);

  // Calculate totals for Asendia and others
  const asendiaTotals = useMemo(() => calculateTotals(asendiaDetails), [asendiaDetails]);
  const otherTotals = useMemo(() => calculateTotals(otherDetails), [otherDetails]);
  // --- End Calculation Logic ---

  // --- Loading and Error States ---
  if (isLoadingShipment || (shipmentId && isLoadingDetails && !shipment)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-12 w-1/4 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (shipmentError || detailsError) {
    const error = shipmentError || detailsError;
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Shipment Data</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : "An unexpected error occurred."}
        </AlertDescription>
      </Alert>
    );
  }

  if (!shipment) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Shipment Not Found</AlertTitle>
        <AlertDescription>
          The requested shipment (ID: {shipmentId}) could not be found.
        </AlertDescription>
      </Alert>
    );
  }
  // --- End Loading and Error States ---

  return (
    <div className="space-y-6">
      {/* Main Shipment Information Card */}
      <Card className="shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Shipment: {shipment.carrier} - {shipment.driverName}</CardTitle>
          <CardDescription>
            ID: {shipment.id} | Status: <span className={`font-semibold ${shipment.status === 'Completed' ? 'text-accent' : 'text-orange-500'}`}>{shipment.status}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><p><strong>Subcarrier:</strong> {shipment.subcarrier}</p></div>
          <div><p><strong>Departure:</strong> <ClientFormattedDate date={shipment.departureDate} /></p></div>
          <div><p><strong>Arrival:</strong> <ClientFormattedDate date={shipment.arrivalDate} /></p></div>
          {shipment.sealNumber && <p><strong>Seal #:</strong> {shipment.sealNumber}</p>}
          {shipment.truckRegistration && <p><strong>Truck Reg:</strong> {shipment.truckRegistration}</p>}
          {shipment.trailerRegistration && <p><strong>Trailer Reg:</strong> {shipment.trailerRegistration}</p>}
          {shipment.senderAddress && <p className="col-span-1 md:col-span-2"><strong>Sender:</strong> {shipment.senderAddress}</p>}
          {shipment.consigneeAddress && <p className="col-span-1 md:col-span-2"><strong>Consignee:</strong> {shipment.consigneeAddress}</p>}
          <p><strong>Main Total Weight:</strong> {shipment.totalWeight ? `${shipment.totalWeight.toLocaleString()} kg` : 'N/A'}</p>
          <p><strong>Last Updated:</strong> <ClientFormattedDate date={shipment.lastUpdated} /></p>
        </CardContent>
      </Card>

      {/* Shipment Details Section */}
      <Card className="shadow-xl rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl flex items-center">
                <ListChecks className="mr-3 h-7 w-7 text-primary" /> Shipment Details
            </CardTitle>
            <CardDescription>Manage individual items and view calculated totals for this shipment.</CardDescription>
          </div>
          {/* Dialog Trigger Button */}
          <ShipmentDetailDialog
              shipmentId={shipmentId}
              detail={editingDetail}
              onSuccess={handleDialogSuccess}
              isOpen={isDetailDialogOpen} // Control dialog externally
              onOpenChange={setIsDetailDialogOpen} // Control dialog externally
          >
              <Button onClick={handleAddDetail}>
                  <PlusCircle className="mr-2 h-5 w-5" /> Add New Detail
              </Button>
          </ShipmentDetailDialog>
        </CardHeader>
        <CardContent>
            {/* --- Loading and Empty States for Details --- */}
            {isLoadingDetails && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Skeleton className="h-60 w-full rounded-lg" />
                    <Skeleton className="h-60 w-full rounded-lg" />
                    <Skeleton className="h-60 w-full rounded-lg" />
                </div>
            )}
            {!isLoadingDetails && detailsError && (
                 <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error Loading Details</AlertTitle>
                    <AlertDescription>{detailsError.message}</AlertDescription>
                </Alert>
            )}
            {!isLoadingDetails && !detailsError && details.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No details added to this shipment yet.</p>
            )}
             {/* --- End Loading and Empty States --- */}

            {/* --- Display Details and Totals --- */}
            {!isLoadingDetails && !detailsError && details.length > 0 && (
              <>
                {/* Overall Summary Card */}
                <div className="mb-6 p-4 bg-muted/50 rounded-lg shadow">
                  <h4 className="text-lg font-semibold text-foreground mb-3 flex items-center"><BarChart3 className="mr-2 h-5 w-5 text-primary" />Overall Details Summary</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-2 text-sm">
                    <p><strong>Total Pallets:</strong> {overallTotals.pallets}</p>
                    <p><strong>Total Bags:</strong> {overallTotals.bags}</p>
                    <p><strong>Total Gross Wt:</strong> {overallTotals.grossWeight.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</p>
                    <p><strong>Total Tare Wt:</strong> {overallTotals.tareWeight.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</p>
                    <p><strong>Total Net Wt:</strong> {overallTotals.netWeight.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</p>
                  </div>
                </div>

                {/* Split Totals Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Asendia Totals */}
                  <Card className="border-blue-200 shadow-md">
                    <CardHeader>
                      <CardTitle className="text-md flex items-center"><Users className="mr-2 h-5 w-5 text-blue-600"/>Asendia Customer Totals</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p><strong>Pallets:</strong> {asendiaTotals.pallets}</p>
                      <p><strong>Bags:</strong> {asendiaTotals.bags}</p>
                      <p><strong>Gross Wt:</strong> {asendiaTotals.grossWeight.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</p>
                      <p><strong>Tare Wt:</strong> {asendiaTotals.tareWeight.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</p>
                      <p><strong>Net Wt:</strong> {asendiaTotals.netWeight.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</p>
                    </CardContent>
                  </Card>
                  {/* Other Customers Totals */}
                  <Card className="border-gray-200 shadow-md">
                     <CardHeader>
                      <CardTitle className="text-md flex items-center"><Users className="mr-2 h-5 w-5 text-gray-600"/>Other Customers Totals</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p><strong>Pallets:</strong> {otherTotals.pallets}</p>
                      <p><strong>Bags:</strong> {otherTotals.bags}</p>
                      <p><strong>Gross Wt:</strong> {otherTotals.grossWeight.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</p>
                      <p><strong>Tare Wt:</strong> {otherTotals.tareWeight.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</p>
                      <p><strong>Net Wt:</strong> {otherTotals.netWeight.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</p>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Individual Detail Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {details.map(detail => (
                      <ShipmentDetailCard
                          key={detail.id}
                          detail={detail}
                          onEdit={handleEditDetail}
                          onDelete={handleDeleteDetail}
                          // Pass mutation loading state if needed for delete button disable
                          isDeleting={deleteDetailMutation.isPending && deleteDetailMutation.variables === detail.id}
                      />
                    ))}
                </div>
              </>
            )}
             {/* --- End Display Details and Totals --- */}
        </CardContent>
      </Card>
    </div>
  );
}


