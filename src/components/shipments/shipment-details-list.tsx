
"use client";

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
    addShipmentDetail,
    updateShipmentDetail,
    deleteShipmentDetail,
    detailFromFirestore,
} from '@/lib/firebase/shipmentsService';
import type { ShipmentDetail, ShipmentStatus, DropdownItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import ShipmentDetailForm from './shipment-detail-form';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { getDropdownOptionsMap } from '@/lib/firebase/dropdownService';
import { SERVICE_FORMAT_MAPPING } from '@/lib/constants';
import { useQuery } from '@tanstack/react-query';


interface ShipmentDetailsListProps {
  shipmentId: string;
  parentStatus: ShipmentStatus;
}

const fetchAllDropdownMaps = async () => {
    const allFormatCollections = Object.values(SERVICE_FORMAT_MAPPING).filter(Boolean) as string[];
    const uniqueCollectionNames = [...new Set(['customers', 'services', 'doe', ...allFormatCollections])];
    return getDropdownOptionsMap(uniqueCollectionNames);
};


export default function ShipmentDetailsList({ shipmentId, parentStatus }: ShipmentDetailsListProps) {
  const [details, setDetails] = useState<ShipmentDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDetail, setEditingDetail] = useState<ShipmentDetail | null>(null);
  const { toast } = useToast();

  const isParentCompleted = parentStatus === 'Completed';
  console.log(`[ShipmentDetailsList DEBUG] Component Render/Re-render. shipmentId: ${shipmentId}, parentStatus: ${parentStatus}, isParentCompleted: ${isParentCompleted}, current details.length: ${details.length}`);


   const { data: dropdownMaps = {}, isLoading: isLoadingLabels, error: errorLabels } = useQuery({
       queryKey: ['dropdownMaps'],
       queryFn: fetchAllDropdownMaps,
       staleTime: 15 * 60 * 1000,
       gcTime: 30 * 60 * 1000,
   });

  useEffect(() => {
    if (errorLabels) {
         console.error("Error fetching dropdown labels:", errorLabels);
         toast({
             variant: "destructive",
             title: "Error Loading Dropdown Labels",
             description: "Some labels might not display correctly."
         });
    }
  }, [errorLabels, toast]);


  useEffect(() => {
    if (!shipmentId) {
        setError("Shipment ID not provided.");
        setIsLoading(false);
        console.error("ShipmentDetailsList: shipmentId is missing.");
        return;
    }
    console.log(`[ShipmentDetailsList] Effect: Setting up listener for shipment ${shipmentId}`);
    setIsLoading(true);
    setError(null);

    const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');
    const q = query(detailsCollectionRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        console.log(`[ShipmentDetailsList] Snapshot received: ${snapshot.docs.length} details for shipment ${shipmentId}`);
        const fetchedDetails: ShipmentDetail[] = snapshot.docs.map(doc => detailFromFirestore(doc as QueryDocumentSnapshot<DocumentData>));
        setDetails(fetchedDetails);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`Error fetching shipment details for ${shipmentId}:`, err);
        setError("Failed to load shipment items. Please try again later.");
        setIsLoading(false);
      }
    );

    return () => {
        console.log(`[ShipmentDetailsList] Effect Cleanup: Cleaning up listener for shipment ${shipmentId}`);
        unsubscribe();
    };
  }, [shipmentId]);


  const handleAddDetail = () => {
    console.log(`[ShipmentDetailsList] handleAddDetail called. isParentCompleted: ${isParentCompleted}`);
    if (isParentCompleted) {
         toast({ variant: "destructive", title: "Action Denied", description: "Cannot add items to a completed shipment." });
         return;
     }
    setEditingDetail(null);
    setIsFormOpen(true);
  };

  const handleEditDetail = (detail: ShipmentDetail) => {
    console.log(`[ShipmentDetailsList] handleEditDetail called for detail ID: ${detail.id}. isParentCompleted: ${isParentCompleted}`);
     if (isParentCompleted) {
          toast({ variant: "destructive", title: "Action Denied", description: "Cannot edit items in a completed shipment." });
         return;
     }
    setEditingDetail(detail);
    setIsFormOpen(true);
  };

  const handleSaveDetail = async (data: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated'>) => {
    console.log(`[ShipmentDetailsList] handleSaveDetail called. isParentCompleted: ${isParentCompleted}. Editing detail ID: ${editingDetail?.id}`);
    if (isParentCompleted) {
        toast({ variant: "destructive", title: "Cannot Save", description: "Shipment is already completed." });
        setIsFormOpen(false);
        return;
    }

    try {
        let action: Promise<any>;
        if (editingDetail) {
            console.log(`[ShipmentDetailsList] Saving existing detail ${editingDetail.id} for shipment ${shipmentId}`);
            action = updateShipmentDetail(shipmentId, editingDetail.id, data);
        } else {
            console.log(`[ShipmentDetailsList] Adding new detail for shipment ${shipmentId}`);
            action = addShipmentDetail(shipmentId, data);
        }

         await action;

         toast({ title: editingDetail ? "Detail Updated" : "Detail Added", description: "Shipment item saved successfully." });
         setIsFormOpen(false);

    } catch (error) {
        console.error("[ShipmentDetailsList] Error saving shipment detail:", error);
        toast({ variant: "destructive", title: "Save Failed", description: error instanceof Error ? error.message : "Could not save item." });
    }
  };

  const handleDeleteDetail = async (detailId: string) => {
     console.log(`[ShipmentDetailsList] handleDeleteDetail called for detail ID: ${detailId}. isParentCompleted: ${isParentCompleted}, details.length: ${details.length}`);
     if (isParentCompleted) {
        toast({ variant: "destructive", title: "Cannot Delete", description: "Cannot delete items from a completed shipment." });
        return;
     }

     // Removed the check that prevents deleting the last item
     // if (details.length <= 1) {
     //    toast({ variant: "destructive", title: "Deletion Prevented", description: "Cannot delete the last item of a shipment." });
     //    return;
     // }

     console.log(`[ShipmentDetailsList] Attempting to delete detail ${detailId} from shipment ${shipmentId}`);
     try {
         await deleteShipmentDetail(shipmentId, detailId);
         toast({ title: "Detail Deleted", description: "Shipment item removed successfully." });
     } catch (error) {
         console.error("[ShipmentDetailsList] Error deleting shipment detail:", error);
         toast({ variant: "destructive", title: "Deletion Failed", description: error instanceof Error ? error.message : "Could not remove item." });
     }
  };


  const getLabel = (collectionId: string, value: string | undefined): string => {
      if (!value) return 'N/A';
      if (isLoadingLabels) return 'Loading...';
      return dropdownMaps[collectionId]?.[value] || value;
  };

   const getFormatLabel = (serviceId: string | undefined, formatId: string | undefined): string => {
       if (!serviceId || !formatId) return 'N/A';
       const serviceKey = serviceId.toLowerCase();
       const formatCollectionId = SERVICE_FORMAT_MAPPING[serviceKey];
       if (!formatCollectionId) return formatId;
       return getLabel(formatCollectionId, formatId);
   };


  return (
    <Card className="shadow-lg rounded-xl border">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
            <CardTitle>Shipment Items</CardTitle>
            <CardDescription>Items included in this shipment.</CardDescription>
        </div>
        {!isParentCompleted && (
          <Button onClick={handleAddDetail} size="sm" disabled={isParentCompleted || isLoading}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Item
          </Button>
        )}
         {isParentCompleted && (
            <p className="text-sm text-muted-foreground italic">Shipment completed. Items locked.</p>
         )}
      </CardHeader>
      <CardContent>
        {isLoading && (
           <div className="space-y-2 py-4">
               <Skeleton className="h-10 w-full rounded" />
               <Skeleton className="h-10 w-full rounded" />
               <Skeleton className="h-10 w-full rounded" />
           </div>
        )}

        {error && !isLoading && (
          <Alert variant="destructive" className="my-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Items</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && details.length === 0 && (
          <p className="text-center text-muted-foreground py-6">No items have been added to this shipment yet.</p>
        )}

        {!isLoading && !error && details.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead className="text-center">Pallets</TableHead>
                  <TableHead className="text-center">Bags</TableHead>
                  <TableHead className="text-right">Gross (kg)</TableHead>
                  <TableHead className="text-right">Tare (kg)</TableHead>
                  <TableHead className="text-right font-semibold">Net (kg)</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.map((detail) => {
                  // Only disable delete if parent shipment is completed
                  const isDeleteDisabled = isParentCompleted;
                  console.log(`[ShipmentDetailsList DEBUG] Rendering detail ID: ${detail.id}. parentStatus: ${parentStatus}, isParentCompleted: ${isParentCompleted}, details.length: ${details.length}, isDeleteDisabled: ${isDeleteDisabled}`);
                  return (
                    <TableRow key={detail.id} className="hover:bg-muted/50">
                      <TableCell>{getLabel('customers', detail.customerId)}</TableCell>
                      <TableCell>{getLabel('services', detail.serviceId)}</TableCell>
                      <TableCell>{getFormatLabel(detail.serviceId, detail.formatId)}</TableCell>
                      <TableCell className="text-center">{detail.numPallets}</TableCell>
                      <TableCell className="text-center">{detail.numBags}</TableCell>
                      <TableCell className="text-right font-mono">{detail.grossWeight?.toFixed(3) ?? '0.000'}</TableCell>
                      <TableCell className="text-right font-mono">{detail.tareWeight?.toFixed(3) ?? '0.000'}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{detail.netWeight?.toFixed(3) ?? '0.000'}</TableCell>
                      <TableCell className="text-right">
                        {!isParentCompleted && (
                           <div className="flex justify-end space-x-1">
                             <Button variant="ghost" size="icon" onClick={() => handleEditDetail(detail)} title="Edit Item" disabled={isParentCompleted}>
                               <Edit className="h-4 w-4" />
                               <span className="sr-only">Edit</span>
                             </Button>
                              <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                      <Button
                                          variant="ghost"
                                          size="icon"
                                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                          title="Delete Item"
                                          disabled={isDeleteDisabled}
                                      >
                                          <Trash2 className="h-4 w-4" />
                                          <span className="sr-only">Delete</span>
                                      </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                      <AlertDialogHeader>
                                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                              This action cannot be undone. This will permanently delete this shipment item.
                                          </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                              onClick={() => handleDeleteDetail(detail.id)}
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                              Delete Item
                                          </AlertDialogAction>
                                      </AlertDialogFooter>
                                  </AlertDialogContent>
                              </AlertDialog>
                           </div>
                        )}
                        {isParentCompleted && (
                            <span className="text-xs text-muted-foreground italic flex justify-end items-center h-full pr-2">Locked</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <ShipmentDetailForm
            shipmentId={shipmentId}
            detail={editingDetail}
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            onSave={handleSaveDetail}
       />
    </Card>
  );
}
