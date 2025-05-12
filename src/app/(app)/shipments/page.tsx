
"use client";

import { useState, useEffect } from 'react';
import { getAllShipments, deleteShipment } from '@/lib/firebase/shipmentsService';
import type { Shipment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Edit, Trash2, AlertTriangle, Eye } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SearchFilterBar from '@/components/shipments/search-filter-bar'; // Assuming this will be created
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

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [filteredShipments, setFilteredShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const fetchShipments = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getAllShipments();
        setShipments(data);
        setFilteredShipments(data); // Initially show all
      } catch (err) {
        console.error("Error fetching shipments:", err);
        setError(err instanceof Error ? err.message : "Failed to load shipments.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchShipments();
  }, []);

  const handleFilter = (filters: any) => {
    // Basic filtering example (expand as needed)
    let result = shipments;
    if (filters.status) {
      result = result.filter(s => s.status === filters.status);
    }
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter(s =>
        s.carrierId?.toLowerCase().includes(term) || // Assuming carrierId is a string identifier
        s.driverName?.toLowerCase().includes(term) ||
        s.id.toLowerCase().includes(term) // Search by ID?
      );
    }
    // Add date range filtering etc.
    setFilteredShipments(result);
  };

 const handleDelete = async (id: string) => {
    try {
      await deleteShipment(id);
      toast({ title: "Shipment Deleted", description: `Shipment ${id} removed successfully.` });
      // Refetch or filter local state
      const updatedShipments = shipments.filter(s => s.id !== id);
      setShipments(updatedShipments);
      setFilteredShipments(updatedShipments); // Update filtered list too
    } catch (error: any) {
      console.error("Error deleting shipment:", error);
      toast({
        title: 'Deletion Failed',
        description: error.message || 'Could not delete shipment.',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (timestamp: Timestamp | Date | undefined): string => {
    if (!timestamp) return 'N/A';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
    return date.toLocaleDateString();
  };


  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Shipments</h1>
        <Link href="/shipments/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Shipment
          </Button>
        </Link>
      </div>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle>Manage Shipments</CardTitle>
          <CardDescription>View, filter, and manage all your shipments.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Bar (Placeholder) */}
           <SearchFilterBar onFilterChange={handleFilter} />


           {isLoading && (
                <div className="space-y-4 mt-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            )}
            {error && (
                 <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error Loading Shipments</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                 </Alert>
             )}

          {!isLoading && !error && (
            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Arrival</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShipments.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                           No shipments found.
                        </TableCell>
                    </TableRow>
                ) : (
                    filteredShipments.map((shipment) => (
                    <TableRow key={shipment.id}>
                        <TableCell className="font-medium truncate max-w-[100px]"><Link href={`/shipments/${shipment.id}`} className='hover:underline'>{shipment.id}</Link></TableCell>
                        <TableCell>{shipment.carrierId}</TableCell> {/* Replace with actual carrier name later */}
                        <TableCell>{shipment.driverName}</TableCell>
                        <TableCell>{formatDate(shipment.departureDate)}</TableCell>
                        <TableCell>{formatDate(shipment.arrivalDate)}</TableCell>
                        <TableCell>
                        <Badge variant={shipment.status === 'Completed' ? 'default' : 'secondary'} className={shipment.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                            {shipment.status}
                        </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                           <div className="flex justify-end space-x-1">
                             <Link href={`/shipments/${shipment.id}`}>
                               <Button variant="ghost" size="icon" title="View Details">
                                 <Eye className="h-4 w-4" />
                               </Button>
                             </Link>
                             {/* Edit might navigate to the detail page with edit mode enabled */}
                             {/* <Link href={`/shipments/${shipment.id}?edit=true`}> */}
                             {/*   <Button variant="ghost" size="icon" title="Edit"> */}
                             {/*     <Edit className="h-4 w-4" /> */}
                             {/*   </Button> */}
                             {/* </Link> */}
                              <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Delete">
                                          <Trash2 className="h-4 w-4" />
                                      </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                      <AlertDialogHeader>
                                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                              This action cannot be undone. This will permanently delete shipment <strong>{shipment.id}</strong> and potentially its details (if implemented).
                                          </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                              onClick={() => handleDelete(shipment.id)}
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                              Delete
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
           )}
          {/* TODO: Add Pagination if needed */}
        </CardContent>
      </Card>
    </div>
  );
}

```