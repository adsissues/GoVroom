
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getShipmentById, updateShipment, shipmentFromFirestore } from '@/lib/firebase/shipmentsService';
import type { Shipment } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import ShipmentForm from '@/components/shipments/shipment-form';
import ShipmentDetailsList from '@/components/shipments/shipment-details-list';
import { Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  // Ensure shipmentId is consistently typed as string | undefined
  const shipmentId = typeof params?.shipmentId === 'string' ? params.shipmentId : undefined;

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false); // Track if initial ID check is done

  useEffect(() => {
    // Only proceed if shipmentId is a non-empty string
    if (shipmentId) {
      console.log(`ShipmentDetailPage Effect: Valid shipmentId found: ${shipmentId}. Starting fetch.`);
      setIsInitialCheckDone(true); // Mark check as done

      const fetchShipment = async () => {
        console.log(`ShipmentDetailPage: Fetching shipment with ID: ${shipmentId}`);
        setIsLoading(true);
        setError(null);
        setShipment(null); // Reset shipment state before fetch
        try {
          const fetchedShipment = await getShipmentById(shipmentId);
          if (fetchedShipment) {
            console.log(`ShipmentDetailPage: Shipment found:`, fetchedShipment);
            setShipment(fetchedShipment);
          } else {
            console.warn(`ShipmentDetailPage: Shipment with ID ${shipmentId} not found in Firestore.`);
            // Trigger Next.js 404 page *only* if the fetch confirms non-existence
            notFound();
          }
        } catch (err) {
          console.error("ShipmentDetailPage: Error fetching shipment:", err);
          setError(err instanceof Error ? err.message : "Failed to load shipment data.");
          // Don't call notFound() on general fetch errors, show an error message instead.
        } finally {
          setIsLoading(false);
        }
      };

      fetchShipment();
    } else {
      // Handle the case where shipmentId is not yet available or invalid
      console.warn("ShipmentDetailPage Effect: shipmentId is not valid or not yet available:", shipmentId);
      // Don't set loading to false immediately, wait for params to potentially update.
      // We'll show a loading state until the ID is valid or confirmed missing.
      // If params never provide a valid ID, the loading state might persist,
      // or we can add a timeout later if needed.
      // Set initial check done even if ID is missing, so we can show the error message.
      setIsInitialCheckDone(true);
      setIsLoading(false); // Explicitly stop loading if ID is confirmed invalid/missing
      setError("Invalid or missing Shipment ID in URL.");
    }

  }, [shipmentId]); // Only re-run if shipmentId changes

  const handleUpdateShipment = async (data: Partial<Shipment>) => {
     if (!shipment || !shipmentId) return; // Guard against missing data
    setIsLoading(true); // Indicate loading during update
    try {
      const updatedData = {
        ...shipment,
        ...data,
        // Ensure Timestamps are handled correctly if dates are updated
        departureDate: data.departureDate instanceof Date ? Timestamp.fromDate(data.departureDate) : shipment.departureDate,
        arrivalDate: data.arrivalDate instanceof Date ? Timestamp.fromDate(data.arrivalDate) : shipment.arrivalDate,
        lastUpdated: Timestamp.now(),
      };
      await updateShipment(shipmentId, updatedData);

       // Refetch or update local state carefully to avoid type issues
      const freshlyFetched = await getShipmentById(shipmentId); // Re-fetch for consistency
      if (freshlyFetched) {
          setShipment(freshlyFetched);
      } else {
         // Should not happen if update succeeded, but handle defensively
         console.error("Shipment disappeared after update?");
         setError("Failed to reload shipment after update.");
         setShipment(null); // Clear inconsistent state
      }

      setIsEditing(false); // Exit edit mode
      toast({ title: "Shipment Updated", description: "Main shipment details saved successfully." });
    } catch (err) {
      console.error("Error updating shipment:", err);
      toast({ variant: "destructive", title: "Update Failed", description: err instanceof Error ? err.message : "Could not save shipment changes." });
       setError(err instanceof Error ? err.message : "Could not save shipment changes."); // Show error on page too
    } finally {
        setIsLoading(false); // Reset loading state
    }
  };


  // --- Render Logic ---

  // 1. Initial Check / Loading State (Before ID is confirmed)
  if (!isInitialCheckDone || (isLoading && !error)) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] space-y-4 p-4 md:p-6 lg:p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading shipment details...</p>
          <Skeleton className="h-8 w-32 mt-4" />
          <Skeleton className="h-96 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      );
   }

   // 2. Error State (Fetch failed OR Invalid ID)
   if (error) {
     return (
       <div className="space-y-6 p-4 md:p-6 lg:p-8">
         <Button variant="outline" onClick={() => router.back()} className="mb-4">
           <ArrowLeft className="mr-2 h-4 w-4" /> Back
         </Button>
         <Alert variant="destructive">
           <AlertTriangle className="h-4 w-4" />
           <AlertTitle>Error Loading Shipment</AlertTitle>
           <AlertDescription>{error}</AlertDescription>
         </Alert>
       </div>
     );
   }

   // 3. Shipment Not Found (but fetch succeeded and returned null)
   // This state should now be handled by the notFound() call within useEffect.
   // If somehow we reach here with shipment === null and no error/loading, it's an unexpected state.
   if (!shipment) {
      console.error("ShipmentDetailPage: Reached state where shipment is null, but no loading or error state. This should ideally not happen.");
      // Fallback, though notFound() should have been triggered.
       return (
         <div className="space-y-6 p-4 md:p-6 lg:p-8">
            <Button variant="outline" onClick={() => router.back()} className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
           <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
             <AlertTitle>Shipment Not Found</AlertTitle>
             <AlertDescription>The requested shipment could not be found. It might have been deleted or the ID is incorrect.</AlertDescription>
           </Alert>
         </div>
       );
    }

  // 4. Success State: Render Shipment Details
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
       <Button variant="outline" onClick={() => router.back()} className="mb-4">
         <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shipments
       </Button>

      <Card className="shadow-lg rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          {/* Use shipment.id which is confirmed to exist here */}
          <CardTitle>Shipment Details (ID: {shipment.id})</CardTitle>
          {!isEditing && shipment.status === 'Pending' && (
             <Button onClick={() => setIsEditing(true)} variant="outline" disabled={isLoading}>Edit Main Info</Button>
          )}
           {/* Allow Admin to edit completed shipments */}
          {!isEditing && shipment.status === 'Completed' && currentUser?.role === 'admin' && (
             <Button onClick={() => setIsEditing(true)} variant="outline" disabled={isLoading}>Edit Main Info (Admin)</Button>
          )}
          {isEditing && (
             <Button onClick={() => setIsEditing(false)} variant="ghost" disabled={isLoading}>Cancel Edit</Button>
          )}
        </CardHeader>
        <CardContent>
           {/* Pass shipment.id confirmed to exist */}
           <ShipmentForm
              isAdmin={currentUser?.role === 'admin'}
              initialData={shipment}
              onSubmit={handleUpdateShipment}
              isEditing={isEditing}
              shipmentId={shipment.id}
              onSaveSuccess={() => {
                setIsEditing(false);
                // Optionally re-fetch or rely on state update in handleUpdateShipment
              }}
           />
        </CardContent>
      </Card>

       {/* Pass shipment.id confirmed to exist */}
       <ShipmentDetailsList shipmentId={shipment.id} parentStatus={shipment.status} />

    </div>
  );
}
