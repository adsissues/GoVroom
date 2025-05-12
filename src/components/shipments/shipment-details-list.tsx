
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
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { addShipmentDetail, updateShipmentDetail } from '@/lib/firebase/shipmentsService';
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
        const maps = await getDropdownOptionsMap(['customers', 'services', 'doe', 'formats_prior', 'formats_eco', 'formats_s3c']); // Add all format collections
        setDropdownMaps(maps);
      } catch (err) {
        console.error("Error fetching dropdown labels:", err);
        // Non-critical error, proceed without labels if needed
      }
    };
    fetchLabels();
  }, []);


  // Fetch Shipment Details in Real-time
  useEffect(() => {
    setIsLoading(true);
    const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');
    const q = query(detailsCollectionRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const fetchedDetails: ShipmentDetail[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
           // Ensure Timestamps are handled if needed, though Firestore SDK usually does
           createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt : Timestamp.now(), // Fallback
           lastUpdated: doc.data().lastUpdated instanceof Timestamp ? doc.data().lastUpdated : Timestamp.now(),
        } as ShipmentDetail));
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
    setEditingDetail(null);
    setIsFormOpen(true);
  };

  const handleEditDetail = (detail: ShipmentDetail) => {
    setEditingDetail(detail);
    setIsFormOpen(true);
  };

  const handleSaveDetail = async (data: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated' | 'netWeight'>) => {
    const detailData = {
      ...data,
      netWeight: data.grossWeight - data.tareWeight, // Calculate net weight
    };

    if (editingDetail) {
      // Update existing detail
      await updateShipmentDetail(shipmentId, editingDetail.id, detailData);
    } else {
      // Add new detail
      await addShipmentDetail(shipmentId, detailData);
    }
    // Recalculations will happen via cloud function ideally, or could be triggered here
  };

  const handleDeleteDetail = async (detailId: string) => {
     try {
         // Prevent deletion if this is the last detail? (Optional business logic)
         // if (details.length === 1) {
         //    toast({ variant: "destructive", title: "Deletion Prevented", description: "Cannot delete the last detail item." });
         //    return;
         // }

         const detailRef = doc(db, 'shipments', shipmentId, 'details', detailId);
         // Optionally check dependencies before deleting if needed

         await deleteDoc(detailRef);

         toast({ title: "Detail Deleted", description: "Shipment detail removed successfully." });
         // Recalculations will happen via cloud function ideally, or could be triggered here

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
          <Button onClick={handleAddDetail} size="sm">
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
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!isLoading && !error && details.length === 0 && (
          <p className="text-center text-muted-foreground py-4">No items added to this shipment yet.</p>
        )}
        {!isLoading && !error && details.length > 0 && (
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
                  <TableCell className="text-right">{detail.grossWeight.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{detail.tareWeight.toFixed(3)}</TableCell>
                   <TableCell className="text-right">{(detail.grossWeight - detail.tareWeight).toFixed(3)}</TableCell>
                  <TableCell className="text-right">
                    {!isParentCompleted && (
                       <div className="flex justify-end space-x-2">
                         <Button variant="ghost" size="icon" onClick={() => handleEditDetail(detail)}>
                           <Edit className="h-4 w-4" />
                           <span className="sr-only">Edit</span>
                         </Button>
                          <AlertDialog>
                              <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Form Modal */}
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
```