
"use client";

import type { ShipmentDetail } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit3, Trash2, Loader2 } from "lucide-react"; // Added Loader2
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ShipmentDetailCardProps {
  detail: ShipmentDetail;
  onEdit: (detail: ShipmentDetail) => void;
  onDelete: (detailId: string) => void;
  isDeleting?: boolean; // Optional prop to indicate if this specific item is being deleted
}

export default function ShipmentDetailCard({ detail, onEdit, onDelete, isDeleting = false }: ShipmentDetailCardProps) {
  const netWeight = (detail.grossWeight || 0) - (detail.tareWeight || 0);

  return (
    <Card className="shadow-md rounded-lg w-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg truncate">
          {detail.customer} - {detail.service}
        </CardTitle>
        <CardDescription className="text-xs">
          Detail ID: <span className="font-mono">{detail.id.substring(0, 6)}...</span> | DOE: {detail.doe || 'N/A'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm flex-grow">
        <p><strong>Pallets:</strong> {detail.numberOfPallets ?? 0}</p>
        {detail.numberOfBags !== undefined && <p><strong>Bags:</strong> {detail.numberOfBags ?? 0}</p>}
        {detail.format && <p><strong>Format:</strong> {detail.format}</p>}
        <p><strong>Tare Wt:</strong> {detail.tareWeight?.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) ?? '0.000'} kg</p>
        <p><strong>Gross Wt:</strong> {detail.grossWeight?.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) ?? '0.000'} kg</p>
        <p><strong>Net Wt:</strong> {netWeight.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</p>
        {detail.dispatchNumber && <p><strong>Dispatch #:</strong> {detail.dispatchNumber}</p>}
      </CardContent>
      <CardFooter className="flex justify-end space-x-2 border-t pt-4 mt-auto">
        <Button variant="outline" size="sm" onClick={() => onEdit(detail)} disabled={isDeleting}>
          <Edit3 className="mr-2 h-4 w-4" /> Edit
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={isDeleting}>
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this shipment detail for Customer: {detail.customer}, Service: {detail.service}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(detail.id)} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

