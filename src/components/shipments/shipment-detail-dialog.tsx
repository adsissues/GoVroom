
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ShipmentDetailForm from "./shipment-detail-form";
import type { ShipmentDetail } from "@/lib/types";
import { addShipmentDetailToFirestore, updateShipmentDetailInFirestore } from "@/lib/firebase/shipmentDetails";
import { useToast } from "@/hooks/use-toast";
// No longer need useState here as it's controlled by parent

interface ShipmentDetailDialogProps {
  shipmentId: string;
  detail?: ShipmentDetail; 
  children: React.ReactNode; 
  onSuccess: () => void; 
  isOpen: boolean; // Added prop to control dialog open state
  onOpenChange: (isOpen: boolean) => void; // Added prop to handle open state changes
}

export default function ShipmentDetailDialog({ 
  shipmentId, 
  detail, 
  children, 
  onSuccess,
  isOpen, 
  onOpenChange 
}: ShipmentDetailDialogProps) {
  const { toast } = useToast();

  const handleFormSubmit = async (formData: ShipmentDetail) => { 
    try {
      if (detail?.id) { 
        await updateShipmentDetailInFirestore(shipmentId, detail.id, formData);
      } else { 
        await addShipmentDetailToFirestore(shipmentId, formData);
      }
      onSuccess(); 
      onOpenChange(false); // Close dialog using the prop
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{detail ? "Edit Shipment Detail" : "Add New Shipment Detail"}</DialogTitle>
          <DialogDescription>
            {detail ? "Update the information for this shipment detail." : "Fill in the form below to add a new detail to this shipment."}
          DialogDescription>
        DialogHeader>
        ShipmentDetailForm
          shipmentId={shipmentId}
          initialData={detail}
          onSubmitSuccess={handleFormSubmit}
          onCancel={() => onOpenChange(false)} // Close dialog using the prop
        />
      DialogContent>
    Dialog>
  );
}
