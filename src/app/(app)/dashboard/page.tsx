
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
import { Timestamp, collection, onSnapshot, query, orderBy, where, limit } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { db } from '@/lib/firebase/config'; // Import db for listeners
import { fromFirestore } from '@/lib/firebase/shipmentsService'; // Import helper


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
        // Ensure timestamp is valid before formatting
        const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
        console.error("Error formatting relative time:", e);
        return 'Error';
    }
};


export default function DashboardPage() {
  const { currentUser } = useAuth();
  const [pendingShipments, setPendingShipments] = useState<Shipment[]>([]);
  const [completedShipments, setCompletedShipments] = useState<Shipment[]>([]);
  const [stats, setStats] = useState<{ pendingCount: number; completedCount: number; totalWeight: number; lastUpdateTimestamp: Timestamp | null }>({ pendingCount: 0, completedCount: 0, totalWeight: 0, lastUpdateTimestamp: null });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingPending, setIsLoadingPending] = useState(true);
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use state for client-side rendering of last updated time
  const [clientLastUpdatedStatString, setClientLastUpdatedStatString] = useState<string | null>(null);

  // Fetch initial stats and set up listeners for stats
  useEffect(() => {
    setIsLoadingStats(true);
    setError(null);

    const fetchInitialStats = async () => {
      try {
        const initialStats = await getDashboardStats();
        setStats(initialStats);
        // Set initial client-side string after stats are loaded
        setClientLastUpdatedStatString(formatLastUpdated(initialStats.lastUpdateTimestamp));
      } catch (err) {
        console.error("Error fetching initial dashboard stats:", err);
        setError(err instanceof Error ? err.message : "Failed to load dashboard stats.");
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchInitialStats();

    // Listener for real-time stats updates (e.g., counts, last updated)
    // This requires a mechanism to update stats, ideally via Cloud Functions writing to a 'dashboard_summary' doc.
    // For simplicity, we'll re-fetch stats periodically or on specific actions if functions aren't used.
    // Example placeholder: re-fetch every minute (adjust as needed)
    const intervalId = setInterval(async () => {
        try {
            const updatedStats = await getDashboardStats();
            setStats(updatedStats);
            setClientLastUpdatedStatString(formatLastUpdated(updatedStats.lastUpdateTimestamp)); // Update client string
        } catch (err) {
             console.error("Error re-fetching dashboard stats:", err);
        }
    }, 60000); // Re-fetch every 60 seconds

    return () => clearInterval(intervalId);

  }, []);

  // Listener for Pending Shipments
  useEffect(() => {
    setIsLoadingPending(true);
    const q = query(collection(db, 'shipments'), where('status', '==', 'Pending'), orderBy('lastUpdated', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(fromFirestore);
      setPendingShipments(data);
      setIsLoadingPending(false);
      setError(null); // Clear previous errors if successful
    }, (err) => {
      console.error("Error listening to pending shipments:", err);
      setError("Failed to load pending shipments.");
      setIsLoadingPending(false);
    });
    return () => unsubscribe();
  }, []);

  // Listener for Completed Shipments
  useEffect(() => {
    setIsLoadingCompleted(true);
    const q = query(collection(db, 'shipments'), where('status', '==', 'Completed'), orderBy('lastUpdated', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(fromFirestore);
      setCompletedShipments(data);
      setIsLoadingCompleted(false);
      setError(null); // Clear previous errors if successful
    }, (err) => {
      console.error("Error listening to completed shipments:", err);
      setError("Failed to load completed shipments.");
      setIsLoadingCompleted(false);
    });
    return () => unsubscribe();
  }, []);

  const isLoading = isLoadingStats || isLoadingPending || isLoadingCompleted;

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
          {isLoadingStats ? (
            <>
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </>
          ) : error && !isLoadingStats ? ( // Show error only if not loading stats
             <Alert variant="destructive" className="col-span-full">
                 <AlertTriangle className="h-4 w-4" />
                 <AlertTitle>Error Loading Stats</AlertTitle>
                 <AlertDescription>{error}</AlertDescription>
              </Alert>
          ) : (
            <>
              <StatCard title="Pending Shipments" value={stats.pendingCount} icon={DASHBOARD_STATS_MAP.pendingShipments.icon} bgColorClass={DASHBOARD_STATS_MAP.pendingShipments.bgColorClass} textColorClass={DASHBOARD_STATS_MAP.pendingShipments.textColorClass} />
              <StatCard title="Completed Shipments" value={stats.completedCount} icon={DASHBOARD_STATS_MAP.completedShipments.icon} bgColorClass={DASHBOARD_STATS_MAP.completedShipments.bgColorClass} textColorClass={DASHBOARD_STATS_MAP.completedShipments.textColorClass} />
              {/* Updated Total Weight card */}
              <StatCard title="Total Weight Handled" value={stats.totalWeight.toFixed(3)} icon={DASHBOARD_STATS_MAP.totalWeight.icon} unit="kg" bgColorClass={DASHBOARD_STATS_MAP.totalWeight.bgColorClass} textColorClass={DASHBOARD_STATS_MAP.totalWeight.textColorClass} />
               <Card className="shadow-lg rounded-xl overflow-hidden bg-gray-100">
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                   <CardTitle className="text-sm font-medium text-gray-600">Last Updated</CardTitle>
                   <List className="h-5 w-5 text-gray-600 opacity-80" />
                 </CardHeader>
                 <CardContent>
                    <div className="text-2xl font-bold text-gray-600">
                       {/* Use state for client-side display */}
                       {clientLastUpdatedStatString || 'Loading...'}
                    </div>
                 </CardContent>
               </Card>
            </>
          )}
        </div>

        {error && (isLoadingStats || isLoadingPending || isLoadingCompleted) && ( // Show general error if any loading is true
             <Alert variant="destructive">
                 <AlertTriangle className="h-4 w-4" />
                 <AlertTitle>Error Loading Dashboard Data</AlertTitle>
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
                {isLoadingPending ? (
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
                {isLoadingCompleted ? (
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
