
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getShipmentById, updateShipment, shipmentFromFirestore } from '@/lib/firebase/shipmentsService';
import type { Shipment, ShipmentStatus } from '@/lib/types'; // Added ShipmentStatus
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Loader2, Edit, XCircle } from 'lucide-react';
import ShipmentForm from '@/components/shipments/shipment-form';
import ShipmentDetailsList from '@/components/shipments/shipment-details-list';
import { Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { generatePreAlertPdf, generateCmrPdf } from '@/lib/pdfService'; // Import PDF functions

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const pathShipmentId = params?.shipmentId;
  const shipmentId = typeof pathShipmentId === 'string' && pathShipmentId.trim() !== '' ? pathShipmentId.trim() : undefined;

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusBeforeUpdate, setStatusBeforeUpdate] = useState<ShipmentStatus | undefined>(undefined);

  const isAdmin = currentUser?.role === 'admin';
  const canEdit = shipment?.status === 'Pending' || isAdmin;

  const fetchShipment = useCallback(async (showLoadingIndicator = true) => {
    if (!shipmentId) {
      setError("Invalid Shipment ID provided in the URL.");
      if (showLoadingIndicator) setIsLoading(false);
      setShipment(null);
      return null; // Return null if no ID
    }

    if (showLoadingIndicator) setIsLoading(true);
    setError(null);
    // setShipment(null); // Don't reset shipment here if we want to compare old status

    try {
      const fetchedShipmentData = await getShipmentById(shipmentId);
      if (fetchedShipmentData) {
        setShipment(fetchedShipmentData);
        if (showLoadingIndicator) setIsLoading(false);
        return fetchedShipmentData; // Return fetched data
      } else {
        if (showLoadingIndicator) setIsLoading(false);
        notFound();
        return null; // Return null if not found
      }
    } catch (err) {
      console.error(`Error fetching shipment ID "${shipmentId}":`, err);
      setError(err instanceof Error ? err.message : "Failed to load shipment data.");
      if (showLoadingIndicator) setIsLoading(false);
      return null; // Return null on error
    }
  }, [shipmentId]);

  useEffect(() => {
    fetchShipment();
  }, [fetchShipment]);

  const handleUpdateShipment = async (data: Partial<Shipment>) => {
    if (!shipment || !shipmentId) {
      toast({ variant: "destructive", title: "Update Failed", description: "Cannot update, critical data missing." });
      return;
    }

    setStatusBeforeUpdate(shipment.status); // Store current status

    try {
      await updateShipment(shipmentId, data);
      toast({ title: "Shipment Updated", description: "Main shipment details saved successfully." });
      setIsEditing(false);
      
      // Fetch the latest shipment data to reflect changes and for PDF generation
      const updatedShipmentData = await fetchShipment(false); // Fetch without full page loading indicator

      // Check if status changed to 'Completed' for PDF generation
      // This check is now implicitly handled by the useEffect below
      // which listens to changes in 'shipment' state and 'statusBeforeUpdate'

    } catch (err) {
      console.error("Error updating shipment:", err);
      toast({ variant: "destructive", title: "Update Failed", description: err instanceof Error ? err.message : "Could not save shipment changes." });
    }
  };

  // Effect to handle PDF generation when shipment state updates after a status change
  useEffect(() => {
    if (shipment && statusBeforeUpdate === 'Pending' && shipment.status === 'Completed') {
      toast({
        title: 'Generating PDFs',
        description: 'Shipment completed. PDFs will be downloaded shortly.',
        duration: 5000,
      });
      try {
        generatePreAlertPdf(shipment);
        generateCmrPdf(shipment);
      } catch(pdfError) {
        console.error("Error generating PDFs:", pdfError);
        toast({
          variant: "destructive",
          title: "PDF Generation Failed",
          description: pdfError instanceof Error ? pdfError.message : "Could not generate PDFs."
        });
      }
    }
    // Reset statusBeforeUpdate after the check, regardless of PDF generation outcome
    // This ensures it's ready for the next potential update.
    if (statusBeforeUpdate !== undefined) {
        setStatusBeforeUpdate(undefined);
    }
  }, [shipment, statusBeforeUpdate, toast]);


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] space-y-4 p-4 md:p-6 lg:p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading shipment details...</p>
        <Skeleton className="h-8 w-48 mt-4" />
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

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
          <Button variant="outline" size="sm" onClick={() => fetchShipment()} className="mt-4">
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  if (!shipment) {
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

  return (
    <div className="space-y-6 md:space-y-8">
      <Button variant="outline" onClick={() => router.push('/shipments')} className="mb-0">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shipments List
      </Button>

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
          <ShipmentForm
            isAdmin={isAdmin}
            initialData={shipment}
            onSubmit={handleUpdateShipment}
            isEditing={isEditing}
            shipmentId={shipment.id}
            onSaveSuccess={async () => { // Make async if fetchShipment is awaited
              setIsEditing(false);
              await fetchShipment(false); // Refetch data, no full loading indicator
            }}
          />
        </CardContent>
      </Card>

      <ShipmentDetailsList shipmentId={shipment.id} parentStatus={shipment.status} />
    </div>
  );
}
