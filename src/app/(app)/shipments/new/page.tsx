
"use client";

import { useState } from 'react';
import ShipmentForm from '@/components/shipments/shipment-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { addShipment } from '@/lib/firebase/shipmentsService';
import type { Shipment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NewShipmentPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { currentUser } = useAuth(); // Get current user for isAdmin check

  // Determine if the current user is an admin
  const isAdmin = currentUser?.role === 'admin';

  const handleCreateShipment = async (data: Partial<Shipment>): Promise<string | void> => {
    try {
        // Ensure required fields that might be missing from Partial are handled by service/defaults
        // The ShipmentForm should enforce required fields via Zod schema
        const newShipmentId = await addShipment(data as any); // Cast needed as addShipment expects more specific type
        toast({
            title: 'Shipment Created',
            description: `Shipment ${newShipmentId} added successfully. You can now add details.`,
        });
        // Navigate to the newly created shipment's detail page
        router.push(`/shipments/${newShipmentId}`);
        return newShipmentId; // Return the ID
    } catch (error: any) {
        console.error("Error creating shipment:", error);
        toast({
            title: 'Creation Failed',
            description: error.message || 'Could not create the new shipment.',
            variant: 'destructive',
        });
        // Re-throw or handle error state if needed
         throw error; // Re-throw to indicate failure to the form if it needs to know
    }
  };

  return (
    <div className="space-y-6">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shipments
        </Button>
      <Card className="shadow-lg rounded-xl border">
        <CardHeader>
          <CardTitle className="text-2xl">Add New Shipment</CardTitle>
          <CardDescription>
            Fill in the main details for the new shipment. You can add specific items after saving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Pass isAdmin prop and the creation handler */}
          {/* InitialData is null/undefined for new shipments */}
          {/* isEditing is true by default for new shipments */}
          <ShipmentForm
            isAdmin={isAdmin}
            onSubmit={handleCreateShipment}
            // onSaveSuccess is handled by the redirect within handleCreateShipment
          />
        </CardContent>
      </Card>
    </div>
  );
}
