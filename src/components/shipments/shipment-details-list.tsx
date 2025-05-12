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
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { addShipmentDetail, updateShipmentDetail, deleteShipmentDetail, recalculateShipmentTotals, detailFromFirestore } from '@/lib/firebase/shipmentsService';
import type { ShipmentDetail, ShipmentStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, Trash2, AlertTriangle } from 'lucide-react';
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

interface ShipmentDetailsListProps {
  shipmentId: string;
  parentStatus: ShipmentStatus; // To disable adding/editing when parent is Completed
}

export default function ShipmentDetailsList({ shipmentId, parentStatus }: ShipmentDetailsListProps) {
  const [details, setDetails] = useState<ShipmentDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDetail, setEditingDetail] = useState<ShipmentDetail | null>(null);
  const [dropdownMaps, setDropdownMaps] = useState<Record<string, Record<string, string>>>({}); // Store maps for labels { collectionId: { value: label } }
  const { toast } = useToast();

  const isParentCompleted = parentStatus === 'Completed';

   // Fetch Dropdown Labels for Display
   useEffect(() => {
    const fetchLabels = async () => {
      try {
        const allFormatCollections = Object.values(SERVICE_FORMAT_MAPPING);
        const maps = await getDropdownOptionsMap(['customers', 'services', 'doe', ...allFormatCollections]); // Add all format collections
        setDropdownMaps(maps);
      } catch (err) {
        console.error("Error fetching dropdown labels:", err);
        // Non-critical error, proceed without labels if needed
        toast({
            variant: "destructive",
            title: "Error Loading Dropdown Labels",
            description: "Some labels might not display correctly."
        })
      }
    };
    fetchLabels();
  }, [toast]);


  // Fetch Shipment Details in Real-time
  useEffect(() => {
    if (!shipmentId) {
        setError("Shipment ID not provided.");
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');
    const q = query(detailsCollectionRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const fetchedDetails: ShipmentDetail[] = snapshot.docs.map(doc => detailFromFirestore(doc));
        setDetails(fetchedDetails);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Error fetching shipment details:", err);
        setError("Failed to load shipment details.");
        setIsLoading(false);
      }
    );

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [shipmentId]);

  const handleAddDetail = () => {
    if (isParentCompleted) return; // Prevent adding if parent is completed
    setEditingDetail(null);
    setIsFormOpen(true);
  };

  const handleEditDetail = (detail: ShipmentDetail) => {
     if (isParentCompleted) return; // Prevent editing if parent is completed
    setEditingDetail(detail);
    setIsFormOpen(true);
  };

  const handleSaveDetail = async (data: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated' | 'netWeight'>) => {
    if (isParentCompleted) {
        toast({ variant: "destructive", title: "Cannot Save", description: "Shipment is already completed." });
        return;
    }
    const detailData = {
      ...data,
      netWeight: parseFloat(((data.grossWeight ?? 0) - (data.tareWeight ?? 0)).toFixed(3)), // Calculate net weight
    };

    try {
        if (editingDetail) {
            // Update existing detail
            await updateShipmentDetail(shipmentId, editingDetail.id, detailData);
            toast({ title: "Detail Updated", description: "Shipment detail saved successfully." });
        } else {
            // Add new detail
            await addShipmentDetail(shipmentId, detailData);
            toast({ title: "Detail Added", description: "Shipment detail added successfully." });
        }
         // Close the form after successful save
         setIsFormOpen(false);
         // Note: recalculateShipmentTotals is called within add/update/delete service functions
    } catch (error) {
        console.error("Error saving shipment detail:", error);
        toast({ variant: "destructive", title: "Save Failed", description: error instanceof Error ? error.message : "Could not save detail." });
    }

  };

  const handleDeleteDetail = async (detailId: string) => {
     if (isParentCompleted) {
        toast({ variant: "destructive", title: "Cannot Delete", description: "Shipment is already completed." });
        return;
     }
     try {
         // Prevent deletion of the last detail? (Re-enabled for consideration)
         // if (details.length === 1) {
         //    toast({ variant: "destructive", title: "Deletion Prevented", description: "Cannot delete the last detail item." });
         //    return;
         // }

         await deleteShipmentDetail(shipmentId, detailId);

         toast({ title: "Detail Deleted", description: "Shipment detail removed successfully." });
         // Note: recalculateShipmentTotals is called within deleteShipmentDetail service function

     } catch (error) {
         console.error("Error deleting shipment detail:", error);
         toast({ variant: "destructive", title: "Deletion Failed", description: error instanceof Error ? error.message : "Could not remove detail." });
     }
  };

  const getLabel = (collectionId: string, value: string | undefined): string => {
      if (!value) return 'N/A';
      return dropdownMaps[collectionId]?.[value] || value; // Return value itself if label not found
  };

   const getFormatLabel = (serviceId: string | undefined, formatId: string | undefined): string => {
       if (!serviceId || !formatId) return 'N/A';
       const formatCollectionId = SERVICE_FORMAT_MAPPING[serviceId];
       if (!formatCollectionId) return formatId; // Return value if no mapping
       return getLabel(formatCollectionId, formatId);
   };


  return (
    <Card className="shadow-lg rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Shipment Items</CardTitle>
        {!isParentCompleted && (
          <Button onClick={handleAddDetail} size="sm" disabled={isParentCompleted}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Item
          </Button>
        )}
         {isParentCompleted && (
            <p className="text-sm text-muted-foreground">Shipment is completed, items cannot be modified.</p>
         )}
      </CardHeader>
      <CardContent>
        {isLoading && (
           <div className="space-y-2">
               <Skeleton className="h-10 w-full" />
               <Skeleton className="h-10 w-full" />
               <Skeleton className="h-10 w-full" />
           </div>
        )}
        {error && !isLoading && ( // Only show error if not loading
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Items</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!isLoading && !error && details.length === 0 && (
          <p className="text-center text-muted-foreground py-4">No items added to this shipment yet.</p>
        )}
        {!isLoading && !error && details.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Pallets</TableHead>
                  <TableHead>Bags</TableHead>
                  <TableHead className="text-right">Gross (kg)</TableHead>
                  <TableHead className="text-right">Tare (kg)</TableHead>
                  <TableHead className="text-right">Net (kg)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.map((detail) => (
                  <TableRow key={detail.id}>
                    <TableCell>{getLabel('customers', detail.customerId)}</TableCell>
                    <TableCell>{getLabel('services', detail.serviceId)}</TableCell>
                    <TableCell>{getFormatLabel(detail.serviceId, detail.formatId)}</TableCell>
                    <TableCell>{detail.numPallets}</TableCell>
                    <TableCell>{detail.numBags}</TableCell>
                    <TableCell className="text-right">{detail.grossWeight?.toFixed(3) ?? '0.000'}</TableCell>
                    <TableCell className="text-right">{detail.tareWeight?.toFixed(3) ?? '0.000'}</TableCell>
                    <TableCell className="text-right">{detail.netWeight?.toFixed(3) ?? '0.000'}</TableCell>
                    <TableCell className="text-right">
                      {!isParentCompleted && (
                         <div className="flex justify-end space-x-1">
                           <Button variant="ghost" size="icon" onClick={() => handleEditDetail(detail)} title="Edit Item" disabled={isParentCompleted}>
                             <Edit className="h-4 w-4" />
                             <span className="sr-only">Edit</span>
                           </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Delete Item" disabled={isParentCompleted || details.length <= 1}>
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Delete</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the shipment detail item.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => handleDeleteDetail(detail.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                         </div>
                      )}
                      {isParentCompleted && (
                          <span className="text-xs text-muted-foreground italic">Locked</span>
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
      {isFormOpen && (
        <ShipmentDetailForm
            shipmentId={shipmentId}
            detail={editingDetail}
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            onSave={handleSaveDetail}
        />
      )}
    </Card>
  );
}
