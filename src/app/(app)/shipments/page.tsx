
"use client";

import { useState, useEffect, useCallback } from 'react';
import { getAllShipments, deleteShipment, getShipmentDetailsCount } from '@/lib/firebase/shipmentsService'; 
import type { Shipment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Eye, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SearchFilterBar from '@/components/shipments/search-filter-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

const formatDate = (timestamp: Timestamp | Date | undefined): string => {
    if (!timestamp) return 'N/A';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
    try {
        return format(date, "P"); 
    } catch (error) {
        console.error("Error formatting date:", error);
        return 'Invalid Date';
    }
};


export default function ShipmentsPage() {
  const [allShipments, setAllShipments] = useState<Shipment[]>([]); 
  const [filteredShipments, setFilteredShipments] = useState<Shipment[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser } = useAuth(); 

  const isAdmin = currentUser?.role === 'admin';

  const fetchShipments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAllShipments();
      setAllShipments(data);
      setFilteredShipments(data); 
    } catch (err) {
      console.error("Error fetching shipments:", err);
      setError(err instanceof Error ? err.message : "Failed to load shipments.");
      setAllShipments([]); 
      setFilteredShipments([]);
    } finally {
      setIsLoading(false);
    }
  }, []); 

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]); 

  const handleFilter = useCallback((filters: any) => {
    let result = allShipments;

    if (filters.status) {
      result = result.filter(s => s.status === filters.status);
    }

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase().trim();
      if (term) {
        result = result.filter(s =>
          (s.id || '').toLowerCase().includes(term) ||
          (s.carrierId || '').toLowerCase().includes(term) ||
          (s.driverName || '').toLowerCase().includes(term)
        );
      }
    }

     if (filters.startDate) {
         const start = filters.startDate.getTime();
         result = result.filter(s => s.departureDate && s.departureDate.toDate().getTime() >= start);
     }
     if (filters.endDate) {
         const end = new Date(filters.endDate);
         end.setHours(23, 59, 59, 999);
         const endTime = end.getTime();
         result = result.filter(s => s.departureDate && s.departureDate.toDate().getTime() <= endTime);
     }

     if (filters.customerId) {
         console.warn("Client-side filtering by customer is not implemented due to performance concerns.");
     }

      if (filters.carrierId) {
        result = result.filter(s => s.carrierId === filters.carrierId);
      }

    setFilteredShipments(result);
  }, [allShipments]); 

 const handleDelete = async (shipmentToConfirmDelete: Shipment) => {
    if (!shipmentToConfirmDelete) return;
    const { id, status } = shipmentToConfirmDelete;

    if (status === 'Completed' && !isAdmin) {
      toast({
        variant: "destructive",
        title: "Deletion Denied",
        description: "Completed shipments can only be deleted by an administrator.",
      });
      return;
    }

    try {
      const detailsCount = await getShipmentDetailsCount(id);
      if (detailsCount > 0) {
        toast({
          variant: "destructive",
          title: "Deletion Prevented",
          description: `Shipment ${id} has ${detailsCount} item(s). Please remove all items before deleting the shipment.`,
        });
        return;
      }

      await deleteShipment(id);
      toast({ title: "Shipment Deleted", description: `Shipment ${id} removed successfully.` });
      setAllShipments(prev => prev.filter(s => s.id !== id));
      setFilteredShipments(prev => prev.filter(s => s.id !== id)); 
    } catch (error: any) {
      console.error("Error deleting shipment:", error);
      toast({
        title: 'Deletion Failed',
        description: error.message || 'Could not delete shipment.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Shipments</h1>
        <Link href="/shipments/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Shipment
          </Button>
        </Link>
      </div>

      <Card className="shadow-lg rounded-xl border">
        <CardHeader>
          <CardTitle>Manage Shipments</CardTitle>
          <CardDescription>View, filter, and manage all your shipments.</CardDescription>
        </CardHeader>
        <CardContent>
           <SearchFilterBar onFilterChange={handleFilter} />

           {isLoading && (
                <div className="space-y-4 mt-6">
                    <Skeleton className="h-12 w-full rounded-md" />
                    <Skeleton className="h-12 w-full rounded-md" />
                    <Skeleton className="h-12 w-full rounded-md" />
                </div>
            )}

            {error && !isLoading && (
                 <Alert variant="destructive" className="mt-6">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error Loading Shipments</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                     <Button variant="outline" size="sm" onClick={fetchShipments} className="mt-4">
                         Retry
                     </Button>
                 </Alert>
             )}

            {!isLoading && !error && (
                <div className="mt-6 overflow-x-auto">
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-[120px]">Link</TableHead>
                        <TableHead>Carrier</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Departure</TableHead>
                        <TableHead>Arrival</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredShipments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                No shipments found matching your criteria.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredShipments.map((shipment) => (
                            <TableRow key={shipment.id} className="hover:bg-muted/50">
                                <TableCell className="font-medium truncate max-w-[120px]">
                                    <Link href={`/shipments/${shipment.id}`} className='hover:underline text-primary'>
                                        View Details
                                    </Link>
                                </TableCell>
                                <TableCell>{shipment.carrierId}</TableCell>
                                <TableCell>{shipment.driverName}</TableCell>
                                <TableCell>{formatDate(shipment.departureDate)}</TableCell>
                                <TableCell>{formatDate(shipment.arrivalDate)}</TableCell>
                                <TableCell>
                                <Badge variant={shipment.status === 'Completed' ? 'default' : 'secondary'} className={shipment.status === 'Completed' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}>
                                    {shipment.status}
                                </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                <div className="flex justify-end space-x-1">
                                    <Link href={`/shipments/${shipment.id}`}>
                                    <Button variant="ghost" size="icon" title="View Details">
                                        <Eye className="h-4 w-4" />
                                        <span className="sr-only">View</span>
                                    </Button>
                                    </Link>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="text-destructive hover:text-destructive hover:bg-destructive/10" 
                                              title="Delete"
                                              disabled={(shipment.status === 'Completed' && !isAdmin)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                 <span className="sr-only">Delete</span>
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently delete the shipment referred to as &apos;{shipment.driverName} - {shipment.carrierId}&apos;.
                                                    {(shipment.status === 'Completed' && !isAdmin) && " Regular users cannot delete completed shipments."}
                                                    {(shipment.status === 'Completed' && isAdmin) && " This is a completed shipment."}
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => handleDelete(shipment)}
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    disabled={(shipment.status === 'Completed' && !isAdmin)}
                                                >
                                                    Delete Shipment
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                                </TableCell>
                            </TableRow>
                            ))
                        )}
                    </TableBody>
                    </Table>
                </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
