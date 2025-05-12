"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getShipmentById, updateShipment } from '@/lib/firebase/shipmentsService';
import type { Shipment } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import ShipmentForm from '@/components/shipments/shipment-form'; // Reuse form for viewing/editing main details
import ShipmentDetailsList from '@/components/shipments/shipment-details-list';
import { Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const shipmentId = params.shipmentId as string;

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false); // For editing main shipment info
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shipmentId) {
      setError("Shipment ID is missing.");
      setIsLoading(false);
      return;
    }

    const fetchShipment = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedShipment = await getShipmentById(shipmentId);
        if (fetchedShipment) {
          setShipment(fetchedShipment);
        } else {
          setError("Shipment not found.");
        }
      } catch (err) {
        console.error("Error fetching shipment:", err);
        setError(err instanceof Error ? err.message : "Failed to load shipment data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchShipment();
  }, [shipmentId]);

  const handleUpdateShipment = async (data: Partial<Shipment>) => {
     if (!shipment) return;
    setIsLoading(true); // Set loading state during update
    try {
      // Merge existing data with new data, add lastUpdated timestamp
      // Ensure status is updated correctly based on the form's toggle
      const updatedData = {
        ...shipment,
        ...data,
        lastUpdated: Timestamp.now(),
      };
      await updateShipment(shipmentId, updatedData);
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


  if (isLoading && !shipment) { // Show skeleton only on initial load
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
         <Button variant="outline" onClick={() => router.back()} className="mb-4">
           <ArrowLeft className="mr-2 h-4 w-4" /> Back
         </Button>
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!shipment) {
     return (
      <div className="p-4 md:p-6 lg:p-8">
         <Button variant="outline" onClick={() => router.back()} className="mb-4">
           <ArrowLeft className="mr-2 h-4 w-4" /> Back
         </Button>
        <Alert>
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>The requested shipment could not be found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
       <Button variant="outline" onClick={() => router.back()} className="mb-4">
         <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shipments
       </Button>

      {/* Display/Edit Main Shipment Info */}
      <Card className="shadow-lg rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Shipment Details (ID: {shipmentId})</CardTitle>
          {/* Show edit button only if not already editing AND shipment is pending */}
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
              onSubmit={handleUpdateShipment} // Pass the update handler
              isEditing={isEditing} // Pass editing state to the form
              shipmentId={shipmentId} // Pass shipmentId if needed for child components
              onSaveSuccess={() => setIsEditing(false)} // Callback to exit edit mode
           />
        </CardContent>
      </Card>

      {/* Shipment Details Subcollection Section */}
       <ShipmentDetailsList shipmentId={shipmentId} parentStatus={shipment.status} />

    </div>
  );
}
