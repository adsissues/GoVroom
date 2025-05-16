
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
    console.log(`[ShipmentDetailPage] fetchShipment called for ID: ${shipmentId}, showLoading: ${showLoadingIndicator}`);
    if (!shipmentId) {
      setError("Invalid Shipment ID provided in the URL.");
      if (showLoadingIndicator) setIsLoading(false);
      setShipment(null);
      console.log("[ShipmentDetailPage] fetchShipment: Invalid or missing shipmentId.");
      return null; // Return null if no ID
    }

    if (showLoadingIndicator) setIsLoading(true);
    setError(null);

    try {
      const fetchedShipmentData = await getShipmentById(shipmentId);
      if (fetchedShipmentData) {
        console.log("[ShipmentDetailPage] fetchShipment: Successfully fetched shipment data:", fetchedShipmentData);
        setShipment(fetchedShipmentData);
        if (showLoadingIndicator) setIsLoading(false);
        return fetchedShipmentData; // Return fetched data
      } else {
        console.log(`[ShipmentDetailPage] fetchShipment: No shipment found for ID ${shipmentId}. Calling notFound().`);
        if (showLoadingIndicator) setIsLoading(false);
        notFound();
        return null; // Return null if not found
      }
    } catch (err) {
      console.error(`[ShipmentDetailPage] fetchShipment: Error fetching shipment ID "${shipmentId}":`, err);
      setError(err instanceof Error ? err.message : "Failed to load shipment data.");
      if (showLoadingIndicator) setIsLoading(false);
      return null; // Return null on error
    }
  }, [shipmentId]); // Removed notFound from dependencies as it's stable

  useEffect(() => {
    fetchShipment();
  }, [fetchShipment]);

  const handleUpdateShipment = async (data: Partial<Shipment>) => {
    if (!shipment || !shipmentId) {
      toast({ variant: "destructive", title: "Update Failed", description: "Cannot update, critical data missing." });
      console.log('[ShipmentDetailPage] handleUpdateShipment: Aborted. Shipment or shipmentId missing.');
      return;
    }

    console.log('[ShipmentDetailPage] handleUpdateShipment: Initiated. Data to save:', data);
    console.log('[ShipmentDetailPage] handleUpdateShipment: Current shipment status (before this update):', shipment.status, 'Data status being saved:', data.status);
    setStatusBeforeUpdate(shipment.status); // Store current status just before the update attempt

    try {
      await updateShipment(shipmentId, data);
      toast({ title: "Shipment Updated", description: "Main shipment details saved successfully." });
      setIsEditing(false);
      
      console.log('[ShipmentDetailPage] handleUpdateShipment: Update successful. Refetching shipment...');
      const updatedShipmentData = await fetchShipment(false); // Fetch without full page loading indicator
      console.log('[ShipmentDetailPage] handleUpdateShipment: Refetched shipment data after update:', updatedShipmentData);
      // The useEffect below will handle PDF generation based on the updated 'shipment' state

    } catch (err) {
      console.error("[ShipmentDetailPage] handleUpdateShipment: Error updating shipment:", err);
      toast({ variant: "destructive", title: "Update Failed", description: err instanceof Error ? err.message : "Could not save shipment changes." });
    }
  };

  // Effect to handle PDF generation when shipment state updates after a status change
  useEffect(() => {
    console.log('[ShipmentDetailPage] PDF Effect triggered. Current shipment status:', shipment?.status, 'Status before update was:', statusBeforeUpdate);

    if (shipment && statusBeforeUpdate === 'Pending' && shipment.status === 'Completed') {
      console.log('[ShipmentDetailPage] PDF Effect: Condition MET for PDF generation. Shipment ID:', shipment.id);
      toast({
        title: 'Generating PDFs',
        description: 'Shipment completed. PDFs will be downloaded shortly.',
        duration: 5000,
      });
      try {
        console.log('[ShipmentDetailPage] PDF Effect: Calling generatePreAlertPdf with shipment data:', JSON.stringify(shipment));
        generatePreAlertPdf(shipment);
        console.log('[ShipmentDetailPage] PDF Effect: Calling generateCmrPdf with shipment data:', JSON.stringify(shipment));
        generateCmrPdf(shipment);
        console.log('[ShipmentDetailPage] PDF Effect: PDF generation calls ostensibly complete.');
      } catch(pdfError) {
        console.error("[ShipmentDetailPage] PDF Effect: Error during PDF generation functions:", pdfError);
        toast({
          variant: "destructive",
          title: "PDF Generation Failed",
          description: pdfError instanceof Error ? pdfError.message : "Could not generate PDFs."
        });
      }
    } else {
        if (shipment) {
            console.log(`[ShipmentDetailPage] PDF Effect: Condition NOT MET. Shipment ID: ${shipment.id}, Current Status: ${shipment.status}, Status Before Update was: ${statusBeforeUpdate}`);
        } else {
            console.log(`[ShipmentDetailPage] PDF Effect: Condition NOT MET. Shipment is null. Status Before Update was: ${statusBeforeUpdate}`);
        }
    }
    // Reset statusBeforeUpdate after the check, regardless of PDF generation outcome
    // This ensures it's ready for the next potential update.
    if (statusBeforeUpdate !== undefined) {
        // console.log('[ShipmentDetailPage] PDF Effect: Resetting statusBeforeUpdate from', statusBeforeUpdate, 'to undefined.');
        setStatusBeforeUpdate(undefined); // Reset for next potential update
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
    // This case should ideally be handled by the notFound() in fetchShipment or the error state.
    // Adding a fallback for robustness.
    console.log("[ShipmentDetailPage] Render: Shipment is null after loading and no error, this might indicate an issue or initial state.");
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Alert variant="default" className="border-yellow-500 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-700" />
          <AlertTitle className="text-yellow-800">Shipment Information</AlertTitle>
          <AlertDescription className="text-yellow-700">
            Shipment data is not available or could not be displayed. If you navigated here directly, the ID might be invalid.
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
            onSaveSuccess={async () => { 
              setIsEditing(false);
              console.log("[ShipmentDetailPage] ShipmentForm onSaveSuccess: Refetching shipment.");
              await fetchShipment(false); 
            }}
          />
        </CardContent>
      </Card>

      <ShipmentDetailsList shipmentId={shipment.id} parentStatus={shipment.status} />
    </div>
  );
}


    