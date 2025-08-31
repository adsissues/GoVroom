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
  const [isShowingFullDetails, setIsShowingFullDetails] = useState(false);
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
      console.log(`[ShipmentDetailPage] State updated with fetched data. descriptionOfGoods: ${fetchedShipmentData.descriptionOfGoods}`);
      console.log(`[ShipmentDetailPage] Fetched shipment data descriptionOfGoods: ${fetchedShipmentData?.descriptionOfGoods}`);
      if (fetchedShipmentData) {
        console.log("[ShipmentDetailPage] fetchShipment: Successfully fetched shipment data:", JSON.stringify(fetchedShipmentData).substring(0, 300) + "...");
        setShipment(fetchedShipmentData);
        if (showLoadingIndicator) setIsLoading(false);
        return fetchedShipmentData;
      } else {
        console.log(`[ShipmentDetailPage] fetchShipment: No shipment found for ID ${shipmentId}.`);
        if (showLoadingIndicator) setIsLoading(false);
        setShipment(null);
        setError('Shipment not found');
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
    
    if (data.status && data.status !== shipment.status) {
      console.log(`[ShipmentDetailPage] handleUpdateShipment: Status change detected. FROM ${shipment.status} TO ${data.status}. Setting previousShipmentStatusRef.current to: ${shipment.status}`);
      previousShipmentStatusRef.current = shipment.status;
    } else {
      console.log(`[ShipmentDetailPage] handleUpdateShipment: No status change or status field not present. previousShipmentStatusRef remains: ${previousShipmentStatusRef.current}`);
    }
    
    try {
      await updateShipment(shipmentId, data);
      toast({ title: "Shipment Updated", description: "Main shipment details saved successfully." });
      
      console.log('[ShipmentDetailPage] handleUpdateShipment: Update successful. Refetching shipment...');
      const updatedShipment = await fetchShipment(false);
      console.log('[ShipmentDetailPage] handleUpdateShipment: Refetched shipment data:', updatedShipment ? JSON.stringify(updatedShipment).substring(0, 300) + "..." : "null/undefined");
      
      setIsEditing(false);

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
    
    console.log(`[ShipmentDetailPage] PDF Effect: Condition check: shouldGeneratePdfs=${shouldGeneratePdfs}`);

    if (shouldGeneratePdfs && shipment) {
      previousShipmentStatusRef.current = 'processing_pdf'; 
      console.log(`[ShipmentDetailPage] PDF Effect: Generating PDFs for shipment ID ${shipment.id}`);

      toast({
        title: 'Generating PDFs',
        description: 'Shipment completed. PDFs will be downloaded shortly.',
        duration: 7000,
      });

      (async () => {
        try {
          console.log('[ShipmentDetailPage] PDF Effect: Calling generatePreAlertPdf...');
          await generatePreAlertPdf(shipment); 
          
          await delay(1000); 

          console.log('[ShipmentDetailPage] PDF Effect: Calling generateCmrPdf...');
          await generateCmrPdf(shipment); 
          
          const recipients = 'customs@example.com,client@example.com';
          const subject = `Dispatch Pre-Alert – Truck ${shipment.truckRegNo || shipment.id}`;
          const body = 'Please find attached the Pre-Alert and CMR for this dispatch.';
          const mailtoUrl = `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          
          console.log('[ShipmentDetailPage] PDF Effect: Opening email client with mailto URL:', mailtoUrl);
          window.open(mailtoUrl);
          
        } catch(pdfError) {
          console.error("[ShipmentDetailPage] PDF Effect: PDF generation error:", pdfError);
          toast({
            variant: "destructive",
            title: "PDF Generation Failed",
            description: pdfError instanceof Error ? pdfError.message : "Could not generate PDFs."
          });
        } finally {
          console.log('[ShipmentDetailPage] PDF Effect: Resetting previousShipmentStatusRef.current to undefined.');
          previousShipmentStatusRef.current = undefined;
        }
      })();
    } else {
      console.log(`[ShipmentDetailPage] PDF Effect: Condition NOT MET.`);
      if (previousShipmentStatusRef.current === 'processing_pdf' || 
          (previousShipmentStatusRef.current === 'Pending' && shipment?.status !== 'Completed')) {
        previousShipmentStatusRef.current = undefined;
      }
    }
  }, [shipment, toast]);

  const handleToggleFullDetails = () => {
    setIsShowingFullDetails(prev => !prev);
    if (isEditing && isShowingFullDetails) setIsEditing(false);
  };

  const handleEditMainInfo = () => {
    console.log("[ShipmentDetailPage] Edit Main Info button clicked.");
    setIsShowingFullDetails(true);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    console.log("[ShipmentDetailPage] Cancel Edit button clicked.");
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] space-y-4 p-4 md:p-6 lg:p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading shipment details...</p>
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

  if (!shipment && !isLoading && error === 'Shipment not found') {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Alert variant="default" className="border-yellow-500 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-700" />
          <AlertTitle className="text-yellow-800">Shipment Information Unavailable</AlertTitle>
          <AlertDescription className="text-yellow-700">
            The requested shipment could not be found. It might have been deleted or the ID in the URL is incorrect.
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
            <CardTitle className="text-xl md:text-2xl">
              Shipment: <span className="font-mono text-lg text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{shipment?.id}</span>
            </CardTitle>
            {shipment?.status === 'Completed' && !isEditing && (
              <p className="text-sm text-green-600 mt-1 italic">This shipment is completed.</p>
            )}
            {shipment?.status === 'Completed' && isEditing && isAdmin && (
              <p className="text-sm text-amber-600 mt-1 italic">Shipment is completed. Editing enabled for Admin.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={handleToggleFullDetails} variant="outline" size="sm">
              {isShowingFullDetails ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {isShowingFullDetails ? 'Hide Main Details' : 'View Main Details'}
            </Button>
            { (shipment?.status === 'Pending' || shipment?.status === 'Completed' || isAdmin) && (
              <Button
                onClick={handleEditMainInfo} 
                variant="default" 
                size="sm" 
                disabled={isEditing && isShowingFullDetails}
              >
                <Edit className="mr-2 h-4 w-4" /> Edit Main Info
              </Button>
            )}
            {isEditing && isShowingFullDetails && (
              <Button onClick={handleCancelEdit} variant="ghost" size="sm">
                <XCircle className="mr-2 h-4 w-4" /> Cancel Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isShowingFullDetails && shipment && <ShipmentSummary shipment={shipment} />}
          {isShowingFullDetails && shipment && (
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
          )}
        </CardContent>
      </Card>

      {shipment && <ShipmentDetailsList shipmentId={shipment.id} parentStatus={shipment.status} />}
    </div>
  );
}
