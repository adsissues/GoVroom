
"use client";

import type { ShipmentDetail } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit3, Trash2 } from "lucide-react";
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
}

export default function ShipmentDetailCard({ detail, onEdit, onDelete }: ShipmentDetailCardProps) {
  return (
    <Card className="shadow-md rounded-lg w-full">
      <CardHeader>
        <CardTitle className="text-lg">
          Detail ID: <span className="font-normal text-sm">{detail.id.substring(0, 8)}...</span>
        </CardTitle>
        <CardDescription>
          Customer: {detail.customer} | Service: {detail.service}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p><strong>Pallets:</strong> {detail.numberOfPallets}</p>
        {detail.numberOfBags !== undefined && <p><strong>Bags:</strong> {detail.numberOfBags}</p>}
        {detail.format && <p><strong>Format:</strong> {detail.format}</p>}
        <p><strong>Tare Weight:</strong> {detail.tareWeight?.toFixed(3)} kg</p>
        <p><strong>Gross Weight:</strong> {detail.grossWeight?.toFixed(3)} kg</p>
        {detail.dispatchNumber && <p><strong>Dispatch #:</strong> {detail.dispatchNumber}</p>}
        {detail.doe && <p><strong>DOE:</strong> {detail.doe}</p>}
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(detail)}>
          <Edit3 className="mr-2 h-4 w-4" /> Edit
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this shipment detail.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(detail.id)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
