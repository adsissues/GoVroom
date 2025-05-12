
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation'; // Import notFound
import { useAuth } from '@/contexts/AuthContext';
import { getShipmentById, updateShipment } from '@/lib/firebase/shipmentsService';
import type { Shipment } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle } from 'lucide-react'; // Import AlertTriangle
import ShipmentForm from '@/components/shipments/shipment-form';
import ShipmentDetailsList from '@/components/shipments/shipment-details-list';
import { Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const shipmentId = params?.shipmentId as string | undefined; // Handle potential undefined

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("ShipmentDetailPage: Params received:", params);
    if (!shipmentId) {
      console.error("ShipmentDetailPage: Shipment ID is missing from params.");
      // Don't immediately set error, wait for params to potentially populate.
      // Setting isLoading to false prematurely might cause issues.
      // If params *never* populates, loading will stay true or an outer boundary might catch it.
      return;
    }

    const fetchShipment = async () => {
      console.log(`ShipmentDetailPage: Fetching shipment with ID: ${shipmentId}`);
      setIsLoading(true);
      setError(null);
      try {
        const fetchedShipment = await getShipmentById(shipmentId);
        if (fetchedShipment) {
          console.log(`ShipmentDetailPage: Shipment found:`, fetchedShipment);
          setShipment(fetchedShipment);
        } else {
          console.warn(`ShipmentDetailPage: Shipment with ID ${shipmentId} not found in Firestore.`);
          // Use Next.js's notFound() to render the 404 page
          notFound();
        }
      } catch (err) {
        console.error("ShipmentDetailPage: Error fetching shipment:", err);
        setError(err instanceof Error ? err.message : "Failed to load shipment data.");
        // Optionally, redirect or show a generic error component instead of 404
        // For now, we show an error alert below.
      } finally {
        setIsLoading(false);
      }
    };

    fetchShipment();
  }, [shipmentId, params]); // Depend on shipmentId and the whole params object

  const handleUpdateShipment = async (data: Partial<Shipment>) => {
     if (!shipment) return;
    setIsLoading(true); // Set loading state during update
    try {
      const updatedData = {
        ...shipment,
        ...data,
        lastUpdated: Timestamp.now(),
      };
      await updateShipment(shipmentId!, updatedData); // shipmentId is checked above
      setShipment(updatedData); // Update local state
      setIsEditing(false); // Exit edit mode
      toast({ title: "Shipment Updated", description: "Main shipment details saved successfully." });
    } catch (err) {
      console.error("Error updating shipment:", err);
      toast({ variant: "destructive", title: "Update Failed", description: err instanceof Error ? err.message : "Could not save shipment changes." });
    } finally {
        setIsLoading(false); // Reset loading state
    }
  };

  if (isLoading) {
    // Added check for shipmentId to avoid skeleton flash if ID is missing initially
    if (!shipmentId) {
      return (
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
          <Alert variant="destructive">
             <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Shipment ID is missing or invalid in the URL.</AlertDescription>
          </Alert>
        </div>
      )
    }
    return (
       <div className="space-y-6 p-4 md:p-6 lg:p-8">
         <Skeleton className="h-8 w-32" />
         <Skeleton className="h-96 w-full rounded-xl" />
         <Skeleton className="h-64 w-full rounded-xl" />
       </div>
     );
   }

  if (error) {
    // This state is reached if fetching failed for reasons other than "not found"
    return (
      <div className="p-4 md:p-6 lg:p-8">
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

  // If loading is false, no error occurred, but shipment is still null,
  // this indicates a logic issue or that notFound() should have been called.
  // It's less likely to be reached now with the notFound() call in useEffect.
  if (!shipment) {
     console.error("ShipmentDetailPage: Reached state where shipment is null, but no loading or error state. This should ideally not happen.");
     return (
       <div className="p-4 md:p-6 lg:p-8">
          <Button variant="outline" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
         <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
           <AlertTitle>Unexpected State</AlertTitle>
           <AlertDescription>Could not display shipment data. Please try again later.</AlertDescription>
         </Alert>
       </div>
     );
   }

  // --- Render actual shipment details ---
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
       <Button variant="outline" onClick={() => router.back()} className="mb-4">
         <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shipments
       </Button>

      <Card className="shadow-lg rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Shipment Details (ID: {shipmentId})</CardTitle>
          {!isEditing && shipment.status === 'Pending' && (
             <Button onClick={() => setIsEditing(true)} variant="outline">Edit Main Info</Button>
          )}
          {isEditing && (
             <Button onClick={() => setIsEditing(false)} variant="ghost">Cancel Edit</Button>
          )}
        </CardHeader>
        <CardContent>
           <ShipmentForm
              isAdmin={currentUser?.role === 'admin'}
              initialData={shipment}
              onSubmit={handleUpdateShipment}
              isEditing={isEditing}
              shipmentId={shipmentId} // Pass shipmentId
              onSaveSuccess={() => setIsEditing(false)}
           />
        </CardContent>
      </Card>

       <ShipmentDetailsList shipmentId={shipmentId} parentStatus={shipment.status} />

    </div>
  );
}
