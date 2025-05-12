"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getShipmentById, updateShipment } from '@/lib/firebase/shipmentsService';
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

  // Robustly get shipmentId, ensuring it's a non-empty string or undefined
  const pathShipmentId = params?.shipmentId; // Raw value from params
  const shipmentId = typeof pathShipmentId === 'string' && pathShipmentId.trim() !== '' ? pathShipmentId.trim() : undefined;

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start true: loading until ID validated and data fetched or error
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log(`ShipmentDetailPage Effect: Raw pathShipmentId from params = "${pathShipmentId}"`);
    console.log(`ShipmentDetailPage Effect: Processed shipmentId for fetch = "${shipmentId}"`);

    if (shipmentId) {
      setIsLoading(true); // Set loading true when a valid ID is present and we're about to fetch
      setError(null);
      setShipment(null); // Reset previous shipment state

      const fetchShipment = async () => {
        console.log(`ShipmentDetailPage: Attempting to fetch shipment with valid ID: "${shipmentId}"`);
        try {
          const fetchedShipment = await getShipmentById(shipmentId);
          if (fetchedShipment) {
            console.log(`ShipmentDetailPage: Shipment found for ID "${shipmentId}":`, fetchedShipment);
            setShipment(fetchedShipment);
          } else {
            console.warn(`ShipmentDetailPage: Shipment with ID "${shipmentId}" NOT FOUND in Firestore. Calling notFound().`);
            notFound(); // Trigger Next.js 404 page
          }
        } catch (err) {
          console.error(`ShipmentDetailPage: Error fetching shipment ID "${shipmentId}":`, err);
          setError(err instanceof Error ? err.message : "Failed to load shipment data due to an unexpected error.");
        } finally {
          setIsLoading(false); // Stop loading after fetch attempt (success, not found, or error)
        }
      };

      fetchShipment();
    } else {
      // This block runs if shipmentId is undefined (e.g., invalid URL param like /shipments/ or /shipments/  )
      console.warn(`ShipmentDetailPage Effect: Invalid or missing shipmentId. Raw param: "${pathShipmentId}". Processed: "${shipmentId}". Setting error state.`);
      setError("Invalid or missing Shipment ID in URL.");
      setIsLoading(false); // Stop loading as there's no valid ID to fetch
      setShipment(null); // Ensure no stale shipment data is shown
    }
  }, [shipmentId, pathShipmentId]); // Re-run if the raw param or the processed id changes

  const handleUpdateShipment = async (data: Partial<Shipment>) => {
     if (!shipment || !shipmentId) {
        console.error("handleUpdateShipment: called without shipment or shipmentId.");
        toast({ variant: "destructive", title: "Update Failed", description: "Cannot update, shipment data is missing." });
        return;
     }
    setIsLoading(true); 
    try {
      const updatedData = {
        ...shipment,
        ...data,
        departureDate: data.departureDate instanceof Date ? Timestamp.fromDate(data.departureDate) : shipment.departureDate,
        arrivalDate: data.arrivalDate instanceof Date ? Timestamp.fromDate(data.arrivalDate) : shipment.arrivalDate,
        lastUpdated: Timestamp.now(),
      };
      await updateShipment(shipmentId, updatedData);

      const freshlyFetched = await getShipmentById(shipmentId); 
      if (freshlyFetched) {
          setShipment(freshlyFetched);
      } else {
         console.error("Shipment disappeared after update? ID:", shipmentId);
         setError("Failed to reload shipment after update. It might have been deleted.");
         setShipment(null); 
      }

      setIsEditing(false); 
      toast({ title: "Shipment Updated", description: "Main shipment details saved successfully." });
    } catch (err) {
      console.error("Error updating shipment:", err);
      toast({ variant: "destructive", title: "Update Failed", description: err instanceof Error ? err.message : "Could not save shipment changes." });
       setError(err instanceof Error ? err.message : "Could not save shipment changes.");
    } finally {
        setIsLoading(false); 
    }
  };


  if (isLoading) {
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

  if (error) {
    // This state is reached if shipmentId was invalid OR if fetching a valid ID failed.
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

  // If notFound() was called in useEffect, Next.js should prevent rendering further.
  // This block is a safeguard or for states not leading to a full 404 page (e.g. if we decided not to use notFound() for some errors).
  if (!shipment) {
    // This case means: not loading, no specific error message set from a fetch *failure*,
    // and no shipment data. This path should primarily be hit if notFound() was called.
    // If `notFound()` is working as expected, the user won't see this UI, they'll see the Next.js 404 page.
    // If they *do* see this, it means `notFound()` might not be halting execution as expected,
    // or there's another logic path.
    console.warn("ShipmentDetailPage: Render - shipment is null, isLoading is false, and no explicit 'error' state was set for fetch failure. This implies notFound() should have handled it or ID was initially invalid (which should have an error message).");
    // Display a generic "not found" like message if no specific error was set.
    // This might be redundant if the `error` state for "Invalid ID" already covers it.
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Alert variant="default" className="border-yellow-500 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-700" />
          <AlertTitle className="text-yellow-800">Shipment Data Not Available</AlertTitle>
          <AlertDescription className="text-yellow-700">
            The requested shipment could not be displayed. Please check the URL or try again later.
            If the problem persists, the shipment may no longer exist.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // If we reach here, shipment is loaded, not loading, and no error.
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
       <Button variant="outline" onClick={() => router.back()} className="mb-4">
         <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shipments
       </Button>

      <Card className="shadow-lg rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Shipment Details (ID: {shipment.id})</CardTitle>
          {!isEditing && shipment.status === 'Pending' && (
             <Button onClick={() => setIsEditing(true)} variant="outline" disabled={isLoading}>Edit Main Info</Button>
          )}
          {!isEditing && shipment.status === 'Completed' && currentUser?.role === 'admin' && (
             <Button onClick={() => setIsEditing(true)} variant="outline" disabled={isLoading}>Edit Main Info (Admin)</Button>
          )}
          {isEditing && (
             <Button onClick={() => setIsEditing(false)} variant="ghost" disabled={isLoading}>Cancel Edit</Button>
          )}
        </CardHeader>
        <CardContent>
           <ShipmentForm
              isAdmin={!!(currentUser?.role === 'admin')}
              initialData={shipment}
              onSubmit={handleUpdateShipment}
              isEditing={isEditing}
              shipmentId={shipment.id}
              onSaveSuccess={() => {
                setIsEditing(false);
              }}
           />
        </CardContent>
      </Card>

       <ShipmentDetailsList shipmentId={shipment.id} parentStatus={shipment.status} />
    </div>
  );
}
