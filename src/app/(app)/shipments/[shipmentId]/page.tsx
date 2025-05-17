
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getShipmentById, updateShipment } from '@/lib/firebase/shipmentsService';
import type { Shipment, ShipmentStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Loader2, Edit, XCircle } from 'lucide-react';
import ShipmentForm from '@/components/shipments/shipment-form';
import ShipmentDetailsList from '@/components/shipments/shipment-details-list';
import { Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { generatePreAlertPdf, generateCmrPdf } from '@/lib/pdfService';

console.log("[ShipmentDetailPage] Top-level: Script loaded.");

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function ShipmentDetailPage() {
  console.log("[ShipmentDetailPage] Component rendering or re-rendering...");
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const pathShipmentId = params?.shipmentId;
  const shipmentId = typeof pathShipmentId === 'string' && pathShipmentId.trim() !== '' ? pathShipmentId.trim() : undefined;
  console.log(`[ShipmentDetailPage] shipmentId from params: ${shipmentId}`);

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const previousShipmentStatusRef = useRef<ShipmentStatus | undefined | 'processing_pdf'>(undefined);


  const isAdmin = currentUser?.role === 'admin';
  const canEdit = isEditing && (shipment?.status === 'Pending' || isAdmin);

  const fetchShipment = useCallback(async (showLoadingIndicator = true) => {
    console.log(`[ShipmentDetailPage] fetchShipment called for ID: ${shipmentId}, showLoading: ${showLoadingIndicator}`);
    if (!shipmentId) {
      setError("Invalid Shipment ID provided in the URL.");
      if (showLoadingIndicator) setIsLoading(false);
      setShipment(null);
      console.log("[ShipmentDetailPage] fetchShipment: Invalid or missing shipmentId.");
      return null;
    }

    if (showLoadingIndicator) setIsLoading(true);
    setError(null);

    try {
      const fetchedShipmentData = await getShipmentById(shipmentId);
      if (fetchedShipmentData) {
        console.log("[ShipmentDetailPage] fetchShipment: Successfully fetched shipment data:", JSON.stringify(fetchedShipmentData).substring(0, 300) + "...");
        setShipment(fetchedShipmentData);
        if (showLoadingIndicator) setIsLoading(false);
        return fetchedShipmentData;
      } else {
        console.log(`[ShipmentDetailPage] fetchShipment: No shipment found for ID ${shipmentId}. Calling notFound().`);
        if (showLoadingIndicator) setIsLoading(false);
        notFound();
        return null;
      }
    } catch (err) {
      console.error(`[ShipmentDetailPage] fetchShipment: Error fetching shipment ID "${shipmentId}":`, err);
      setError(err instanceof Error ? err.message : "Failed to load shipment data.");
      if (showLoadingIndicator) setIsLoading(false);
      return null;
    }
  }, [shipmentId]);

  useEffect(() => {
    console.log("[ShipmentDetailPage] Initial data fetch useEffect triggered.");
    if (shipmentId) { 
        fetchShipment();
    } else {
        console.log("[ShipmentDetailPage] Initial data fetch: shipmentId is invalid, skipping fetch.");
        setError("No Shipment ID provided in URL.");
        setIsLoading(false);
    }
  }, [shipmentId, fetchShipment]); 

  const handleUpdateShipment = async (data: Partial<Shipment>) => {
    if (!shipment || !shipmentId) {
      toast({ variant: "destructive", title: "Update Failed", description: "Cannot update, critical data missing." });
      console.log('[ShipmentDetailPage] handleUpdateShipment: Aborted. Shipment or shipmentId missing.');
      return;
    }

    console.log('[ShipmentDetailPage] handleUpdateShipment: Initiated. Data to save:', JSON.parse(JSON.stringify(data)));
    console.log(`[ShipmentDetailPage] handleUpdateShipment: Current shipment status (before this update attempt): ${shipment.status}`);
    
    previousShipmentStatusRef.current = shipment.status;
    console.log(`[ShipmentDetailPage] handleUpdateShipment: Set previousShipmentStatusRef.current to: ${previousShipmentStatusRef.current}`);

    try {
      await updateShipment(shipmentId, data);
      toast({ title: "Shipment Updated", description: "Main shipment details saved successfully." });
      
      console.log('[ShipmentDetailPage] handleUpdateShipment: Update successful. Refetching shipment...');
      const updatedShipment = await fetchShipment(false); 
      console.log('[ShipmentDetailPage] handleUpdateShipment: Refetched shipment data after update:', updatedShipment ? JSON.stringify(updatedShipment).substring(0, 300) + "..." : "null/undefined");
      
      setIsEditing(false);

    } catch (err) {
      console.error("[ShipmentDetailPage] handleUpdateShipment: Error updating shipment:", err);
      toast({ variant: "destructive", title: "Update Failed", description: err instanceof Error ? err.message : "Could not save shipment changes." });
      // If update fails, clear the ref to prevent incorrect PDF trigger on next effect run
      // previousShipmentStatusRef.current = undefined; // This will be reset in the PDF effect's finally block
      console.log(`[ShipmentDetailPage] handleUpdateShipment: Error during update. previousShipmentStatusRef.current is still: ${previousShipmentStatusRef.current}`);
    }
  };

  useEffect(() => {
    console.log(`[ShipmentDetailPage] PDF Effect triggered. Current shipment: ${shipment ? `ID: ${shipment.id}, Status: ${shipment.status}` : 'null'}. previousShipmentStatusRef.current was: ${previousShipmentStatusRef.current}`);

    const wasPending = previousShipmentStatusRef.current === 'Pending';
    const isCompleted = shipment?.status === 'Completed';

    const shouldGeneratePdfs = shipment && wasPending && isCompleted;
    
    console.log(`[ShipmentDetailPage] PDF Effect: Checking condition: (shipment exists: ${!!shipment}) AND (previousShipmentStatusRef.current === 'Pending': ${wasPending}) AND (shipment.status === 'Completed': ${isCompleted}). Overall: ${shouldGeneratePdfs}`);

    if (shouldGeneratePdfs) {
      // Synchronously mark this transition as being processed to prevent re-entry if effect runs again quickly
      previousShipmentStatusRef.current = 'processing_pdf'; 
      console.log(`[ShipmentDetailPage] PDF Effect: Condition MET for PDF generation. Shipment ID: ${shipment.id}. previousShipmentStatusRef.current changed to 'processing_pdf'.`);
      
      toast({
        title: 'Generating PDFs',
        description: 'Shipment completed. PDFs will be downloaded shortly.',
        duration: 7000,
      });
      
      (async () => {
        try {
          console.log('[ShipmentDetailPage] PDF Effect: Calling generatePreAlertPdf with shipment data...');
          await generatePreAlertPdf(shipment); 
          
          console.log('[ShipmentDetailPage] PDF Effect: Waiting 1000ms before generating CMR PDF...');
          await delay(1000); 

          console.log('[ShipmentDetailPage] PDF Effect: Calling generateCmrPdf with shipment data...');
          await generateCmrPdf(shipment); 
          
          console.log('[ShipmentDetailPage] PDF Effect: PDF generation calls ostensibly complete.');
        } catch(pdfError) {
          console.error("[ShipmentDetailPage] PDF Effect: Error during PDF generation functions:", pdfError);
          toast({
            variant: "destructive",
            title: "PDF Generation Failed",
            description: pdfError instanceof Error ? pdfError.message : "Could not generate PDFs."
          });
        } finally {
            console.log('[ShipmentDetailPage] PDF Effect (async IIFE finally): Resetting previousShipmentStatusRef.current from', previousShipmentStatusRef.current, 'to undefined.');
            previousShipmentStatusRef.current = undefined;
        }
      })();
    } else {
      console.log(`[ShipmentDetailPage] PDF Effect: Condition NOT MET. Shipment ID: ${shipment?.id}, Current Status: ${shipment?.status}, Previous Status from Ref was: ${previousShipmentStatusRef.current}`);
      // If the condition was not met, but the ref indicates processing or was pending and current is not completed, reset it.
      // This handles cases where the ref might have been 'processing_pdf' or 'Pending' but the shipment status didn't end up 'Completed'.
      if (previousShipmentStatusRef.current === 'processing_pdf' || 
         (previousShipmentStatusRef.current === 'Pending' && shipment?.status !== 'Completed')) {
         console.log('[ShipmentDetailPage] PDF Effect (Condition NOT MET branch): Resetting previousShipmentStatusRef.current from', previousShipmentStatusRef.current, 'to undefined.');
         previousShipmentStatusRef.current = undefined;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipment, toast]); // previousShipmentStatusRef is a ref, not needed in deps. toast is stable.

  if (isLoading) {
    console.log("[ShipmentDetailPage] Rendering: Loading state.");
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] space-y-4 p-4 md:p-6 lg:p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading shipment details...</p>
      </div>
    );
  }

  if (error) {
     console.log("[ShipmentDetailPage] Rendering: Error state -", error);
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Shipment</AlertTitle>
          <AlertDescription>
            {error}
            <Button variant="outline" size="sm" onClick={() => fetchShipment()} className="mt-4 ml-2">
             Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!shipment) {
    console.log("[ShipmentDetailPage] Rendering: No shipment data (after loading and no error). This might mean notFound() was or should have been called.");
    return (
       <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Alert variant="default" className="border-yellow-500 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-700" />
          <AlertTitle className="text-yellow-800">Shipment Information Unavailable</AlertTitle>
          <AlertDescription className="text-yellow-700">
            The shipment data could not be loaded. This might be due to an invalid ID or a temporary issue.
            If you navigated here from a link, please ensure the shipment ID is correct.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  console.log("[ShipmentDetailPage] Rendering: Main content with shipment data. isEditing:", isEditing);
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
            { (shipment.status === 'Pending' || isAdmin) && !isEditing && (
              <Button onClick={() => { console.log("[ShipmentDetailPage] Edit Main Info button clicked."); setIsEditing(true);}} variant="outline">
                <Edit className="mr-2 h-4 w-4" /> Edit Main Info
              </Button>
            )}
            {isEditing && (
              <Button onClick={() => { console.log("[ShipmentDetailPage] Cancel Edit button clicked."); setIsEditing(false);}} variant="ghost">
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
             onSaveSuccess={async (savedShipmentId) => { 
               console.log(`[ShipmentDetailPage] ShipmentForm onSaveSuccess called for ${savedShipmentId}. Refetching shipment.`);
               await fetchShipment(false); 
             }}
          />
        </CardContent>
      </Card>

      <ShipmentDetailsList shipmentId={shipment.id} parentStatus={shipment.status} />
    </div>
  );
}
    
