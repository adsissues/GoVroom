
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getShipmentsByStatus, getDashboardStats } from '@/lib/firebase/shipmentsService';
import type { Shipment } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DASHBOARD_STATS_MAP } from '@/lib/constants';
import { AlertTriangle, CheckCircle2, Package, User, Weight, Truck, List } from 'lucide-react'; // Added List
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';


// Helper function to format date strings robustly
const formatDateString = (dateInput: Date | Timestamp | string | null | undefined): string => {
    if (!dateInput) return 'N/A';
    try {
        const date = dateInput instanceof Timestamp ? dateInput.toDate() : new Date(dateInput);
        // Check if date is valid after conversion
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        return date.toLocaleDateString();
    } catch (e) {
        console.error("Error formatting date:", e);
        return 'Error';
    }
};

// Helper to format distance to now
const formatLastUpdated = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp) return 'never';
    try {
        return formatDistanceToNow(timestamp.toDate(), { addSuffix: true });
    } catch (e) {
        console.error("Error formatting relative time:", e);
        return 'Error';
    }
};


export default function DashboardPage() {
  const { currentUser } = useAuth();
  const [pendingShipments, setPendingShipments] = useState<Shipment[]>([]);
  const [completedShipments, setCompletedShipments] = useState<Shipment[]>([]);
  const [stats, setStats] = useState<{ pendingCount: number; completedCount: number; lastUpdateTimestamp: Timestamp | null }>({ pendingCount: 0, completedCount: 0, lastUpdateTimestamp: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize last updated string to prevent hydration issues if calculation is complex
  const clientLastUpdatedStatString = useMemo(() => {
    if (isLoading || !stats.lastUpdateTimestamp) return null; // Ensure calculation happens only when data is ready
    return formatLastUpdated(stats.lastUpdateTimestamp);
  }, [stats.lastUpdateTimestamp, isLoading]); // Recalculate only when timestamp or loading state changes


  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const [pendingData, completedData, dashboardStats] = await Promise.all([
          getShipmentsByStatus('Pending', 5), // Limit to 5 recent
          getShipmentsByStatus('Completed', 5), // Limit to 5 recent
          getDashboardStats(),
        ]);
        setPendingShipments(pendingData);
        setCompletedShipments(completedData);
        setStats(dashboardStats);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // Note: No real-time listeners here for simplicity/performance.
    // Could add listeners if real-time updates are crucial for dashboard lists.
  }, []);

  const StatCard = ({ title, value, icon: Icon, unit, bgColorClass, textColorClass }: { title: string, value: string | number, icon: React.ElementType, unit?: string, bgColorClass: string, textColorClass: string }) => (
     <Card className={`shadow-lg rounded-xl overflow-hidden ${bgColorClass}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={`text-sm font-medium ${textColorClass}`}>{title}</CardTitle>
          <Icon className={`h-5 w-5 ${textColorClass} opacity-80`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${textColorClass}`}>
            {value} {unit && <span className="text-xs font-normal">{unit}</span>}
          </div>
        </CardContent>
      </Card>
  );


  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
       <h1 className="text-3xl font-bold">Welcome, {currentUser?.email}!</h1>

       {/* Stats Section */}
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </>
          ) : error ? (
             <Alert variant="destructive" className="col-span-full">
                 <AlertTriangle className="h-4 w-4" />
                 <AlertTitle>Error Loading Stats</AlertTitle>
                 <AlertDescription>{error}</AlertDescription>
              </Alert>
          ) : (
            <>
              <StatCard title="Pending Shipments" value={stats.pendingCount} icon={DASHBOARD_STATS_MAP.pendingShipments.icon} bgColorClass={DASHBOARD_STATS_MAP.pendingShipments.bgColorClass} textColorClass={DASHBOARD_STATS_MAP.pendingShipments.textColorClass} />
              <StatCard title="Completed Shipments" value={stats.completedCount} icon={DASHBOARD_STATS_MAP.completedShipments.icon} bgColorClass={DASHBOARD_STATS_MAP.completedShipments.bgColorClass} textColorClass={DASHBOARD_STATS_MAP.completedShipments.textColorClass} />
              {/* Placeholder for Total Weight - needs aggregation */}
              {/* <StatCard title="Total Weight" value={"N/A"} icon={DASHBOARD_STATS_MAP.totalWeight.icon} unit="kg" bgColorClass={DASHBOARD_STATS_MAP.totalWeight.bgColorClass} textColorClass={DASHBOARD_STATS_MAP.totalWeight.textColorClass} /> */}
              {/* Placeholder for Active Carriers - needs aggregation */}
              {/* <StatCard title="Active Carriers" value={"N/A"} icon={DASHBOARD_STATS_MAP.totalCarriers.icon} bgColorClass={DASHBOARD_STATS_MAP.totalCarriers.bgColorClass} textColorClass={DASHBOARD_STATS_MAP.totalCarriers.textColorClass} /> */}
               <Card className="shadow-lg rounded-xl overflow-hidden bg-gray-100">
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                   <CardTitle className="text-sm font-medium text-gray-600">Last Updated</CardTitle>
                   <List className="h-5 w-5 text-gray-600 opacity-80" />
                 </CardHeader>
                 <CardContent>
                    {/* Display last updated time safely */}
                    <div className="text-2xl font-bold text-gray-600">
                       {clientLastUpdatedStatString || 'Loading...'}
                    </div>
                 </CardContent>
               </Card>
            </>
          )}
        </div>

        {error && !isLoading && (
             <Alert variant="destructive">
                 <AlertTriangle className="h-4 w-4" />
                 <AlertTitle>Error Loading Shipments</AlertTitle>
                 <AlertDescription>{error}</AlertDescription>
              </Alert>
        )}

       {/* Recent Activity Section */}
       <div className="grid gap-6 md:grid-cols-2">
         {/* Pending Shipments */}
         <Card className="shadow-xl rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center text-amber-600">
                <AlertTriangle className="mr-2 h-5 w-5" /> Recent Pending Shipments
              </CardTitle>
              <CardDescription>Quick view of shipments needing attention.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                 ) : pendingShipments.length > 0 ? (
                     <ul className="space-y-3">
                        {pendingShipments.map(shipment => (
                            <li key={shipment.id} className="text-sm border-b pb-2 last:border-b-0">
                               <Link href={`/shipments/${shipment.id}`} className="hover:underline font-medium">
                                 ID: {shipment.id.substring(0, 8)}...
                                </Link>
                                <p><strong>Carrier:</strong> {shipment.carrierId} - <strong>Driver:</strong> {shipment.driverName}</p>
                                <p><strong>Departure:</strong> {formatDateString(shipment.departureDate)}</p>
                            </li>
                        ))}
                     </ul>
                 ) : (
                    <p className="text-center text-muted-foreground py-4">No pending shipments found.</p>
                 )}
            </CardContent>
            <CardFooter>
               <Link href="/shipments?status=Pending" className="text-sm text-primary hover:underline">View all pending shipments</Link>
            </CardFooter>
         </Card>

         {/* Completed Shipments */}
         <Card className="shadow-xl rounded-xl">
            <CardHeader>
               <CardTitle className="flex items-center text-green-600">
                 <CheckCircle2 className="mr-2 h-5 w-5" /> Recently Completed Shipments
               </CardTitle>
               <CardDescription>Overview of recently finalized shipments.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                     <div className="space-y-3">
                         <Skeleton className="h-8 w-full" />
                         <Skeleton className="h-8 w-3/4" />
                         <Skeleton className="h-8 w-full" />
                     </div>
                 ) : completedShipments.length > 0 ? (
                     <ul className="space-y-3">
                        {completedShipments.map(shipment => (
                           <li key={shipment.id} className="text-sm border-b pb-2 last:border-b-0">
                             <Link href={`/shipments/${shipment.id}`} className="hover:underline font-medium">
                               ID: {shipment.id.substring(0, 8)}...
                              </Link>
                             <p><strong>Carrier:</strong> {shipment.carrierId} - <strong>Driver:</strong> {shipment.driverName}</p>
                             <p><strong>Arrival:</strong> {formatDateString(shipment.arrivalDate)}</p>
                           </li>
                        ))}
                     </ul>
                 ) : (
                     <p className="text-center text-muted-foreground py-4">No completed shipments found recently.</p>
                 )}
            </CardContent>
            <CardFooter>
               <Link href="/shipments?status=Completed" className="text-sm text-primary hover:underline">View all completed shipments</Link>
            </CardFooter>
         </Card>
       </div>
    </div>
  );
}
```