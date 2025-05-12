
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ShipmentDetailForm, { type ShipmentDetailFormData } from "./shipment-detail-form";
import type { ShipmentDetail } from "@/lib/types";
import { addShipmentDetailToFirestore, updateShipmentDetailInFirestore } from "@/lib/firebase/shipmentDetails";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface ShipmentDetailDialogProps {
  shipmentId: string;
  detail?: ShipmentDetail; // For editing existing detail
  children: React.ReactNode; // Trigger element for the dialog
  onSuccess: () => void; // Callback to refresh data after successful operation
}

export default function ShipmentDetailDialog({ shipmentId, detail, children, onSuccess }: ShipmentDetailDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const handleFormSubmit = async (formData: ShipmentDetail) => { // formData is already ShipmentDetail type from form
    try {
      if (detail?.id) { // Editing existing detail
        await updateShipmentDetailInFirestore(shipmentId, detail.id, formData);
      } else { // Adding new detail
        await addShipmentDetailToFirestore(shipmentId, formData);
      }
      onSuccess(); // Refresh parent data
      setIsOpen(false); // Close dialog
      // Toast is handled within ShipmentDetailForm now
    } catch (error) {
      console.error("Error in dialog submission:", error);
      toast({
        title: "Operation Failed",
        description: error instanceof Error ? error.message : "Could not save the shipment detail.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{detail ? "Edit Shipment Detail" : "Add New Shipment Detail"}</DialogTitle>
          <DialogDescription>
            {detail ? "Update the information for this shipment detail." : "Fill in the form below to add a new detail to this shipment."}
          </DialogDescription>
        </DialogHeader>
        <ShipmentDetailForm
          shipmentId={shipmentId}
          initialData={detail}
          onSubmitSuccess={handleFormSubmit}
          onCancel={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
