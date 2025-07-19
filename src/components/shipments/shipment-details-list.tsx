
"use client";

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  type Timestamp,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
    addShipmentDetail,
    updateShipmentDetail,
    deleteShipmentDetail,
    deleteShipmentDetailsBatch, // New import
    detailFromFirestore,
} from '@/lib/firebase/shipmentsService';
import type { ShipmentDetail, ShipmentStatus, DropdownItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox"; // New import
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, Trash2, AlertTriangle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
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
import { useQuery, useQueryClient } from '@tanstack/react-query'; // Added useQueryClient
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const ShipmentDetailForm = dynamic(() => import('./shipment-detail-form'), {
  loading: () => <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Loading form...</div>,
  ssr: false
});

interface ShipmentDetailsListProps {
  shipmentId: string;
  parentStatus: ShipmentStatus;
}

const fetchAllDropdownMaps = async () => {
    const allFormatCollections = Object.values(SERVICE_FORMAT_MAPPING).filter(Boolean) as string[];
    const uniqueCollectionNames = [...new Set(['customers', 'services', 'doe', ...allFormatCollections])];
    return getDropdownOptionsMap(uniqueCollectionNames);
};

const ITEMS_TO_SHOW_INITIALLY = 5;

export default function ShipmentDetailsList({ shipmentId, parentStatus }: ShipmentDetailsListProps) {
  const [details, setDetails] = useState<ShipmentDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDetail, setEditingDetail] = useState<ShipmentDetail | null>(null);
  const [showAllItems, setShowAllItems] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient(); // For query invalidation

  const [selectedDetails, setSelectedDetails] = useState<Record<string, boolean>>({});

  const isParentCompleted = parentStatus === 'Completed';

   const { data: dropdownMaps = {}, isLoading: isLoadingLabels, error: errorLabels } = useQuery({
       queryKey: ['dropdownMapsForAllDetails'],
       queryFn: fetchAllDropdownMaps,
       staleTime: 15 * 60 * 1000,
       gcTime: 30 * 60 * 1000,
   });

  useEffect(() => {
    if (errorLabels) {
         console.error("Error fetching dropdown labels for details list:", errorLabels);
         toast({
             variant: "destructive",
             title: "Error Loading Dropdown Labels",
             description: "Some item labels might not display correctly."
         });
    }
  }, [errorLabels, toast]);

  useEffect(() => {
    if (!shipmentId) {
        setError("Shipment ID not provided for details list.");
        setIsLoading(false);
        console.error("[ShipmentDetailsList DEBUG] shipmentId is missing.");
        return;
    }
    // console.log(`[ShipmentDetailsList DEBUG] Effect: Setting up listener for shipment ${shipmentId}`);
    setIsLoading(true);
    setError(null);

    const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');
    const q = query(detailsCollectionRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        // console.log(`[ShipmentDetailsList DEBUG] Snapshot received: ${snapshot.docs.length} details for shipment ${shipmentId}`);
        const fetchedDetails: ShipmentDetail[] = snapshot.docs.map(doc => detailFromFirestore(doc as QueryDocumentSnapshot<DocumentData>));
        setDetails(fetchedDetails);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`[ShipmentDetailsList DEBUG] Error fetching shipment details for ${shipmentId}:`, err);
        setError("Failed to load shipment items. Please try again later.");
        setIsLoading(false);
      }
    );

    return () => {
        // console.log(`[ShipmentDetailsList DEBUG] Effect Cleanup: Cleaning up listener for shipment ${shipmentId}`);
        unsubscribe();
    };
  }, [shipmentId]);

  const displayedDetails = useMemo(() => {
    if (showAllItems) {
      return details;
    }
    return details.slice(0, ITEMS_TO_SHOW_INITIALLY);
  }, [details, showAllItems]);

  const handleAddDetail = () => {
    if (isParentCompleted) {
         toast({ variant: "destructive", title: "Action Denied", description: "Cannot add items to a completed shipment." });
         return;
     }
    setEditingDetail(null);
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
    if (isParentCompleted) {
        toast({ variant: "destructive", title: "Cannot Save", description: "Shipment is already completed." });
        setIsFormOpen(false);
        return;
    }
    try {
        let action: Promise<any>;
        if (editingDetail) {
            action = updateShipmentDetail(shipmentId, editingDetail.id, data);
        } else {
            action = addShipmentDetail(shipmentId, data);
        }
         await action;
         toast({ title: editingDetail ? "Detail Updated" : "Detail Added", description: "Shipment item saved successfully." });
         setIsFormOpen(true); // Keep form open to allow adding multiple items
         // Invalidate queries related to shipment totals if necessary
         queryClient.invalidateQueries({ queryKey: ['shipment', shipmentId] });
    } catch (error) {
        console.error("[ShipmentDetailsList DEBUG] Error saving shipment detail:", error);
        toast({ variant: "destructive", title: "Save Failed", description: error instanceof Error ? error.message : "Could not save item." });
    }
  };

  const handleDeleteDetail = async (detailId: string) => {
     if (isParentCompleted) {
        toast({ variant: "destructive", title: "Cannot Delete", description: "Cannot delete items from a completed shipment." });
        return;
     }
     try {
         await deleteShipmentDetail(shipmentId, detailId);
         toast({ title: "Detail Deleted", description: "Shipment item removed successfully." });
         queryClient.invalidateQueries({ queryKey: ['shipment', shipmentId] });
     } catch (error) {
         console.error("[ShipmentDetailsList DEBUG] Error deleting shipment detail:", error);
         toast({ variant: "destructive", title: "Deletion Failed", description: error instanceof Error ? error.message : "Could not remove item." });
     }
  };

  const handleBatchDelete = async () => {
    if (isParentCompleted) {
        toast({ variant: "destructive", title: "Cannot Delete", description: "Cannot delete items from a completed shipment." });
        return;
    }
    const idsToDelete = Object.entries(selectedDetails)
        .filter(([, isSelected]) => isSelected)
        .map(([id]) => id);

    if (idsToDelete.length === 0) {
        toast({ title: "No Items Selected", description: "Please select items to delete." });
        return;
    }

    try {
        await deleteShipmentDetailsBatch(shipmentId, idsToDelete);
        toast({ title: "Items Deleted", description: `${idsToDelete.length} item(s) removed successfully.` });
        setSelectedDetails({}); // Clear selection
        queryClient.invalidateQueries({ queryKey: ['shipment', shipmentId] });
    } catch (error) {
        console.error("[ShipmentDetailsList DEBUG] Error batch deleting shipment details:", error);
        toast({ variant: "destructive", title: "Batch Deletion Failed", description: error instanceof Error ? error.message : "Could not remove items." });
    }
  };


  const getLabel = (collectionId: string, value: string | undefined): string => {
      if (!value) return 'N/A';
      if (isLoadingLabels) return 'Loading...';
      return dropdownMaps[collectionId]?.[value] || value;
  };

   const getFormatLabel = (serviceId: string | undefined, formatId: string | undefined): string => {
       if (!serviceId || !formatId) return 'N/A';
       if (isLoadingLabels) return 'Loading...';
       const serviceKey = serviceId.toLowerCase();
       const formatCollectionId = SERVICE_FORMAT_MAPPING[serviceKey];
       if (!formatCollectionId) return formatId;
       return dropdownMaps[formatCollectionId]?.[formatId] || formatId;
   };

  const numSelected = Object.values(selectedDetails).filter(Boolean).length;
  const isAllSelected = details.length > 0 && numSelected === details.length;
  const isIndeterminate = numSelected > 0 && numSelected < details.length;

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    const newSelectedDetails: Record<string, boolean> = {};
    if (checked === true) {
      details.forEach(detail => newSelectedDetails[detail.id] = true);
    }
    setSelectedDetails(newSelectedDetails);
  };


  return (
    <Card className="shadow-lg rounded-xl border">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
            <CardTitle>Shipment Items</CardTitle>
            <CardDescription>
              {details.length} item(s) total. {displayedDetails.length < details.length ? `Showing first ${ITEMS_TO_SHOW_INITIALLY}.` : (details.length > 0 ? 'Showing all items.' : '')}
            </CardDescription>
        </div>
        <div className="flex gap-2">
            {numSelected > 0 && !isParentCompleted && (
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({numSelected})
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Selected Items?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete {numSelected} selected items? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleBatchDelete} className="bg-destructive hover:bg-destructive/90">
                                Delete Selected
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
            {!isParentCompleted && (
            <Button onClick={handleAddDetail} size="sm" disabled={isParentCompleted || isLoading}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Item
            </Button>
            )}
        </div>
         {isParentCompleted && !isLoading && (
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
                  <TableHead className="w-[50px]">
                    <Checkbox
                        checked={isAllSelected ? true : (isIndeterminate ? "indeterminate" : false)}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all items"
                        disabled={isParentCompleted}
                    />
                  </TableHead>
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
                {displayedDetails.map((detail) => {
                  const isDeleteDisabled = isParentCompleted;
                  return (
                    <TableRow key={detail.id} data-state={selectedDetails[detail.id] ? "selected" : ""}>
                      <TableCell>
                        <Checkbox
                            checked={selectedDetails[detail.id] || false}
                            onCheckedChange={(checked) => {
                                setSelectedDetails(prev => ({...prev, [detail.id]: checked === true}));
                            }}
                            aria-label={`Select item ${detail.id}`}
                            disabled={isParentCompleted}
                        />
                      </TableCell>
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
        {!isLoading && !error && details.length > ITEMS_TO_SHOW_INITIALLY && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={() => setShowAllItems(prev => !prev)}>
              {showAllItems ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
              {showAllItems ? 'Show Less Items' : `View All ${details.length} Items`}
            </Button>
          </div>
        )}
      </CardContent>

      {isFormOpen && (
        <ShipmentDetailForm
              shipmentId={shipmentId}
              detail={editingDetail}
              isOpen={isFormOpen}
              onClose={() => setIsFormOpen(false)}
              onSave={handleSaveDetail}
              onOpen={() => setIsFormOpen(true)}
        />
      )}
    </Card>
  );
}