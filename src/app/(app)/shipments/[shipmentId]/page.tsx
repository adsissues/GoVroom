
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

  const { data: shipment, isLoading: isLoadingShipment, error: shipmentError } = useQuery<Shipment | null>({
    queryKey: ['shipment', shipmentId],
    queryFn: () => getShipmentFromFirestore(shipmentId),
    enabled: !!shipmentId,
  });

  const { data: details = [], isLoading: isLoadingDetails, error: detailsError, refetch: refetchDetails } = useQuery<ShipmentDetail[]>({
    queryKey: ['shipmentDetails', shipmentId],
    queryFn: () => getShipmentDetailsFromFirestore(shipmentId),
    enabled: !!shipmentId,
  });

  const deleteDetailMutation = useMutation({
    mutationFn: (detailId: string) => deleteShipmentDetailFromFirestore(shipmentId, detailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipmentDetails', shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['shipment', shipmentId] }); // Invalidate parent to update total weight if applicable
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

  const handleAddDetail = () => {
    setEditingDetail(undefined); 
    setIsDetailDialogOpen(true); 
  };

  const handleEditDetail = (detailToEdit: ShipmentDetail) => {
    setEditingDetail(detailToEdit);
    setIsDetailDialogOpen(true); 
  };

  const handleDeleteDetail = (detailId: string) => {
    deleteDetailMutation.mutate(detailId);
  };

  const handleDialogSuccess = () => {
    refetchDetails(); 
    setIsDetailDialogOpen(false); 
    setEditingDetail(undefined); 
  };

  const calculateTotals = (detailsList: ShipmentDetail[]) => {
    return {
      pallets: detailsList.reduce((sum, d) => sum + (d.numberOfPallets || 0), 0),
      bags: detailsList.reduce((sum, d) => sum + (d.numberOfBags || 0), 0),
      grossWeight: detailsList.reduce((sum, d) => sum + (d.grossWeight || 0), 0),
      tareWeight: detailsList.reduce((sum, d) => sum + (d.tareWeight || 0), 0),
      netWeight: detailsList.reduce((sum, d) => sum + (d.grossWeight || 0), 0) - detailsList.reduce((sum, d) => sum + (d.tareWeight || 0), 0),
    };
  };

  const overallTotals = useMemo(() => calculateTotals(details), [details]);
  
  const asendiaDetails = useMemo(() => details.filter(d => d.customer?.toLowerCase() === ASENDIA_CUSTOMER_VALUE.toLowerCase()), [details]);
  const otherDetails = useMemo(() => details.filter(d => d.customer?.toLowerCase() !== ASENDIA_CUSTOMER_VALUE.toLowerCase()), [details]);

  const asendiaTotals = useMemo(() => calculateTotals(asendiaDetails), [asendiaDetails]);
  const otherTotals = useMemo(() => calculateTotals(otherDetails), [otherDetails]);


  if (isLoadingShipment || (shipmentId && isLoadingDetails && !shipment)) {
    return (
      <div className="space-y-6">
        Skeleton className="h-48 w-full rounded-xl" />
        Skeleton className="h-12 w-1/4 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            Skeleton className="h-64 w-full rounded-xl" />
            Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (shipmentError || detailsError) {
    const error = shipmentError || detailsError;
    return (
      Alert variant="destructive">
        AlertTriangle className="h-4 w-4" />
        AlertTitle>Error Loading Shipment DataAlertTitle>
        AlertDescription>
          {error instanceof Error ? error.message : "An unexpected error occurred."}
        AlertDescription>
      Alert>
    );
  }

  if (!shipment) {
    return (
      Alert variant="destructive">
        AlertTriangle className="h-4 w-4" />
        AlertTitle>Shipment Not FoundAlertTitle>
        AlertDescription>
          The requested shipment (ID: {shipmentId}) could not be found.
        AlertDescription>
      Alert>
    );
  }

  return (
    div className="space-y-6">
      Card className="shadow-xl rounded-xl">
        CardHeader>
          CardTitle className="text-2xl">Shipment: {shipment.carrier} - {shipment.driverName}CardTitle>
          CardDescription>
            ID: {shipment.id} | Status: <span className={`font-semibold ${shipment.status === 'Completed' ? 'text-accent' : 'text-orange-500'}`}>{shipment.status}span>
          CardDescription>
        CardHeader>
        CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><p><strong>Subcarrier:strong> {shipment.subcarrier}p>div>
          <div><p><strong>Departure:strong> <ClientFormattedDate date={shipment.departureDate} />p>div>
          <div><p><strong>Arrival:strong> <ClientFormattedDate date={shipment.arrivalDate} />p>div>
          {shipment.sealNumber && <p><strong>Seal #:strong> {shipment.sealNumber}p>}
          {shipment.truckRegistration && <p><strong>Truck Reg:strong> {shipment.truckRegistration}p>}
          {shipment.trailerRegistration && <p><strong>Trailer Reg:strong> {shipment.trailerRegistration}p>}
          {shipment.senderAddress && <p className="col-span-1 md:col-span-2"><strong>Sender:strong> {shipment.senderAddress}p>}
          {shipment.consigneeAddress && <p className="col-span-1 md:col-span-2"><strong>Consignee:strong> {shipment.consigneeAddress}p>}
           <p><strong>Main Total Weight:strong> {shipment.totalWeight ? `${shipment.totalWeight.toLocaleString()} kg` : 'N/A'}p>
           <p><strong>Last Updated:strong> <ClientFormattedDate date={shipment.lastUpdated} />p>
        CardContent>
      Card>

      Card className="shadow-xl rounded-xl">
        CardHeader className="flex flex-row items-center justify-between">
          div className="space-y-1">
            CardTitle className="text-2xl flex items-center">
                ListChecks className="mr-3 h-7 w-7 text-primary" /> Shipment Details
            CardTitle>
            CardDescription>Manage individual items within this shipment.CardDescription>
          div>
            ShipmentDetailDialog
                shipmentId={shipmentId}
                detail={editingDetail}
                onSuccess={handleDialogSuccess}
                isOpen={isDetailDialogOpen} // Control dialog externally
                onOpenChange={setIsDetailDialogOpen} // Control dialog externally
            >
                Button onClick={handleAddDetail}>
                    PlusCircle className="mr-2 h-5 w-5" /> Add New Detail
                Button>
            ShipmentDetailDialog>
        CardHeader>
        CardContent>
            {isLoadingDetails && (
                div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    Skeleton className="h-60 w-full rounded-lg" />
                    Skeleton className="h-60 w-full rounded-lg" />
                div>
            )}
            {!isLoadingDetails && detailsError && (
                 Alert variant="destructive">
                    AlertTriangle className="h-4 w-4" />
                    AlertTitle>Error Loading DetailsAlertTitle>
                    AlertDescription>{detailsError.message}AlertDescription>
                Alert>
            )}
            {!isLoadingDetails && !detailsError && details.length === 0 && (
                p className="text-center text-muted-foreground py-8">No details added to this shipment yet.p>
            )}
            {!isLoadingDetails && !detailsError && details.length > 0 && (
              <>
                div className="mb-6 p-4 bg-muted/50 rounded-lg shadow">
                  h4 className="text-lg font-semibold text-foreground mb-3 flex items-center">BarChart3 className="mr-2 h-5 w-5 text-primary" />Overall Details Summaryh4>
                  div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-2 text-sm">
                    <p><strong>Total Pallets:strong> {overallTotals.pallets}p>
                    <p><strong>Total Bags:strong> {overallTotals.bags}p>
                    <p><strong>Total Gross Wt:strong> {overallTotals.grossWeight.toFixed(2)} kgp>
                    <p><strong>Total Tare Wt:strong> {overallTotals.tareWeight.toFixed(2)} kgp>
                    <p><strong>Total Net Wt:strong> {overallTotals.netWeight.toFixed(2)} kgp>
                  div>
                div>

                div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  Card className="border-blue-200 shadow-md">
                    CardHeader>
                      CardTitle className="text-md flex items-center">Users className="mr-2 h-5 w-5 text-blue-600"/>Asendia Customer TotalsCardTitle>
                    CardHeader>
                    CardContent className="text-sm space-y-1">
                      <p><strong>Pallets:strong> {asendiaTotals.pallets}p>
                      <p><strong>Bags:strong> {asendiaTotals.bags}p>
                      <p><strong>Gross Wt:strong> {asendiaTotals.grossWeight.toFixed(2)} kgp>
                      <p><strong>Tare Wt:strong> {asendiaTotals.tareWeight.toFixed(2)} kgp>
                      <p><strong>Net Wt:strong> {asendiaTotals.netWeight.toFixed(2)} kgp>
                    CardContent>
                  Card>
                  Card className="border-gray-200 shadow-md">
                     CardHeader>
                      CardTitle className="text-md flex items-center">Users className="mr-2 h-5 w-5 text-gray-600"/>Other Customers TotalsCardTitle>
                    CardHeader>
                    CardContent className="text-sm space-y-1">
                      <p><strong>Pallets:strong> {otherTotals.pallets}p>
                      <p><strong>Bags:strong> {otherTotals.bags}p>
                      <p><strong>Gross Wt:strong> {otherTotals.grossWeight.toFixed(2)} kgp>
                      <p><strong>Tare Wt:strong> {otherTotals.tareWeight.toFixed(2)} kgp>
                      <p><strong>Net Wt:strong> {otherTotals.netWeight.toFixed(2)} kgp>
                    CardContent>
                  Card>
                div>
                
                div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {details.map(detail => (
                    ShipmentDetailCard
                        key={detail.id}
                        detail={detail}
                        onEdit={handleEditDetail}
                        onDelete={handleDeleteDetail}
                    />
                    ))}
                div>
              >
            )}
        CardContent>
      Card>
    div>
  );
}
