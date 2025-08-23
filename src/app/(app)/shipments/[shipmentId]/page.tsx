
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
import { ArrowLeft, AlertTriangle, Loader2, Edit, XCircle, Eye, EyeOff } from 'lucide-react';
import ShipmentForm from '@/components/shipments/shipment-form';
import ShipmentSummary from '@/components/shipments/shipment-summary';
import ShipmentDetailsList from '@/components/shipments/shipment-details-list';
import type { Timestamp } from 'firebase/firestore';
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
  const [isShowingFullDetails, setIsShowingFullDetails] = useState(false); // New state
  const [error, setError] = useState<string | null>(null);
  
  const previousShipmentStatusRef = useRef<ShipmentStatus | undefined | 'processing_pdf'>(undefined);

  const isAdmin = currentUser?.role === 'admin';
  const canEditForm = isEditing && isShowingFullDetails;

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
        notFound(); // This should trigger Next.js 404 page
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
    
    // Capture previous status only if status is part of the update and is different
    if (data.status && data.status !== shipment.status) {
      console.log(`[ShipmentDetailPage] handleUpdateShipment: Status change detected. FROM ${shipment.status} TO ${data.status}. Setting previousShipmentStatusRef.current to: ${shipment.status}`);
      previousShipmentStatusRef.current = shipment.status;
    } else {
      console.log(`[ShipmentDetailPage] handleUpdateShipment: No status change in this update OR status field not present in update. Current: ${shipment.status}, Update data.status: ${data.status}. previousShipmentStatusRef will remain: ${previousShipmentStatusRef.current}`);
      // Ensure ref is cleared if no relevant status change, to prevent stale triggers
      // This might need adjustment based on desired PDF trigger re-evaluation logic
    }
    
    try {
      await updateShipment(shipmentId, data);
      toast({ title: "Shipment Updated", description: "Main shipment details saved successfully." });
      
      console.log('[ShipmentDetailPage] handleUpdateShipment: Update successful. Refetching shipment...');
      const updatedShipment = await fetchShipment(false); 
      console.log('[ShipmentDetailPage] handleUpdateShipment: Refetched shipment data after update:', updatedShipment ? JSON.stringify(updatedShipment).substring(0, 300) + "..." : "null/undefined");
      
      setIsEditing(false); // Exit edit mode after successful save

    } catch (err) {
      console.error("[ShipmentDetailPage] handleUpdateShipment: Error updating shipment:", err);
      toast({ variant: "destructive", title: "Update Failed", description: err instanceof Error ? err.message : "Could not save shipment changes." });
       console.log(`[ShipmentDetailPage] handleUpdateShipment: Error during update. previousShipmentStatusRef.current is still: ${previousShipmentStatusRef.current}`);
    }
  };

  useEffect(() => {
    console.log(`[ShipmentDetailPage] PDF Effect triggered. Current shipment: ${shipment ? `ID: ${shipment.id}, Status: ${shipment.status}` : 'null'}. previousShipmentStatusRef.current was: ${previousShipmentStatusRef.current}`);

    const wasPending = previousShipmentStatusRef.current === 'Pending';
    const isNowCompleted = shipment?.status === 'Completed';

    const shouldGeneratePdfs = shipment && wasPending && isNowCompleted;
    
    console.log(`[ShipmentDetailPage] PDF Effect: Checking condition: (shipment exists: ${!!shipment}) AND (previousShipmentStatusRef.current === 'Pending': ${wasPending}) AND (shipment.status === 'Completed': ${isNowCompleted}). Overall: ${shouldGeneratePdfs}`);

    if (shouldGeneratePdfs) {
      // Synchronously mark this transition as being processed to prevent re-entry
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

          // Open Outlook with pre-filled email
          const recipients = 'customs@example.com,client@example.com';
          const subject = `Dispatch Pre-Alert – Truck ${shipment.truckRegNo || shipment.id}`; // Fallback to ID if reg no is missing
          const body = 'Please find attached the Pre-Alert and CMR for this dispatch.';
          
          const mailtoUrl = `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          
          // Note: window.open(mailto:...) cannot reliably attach files across browsers.
          // The user will need to manually attach the generated PDF files from their downloads.
          console.log('[ShipmentDetailPage] PDF Effect: Opening email client with mailto URL:', mailtoUrl);
 window.open(mailtoUrl);
          
        } catch(pdfError) {
          console.error("[ShipmentDetailPage] PDF Effect: Error during PDF generation functions:", pdfError);
          toast({
            variant: "destructive",
            title: "PDF Generation Failed",
            description: pdfError instanceof Error ? pdfError.message : "Could not generate PDFs."
          });
        } finally {
            console.log('[ShipmentDetailPage] PDF Effect (async IIFE finally): Resetting previousShipmentStatusRef.current from', previousShipmentStatusRef.current, 'to undefined.');
            previousShipmentStatusRef.current = undefined; // Reset after PDF generation attempt
        }
      })();
    } else {
        console.log(`[ShipmentDetailPage] PDF Effect: Condition NOT MET. Details - Shipment ID: ${shipment?.id}, Current Status: ${shipment?.status}, Previous Status from Ref was: ${previousShipmentStatusRef.current}`);
        // If the condition was not met, but the ref indicates processing or was pending and current is not completed, reset it.
        if (previousShipmentStatusRef.current === 'processing_pdf' || 
           (previousShipmentStatusRef.current === 'Pending' && shipment?.status !== 'Completed')) {
           console.log('[ShipmentDetailPage] PDF Effect (Condition NOT MET branch): Resetting previousShipmentStatusRef.current from', previousShipmentStatusRef.current, 'to undefined.');
           previousShipmentStatusRef.current = undefined;
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipment, toast]); // previousShipmentStatusRef is a ref, not needed in deps. toast is stable.

  const handleToggleFullDetails = () => {
    setIsShowingFullDetails(prev => !prev);
    if (isEditing && isShowingFullDetails) { // If hiding details while editing, cancel edit mode
        setIsEditing(false);
    }
  };

  const handleEditMainInfo = () => {
    console.log("[ShipmentDetailPage] Edit Main Info button clicked.");
    setIsShowingFullDetails(true); // Ensure full details are shown when editing
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    console.log("[ShipmentDetailPage] Cancel Edit button clicked.");
    setIsEditing(false);
    // Decide if full details should also be hidden on cancel. For now, keep them.
    // setIsShowingFullDetails(false); 
  };


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
    // This case should ideally be handled by notFound() inside fetchShipment
    // or if shipmentId was invalid from the start.
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

  console.log("[ShipmentDetailPage] Rendering: Main content with shipment data. isShowingFullDetails:", isShowingFullDetails, "isEditing:", isEditing);
  return (
    <div className="space-y-6 md:space-y-8">
      <Button variant="outline" onClick={() => router.push('/shipments')} className="mb-0">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shipments List
      </Button>

      <Card className="shadow-lg rounded-xl border">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-xl md:text-2xl">
              Shipment: <span className="font-mono text-lg text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{shipment.id}</span>
            </CardTitle>
            {/* Message for completed shipments */}
            {shipment.status === 'Completed' && !isEditing && (
              <p className="text-sm text-green-600 mt-1 italic">This shipment is completed.</p>
            )}
            {shipment.status === 'Completed' && isEditing && isAdmin && (
              <p className="text-sm text-amber-600 mt-1 italic">Shipment is completed. Editing enabled for Admin.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={handleToggleFullDetails} variant="outline" size="sm">
              {isShowingFullDetails ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {isShowingFullDetails ? 'Hide Main Details' : 'View Main Details'}
            </Button>
            { (shipment.status === 'Pending' || shipment.status === 'Completed' || isAdmin) && ( // Edit button logic
              <Button
                onClick={handleEditMainInfo} 
                variant="default" 
                size="sm" 
                disabled={isEditing && isShowingFullDetails} // Disable if already editing full details
              >
                <Edit className="mr-2 h-4 w-4" /> Edit Main Info
              </Button>
            )}
            {isEditing && isShowingFullDetails && ( // Cancel button
              <Button onClick={handleCancelEdit} variant="ghost" size="sm">
                <XCircle className="mr-2 h-4 w-4" /> Cancel Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isShowingFullDetails && <ShipmentSummary shipment={shipment} />}
          {isShowingFullDetails && (
            <ShipmentForm
              isAdmin={isAdmin}
              initialData={shipment}
              onSubmit={handleUpdateShipment}
              isEditing={isEditing} // This is the crucial prop for ShipmentForm
              shipmentId={shipment.id}
              onSaveSuccess={async (savedShipmentId) => { 
               console.log(`[ShipmentDetailPage] ShipmentForm onSaveSuccess called for ${savedShipmentId}. Refetching shipment.`);
               await fetchShipment(false); 
               // setIsEditing(false); // This is handled by handleUpdateShipment
             }}
            />
          )}
        </CardContent>
      </Card>

      <ShipmentDetailsList shipmentId={shipment.id} parentStatus={shipment.status} />
    </div>
  );
}
