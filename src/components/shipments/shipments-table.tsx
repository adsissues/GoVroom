
"use client";

import type { Shipment } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Edit3, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ClientFormattedDate from '@/components/shared/client-formatted-date';

interface ShipmentsTableProps {
  shipments: Shipment[];
  onViewDetails?: (shipmentId: string) => void;
  onEdit?: (shipmentId: string) => void;
  onDelete?: (shipmentId:string) => void;
}

export function ShipmentsTable({ shipments, onViewDetails, onEdit, onDelete }: ShipmentsTableProps) {
  if (!shipments || shipments.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No shipments found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Carrier</TableHead>
            <TableHead>Driver Name</TableHead>
            <TableHead>Departure</TableHead>
            <TableHead>Arrival</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.map((shipment) => (
            <TableRow key={shipment.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">{shipment.carrier}</TableCell>
              <TableCell>{shipment.driverName}</TableCell>
              <TableCell><ClientFormattedDate date={shipment.departureDate} /></TableCell>
              <TableCell><ClientFormattedDate date={shipment.arrivalDate} /></TableCell>
              <TableCell>
                <Badge
                  variant={shipment.status === 'Completed' ? 'default' : 'secondary'}
                  className={cn(
                    shipment.status === 'Completed' ? 'bg-accent text-accent-foreground' : 'bg-orange-400 text-white',
                    "font-semibold"
                  )}
                >
                  {shipment.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                {onViewDetails && (
                  <Button variant="ghost" size="icon" onClick={() => onViewDetails(shipment.id)} title="View Details">
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                {onEdit && (
                  <Button variant="ghost" size="icon" onClick={() => onEdit(shipment.id)} title="Edit">
                    <Edit3 className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                   <Button variant="ghost" size="icon" onClick={() => onDelete(shipment.id)} className="text-destructive hover:text-destructive" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
