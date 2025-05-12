
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getShipmentById, updateShipment, shipmentFromFirestore } from '@/lib/firebase/shipmentsService';
import type { Shipment } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Loader2, Edit, XCircle } from 'lucide-react'; // Added Edit, XCircle
import ShipmentForm from '@/components/shipments/shipment-form';
import ShipmentDetailsList from '@/components/shipments/shipment-details-list';
import { Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser } = useAuth();

  // Robustly get shipmentId, ensuring it's a non-empty string or undefined
  const pathShipmentId = params?.shipmentId;
  const shipmentId = typeof pathShipmentId === 'string' && pathShipmentId.trim() !== '' ? pathShipmentId.trim() : undefined;

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false); // State to control form edit mode
  const [error, setError] = useState<string | null>(null);

   // Determine if the current user is an admin
  const isAdmin = currentUser?.role === 'admin';
  // Determine if the form should be editable based on status and role
  const canEdit = shipment?.status === 'Pending' || isAdmin;


  const fetchShipment = useCallback(async () => {
    if (!shipmentId) {
        console.warn("ShipmentDetailPage: Invalid or missing shipmentId.");
        setError("Invalid Shipment ID provided in the URL.");
        setIsLoading(false);
        setShipment(null);
        return;
    }

    console.log(`ShipmentDetailPage: Attempting to fetch shipment with ID: "${shipmentId}"`);
    setIsLoading(true);
    setError(null);
    setShipment(null); // Reset previous state

    try {
      const fetchedShipment = await getShipmentById(shipmentId);
      if (fetchedShipment) {
        console.log(`ShipmentDetailPage: Shipment found:`, fetchedShipment);
        setShipment(fetchedShipment);
      } else {
        console.warn(`ShipmentDetailPage: Shipment with ID "${shipmentId}" NOT FOUND. Triggering notFound().`);
        notFound(); // Render Next.js 404 page
      }
    } catch (err) {
      console.error(`ShipmentDetailPage: Error fetching shipment ID "${shipmentId}":`, err);
      setError(err instanceof Error ? err.message : "Failed to load shipment data.");
    } finally {
      setIsLoading(false);
    }
  }, [shipmentId]); // Depend on shipmentId

  // Fetch shipment data on mount or when shipmentId changes
  useEffect(() => {
    fetchShipment();
  }, [fetchShipment]);


  // Handler for the ShipmentForm submission (updating)
  const handleUpdateShipment = async (data: Partial<Shipment>) => {
     if (!shipment || !shipmentId) {
        console.error("handleUpdateShipment: called without shipment or shipmentId.");
        toast({ variant: "destructive", title: "Update Failed", description: "Cannot update, critical data missing." });
        return; // Should not happen if form is rendered correctly
     }
    // No need to set isLoading here, form might handle its own loading state
    try {
        // Let updateShipment handle timestamp conversion and adding lastUpdated
        await updateShipment(shipmentId, data);
        toast({ title: "Shipment Updated", description: "Main shipment details saved successfully." });
        setIsEditing(false); // Exit edit mode on successful save
        // Refetch data to show the latest version after update
        fetchShipment();
    } catch (err) {
      console.error("Error updating shipment:", err);
      toast({ variant: "destructive", title: "Update Failed", description: err instanceof Error ? err.message : "Could not save shipment changes." });
       // Optionally set an error state for the page if needed
       // setError(err instanceof Error ? err.message : "Could not save shipment changes.");
    } finally {
        // No need to set isLoading(false) here if form handles it
    }
  };


  // --- Render Logic ---

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] space-y-4 p-4 md:p-6 lg:p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading shipment details...</p>
        {/* Skeletons for layout */}
        <Skeleton className="h-8 w-48 mt-4" />
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    // This state covers fetch errors OR invalid ID errors set in fetchShipment
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Shipment</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
           <Button variant="outline" size="sm" onClick={fetchShipment} className="mt-4">
                 Retry
             </Button>
        </Alert>
      </div>
    );
  }

  // If notFound() was called, Next.js handles the 404 page.
  // This check is a safeguard in case notFound() doesn't halt rendering immediately
  // or if there's a state where loading is false, no error, but shipment is still null.
  if (!shipment) {
     console.warn("ShipmentDetailPage: Render - Shipment is null after loading and no explicit error. This usually means notFound() was called.");
    // Display a generic message (though user should see the 404 page)
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Alert variant="default" className="border-yellow-500 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-700" />
          <AlertTitle className="text-yellow-800">Shipment Not Found</AlertTitle>
          <AlertDescription className="text-yellow-700">
            The requested shipment could not be found or displayed.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // --- Main Render ---
  // If loading is done, no error, and shipment exists:
  return (
    <div className="space-y-6 md:space-y-8">
       <Button variant="outline" onClick={() => router.push('/shipments')} className="mb-0">
         <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shipments List
       </Button>

      {/* Main Shipment Details Card */}
      <Card className="shadow-lg rounded-xl border">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
                <CardTitle className="text-xl md:text-2xl">Shipment Details</CardTitle>
                <CardDescription>ID: <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{shipment.id}</span></CardDescription>
                {shipment.status === 'Completed' && !isAdmin && (
                     <p className="text-sm text-destructive mt-2">Shipment is completed and cannot be edited by users.</p>
                )}
                {shipment.status === 'Completed' && isAdmin && !isEditing && (
                     <p className="text-sm text-amber-600 mt-2">Shipment is completed. Editing enabled for Admin.</p>
                )}
            </div>
             {/* Edit/Cancel Buttons */}
             <div className="flex gap-2">
                {canEdit && !isEditing && (
                    <Button onClick={() => setIsEditing(true)} variant="outline">
                       <Edit className="mr-2 h-4 w-4" /> Edit Main Info
                    </Button>
                )}
                 {isEditing && (
                     <Button onClick={() => setIsEditing(false)} variant="ghost">
                       <XCircle className="mr-2 h-4 w-4" /> Cancel Edit
                     </Button>
                 )}
             </div>
        </CardHeader>
        <CardContent>
           {/* Shipment Form - Pass edit state */}
           <ShipmentForm
              isAdmin={isAdmin}
              initialData={shipment}
              onSubmit={handleUpdateShipment}
              isEditing={isEditing} // Control edit mode from this page's state
              shipmentId={shipment.id} // Pass shipment ID
              onSaveSuccess={() => {
                setIsEditing(false); // Exit edit mode after successful save
                fetchShipment();    // Refetch data to show updated state
              }}
           />
        </CardContent>
      </Card>

       {/* Shipment Details (Items) Section */}
       <ShipmentDetailsList shipmentId={shipment.id} parentStatus={shipment.status} />
    </div>
  );
}
