
"use client";

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  Timestamp,
  writeBatch,
  getDoc,
  where,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
    addShipmentDetail,
    updateShipmentDetail,
    deleteShipmentDetail,
    detailFromFirestore, // Use helper for conversion
    recalculateShipmentTotals // Ensure this is called appropriately
} from '@/lib/firebase/shipmentsService';
import type { ShipmentDetail, ShipmentStatus, DropdownItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import ShipmentDetailForm from './shipment-detail-form'; // Import the form modal
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
import { getDropdownOptionsMap } from '@/lib/firebase/dropdownService'; // Helper to get maps
import { SERVICE_FORMAT_MAPPING } from '@/lib/constants';
import { useQuery } from '@tanstack/react-query'; // For caching dropdown labels


interface ShipmentDetailsListProps {
  shipmentId: string;
  parentStatus: ShipmentStatus; // To disable adding/editing when parent is Completed
}

// Fetch function for TanStack Query
const fetchAllDropdownMaps = async () => {
    const allFormatCollections = Object.values(SERVICE_FORMAT_MAPPING);
    // Ensure no duplicate collection names are passed
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

   // Fetch Dropdown Labels for Display using TanStack Query
   const { data: dropdownMaps = {}, isLoading: isLoadingLabels, error: errorLabels } = useQuery({
       queryKey: ['dropdownMaps'], // Unique key for all maps
       queryFn: fetchAllDropdownMaps,
       staleTime: 15 * 60 * 1000, // Cache for 15 minutes
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


  // Fetch Shipment Details in Real-time
  useEffect(() => {
    if (!shipmentId) {
        setError("Shipment ID not provided.");
        setIsLoading(false);
        console.error("ShipmentDetailsList: shipmentId is missing.");
        return;
    }
    console.log(`ShipmentDetailsList: Setting up listener for shipment ${shipmentId}`);
    setIsLoading(true);
    setError(null);

    const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');
    // Order by creation time by default
    const q = query(detailsCollectionRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        console.log(`ShipmentDetailsList: Received ${snapshot.docs.length} details for shipment ${shipmentId}`);
        const fetchedDetails: ShipmentDetail[] = snapshot.docs.map(doc => detailFromFirestore(doc as QueryDocumentSnapshot<DocumentData>));
        setDetails(fetchedDetails);
        setIsLoading(false);
        setError(null); // Clear previous errors on successful fetch
      },
      (err) => {
        console.error(`Error fetching shipment details for ${shipmentId}:`, err);
        setError("Failed to load shipment items. Please try again later.");
        setIsLoading(false);
      }
    );

    // Cleanup listener on component unmount or when shipmentId changes
    return () => {
        console.log(`ShipmentDetailsList: Cleaning up listener for shipment ${shipmentId}`);
        unsubscribe();
    };
  }, [shipmentId]); // Re-run effect if shipmentId changes

  // --- Event Handlers ---

  const handleAddDetail = () => {
    if (isParentCompleted) {
         toast({ variant: "destructive", title: "Action Denied", description: "Cannot add items to a completed shipment." });
         return;
     }
    setEditingDetail(null); // Ensure we are in "add" mode
    setIsFormOpen(true);
  };

  const handleEditDetail = (detail: ShipmentDetail) => {
     if (isParentCompleted) {
          toast({ variant: "destructive", title: "Action Denied", description: "Cannot edit items in a completed shipment." });
         return;
     }
    setEditingDetail(detail);
    setIsFormOpen(true);
  };

  const handleSaveDetail = async (data: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated'>) => {
    // Double-check completion status before saving
    if (isParentCompleted) {
        toast({ variant: "destructive", title: "Cannot Save", description: "Shipment is already completed." });
        setIsFormOpen(false); // Close form even if save fails due to status
        return;
    }

    // The netWeight calculation is handled within the service functions (add/update)
    // or by the detailFromFirestore helper, no need to recalculate here unless specifically overriding.

    try {
        let action: Promise<any>;
        if (editingDetail) {
            console.log(`Saving existing detail ${editingDetail.id} for shipment ${shipmentId}`);
            // Update existing detail
            action = updateShipmentDetail(shipmentId, editingDetail.id, data);
        } else {
            console.log(`Adding new detail for shipment ${shipmentId}`);
            // Add new detail
            action = addShipmentDetail(shipmentId, data);
        }

         await action; // Wait for add or update to complete

         toast({ title: editingDetail ? "Detail Updated" : "Detail Added", description: "Shipment item saved successfully." });
         setIsFormOpen(false); // Close the form modal
         // No need to call recalculateShipmentTotals here, it's called within add/updateShipmentDetail

    } catch (error) {
        console.error("Error saving shipment detail:", error);
        toast({ variant: "destructive", title: "Save Failed", description: error instanceof Error ? error.message : "Could not save item." });
        // Keep the form open on error? Or close? Decide based on UX preference.
        // setIsFormOpen(false);
    }
    // No finally block needed here, loading state is handled by the form itself
  };

  const handleDeleteDetail = async (detailId: string) => {
     // Double-check completion status
     if (isParentCompleted) {
        toast({ variant: "destructive", title: "Cannot Delete", description: "Cannot delete items from a completed shipment." });
        return;
     }

     // Prevent deletion of the last item (Business Rule)
     if (details.length <= 1) {
        toast({ variant: "destructive", title: "Deletion Prevented", description: "Cannot delete the last item of a shipment." });
        return;
     }

     console.log(`Attempting to delete detail ${detailId} from shipment ${shipmentId}`);
     try {
         await deleteShipmentDetail(shipmentId, detailId);
         toast({ title: "Detail Deleted", description: "Shipment item removed successfully." });
         // No need to call recalculateShipmentTotals here, it's called within deleteShipmentDetail
     } catch (error) {
         console.error("Error deleting shipment detail:", error);
         toast({ variant: "destructive", title: "Deletion Failed", description: error instanceof Error ? error.message : "Could not remove item." });
     }
  };

  // --- Helper Functions for Display ---
  const getLabel = (collectionId: string, value: string | undefined): string => {
      if (!value) return 'N/A';
      if (isLoadingLabels) return 'Loading...'; // Show loading state for labels
      return dropdownMaps[collectionId]?.[value] || value; // Return value itself if label not found
  };

   const getFormatLabel = (serviceId: string | undefined, formatId: string | undefined): string => {
       if (!serviceId || !formatId) return 'N/A';
       const formatCollectionId = SERVICE_FORMAT_MAPPING[serviceId];
       if (!formatCollectionId) return formatId; // Return raw value if no mapping
       return getLabel(formatCollectionId, formatId);
   };


  // --- Render Logic ---
  return (
    <Card className="shadow-lg rounded-xl border">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
            <CardTitle>Shipment Items</CardTitle>
            <CardDescription>Items included in this shipment.</CardDescription>
        </div>
        {/* Add Item Button */}
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
        {/* Loading State */}
        {isLoading && (
           <div className="space-y-2 py-4">
               <Skeleton className="h-10 w-full rounded" />
               <Skeleton className="h-10 w-full rounded" />
               <Skeleton className="h-10 w-full rounded" />
           </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <Alert variant="destructive" className="my-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Items</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Empty State */}
        {!isLoading && !error && details.length === 0 && (
          <p className="text-center text-muted-foreground py-6">No items have been added to this shipment yet.</p>
        )}

        {/* Table Display */}
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
                {details.map((detail) => (
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
                           {/* Edit Button */}
                           <Button variant="ghost" size="icon" onClick={() => handleEditDetail(detail)} title="Edit Item" disabled={isParentCompleted}>
                             <Edit className="h-4 w-4" />
                             <span className="sr-only">Edit</span>
                           </Button>
                           {/* Delete Button */}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        title="Delete Item"
                                        disabled={isParentCompleted || details.length <= 1} // Disable delete if completed or last item
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
                       {/* Show 'Locked' text if completed */}
                      {isParentCompleted && (
                          <span className="text-xs text-muted-foreground italic flex justify-end items-center h-full pr-2">Locked</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Form Modal */}
      {/* Render the modal conditionally using its isOpen prop */}
      <ShipmentDetailForm
            shipmentId={shipmentId} // Always pass shipmentId
            detail={editingDetail} // Pass detail being edited, or null for adding
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)} // Handler to close the modal
            onSave={handleSaveDetail} // Handler for saving data
       />
    </Card>
  );
}
