
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/(app)/AuthContext'; // Updated import path
import { db } from '@/lib/firebase/config';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, Loader2, CalendarDays, ChevronDown, ChevronUp, ShoppingCart, Users, Anchor, Plane } from 'lucide-react';
import type { Shipment } from '@/lib/types';
import { shipmentFromFirestore, getDashboardStats } from '@/lib/firebase/shipmentsService';
import { DASHBOARD_STATS_MAP } from '@/lib/constants'; 
import { format } from 'date-fns';

// Helper function to format date/time or return 'N/A'
const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return 'N/A';
  try {
    return format(timestamp.toDate(), "PPpp"); 
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return 'Invalid Date';
  }
};

const StatCard = ({ title, value, icon: Icon, unit, bgColorClass, textColorClass, isLoading, isUnavailable }: {
  title: string;
  value: string | number | null;
  icon: React.ElementType;
  unit?: string;
  bgColorClass: string;
  textColorClass: string;
  isLoading: boolean;
  isUnavailable?: boolean;
}) => (
  <Card className={`shadow-md rounded-xl border ${bgColorClass} ${textColorClass}`}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-5 w-5 text-current opacity-80" />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <Skeleton className="h-8 w-3/4" />
      ) : isUnavailable ? (
        <div className="text-sm text-muted-foreground italic">N/A</div>
      ) : (
        <div className="text-2xl font-bold">
          {value ?? 'N/A'}
          {unit && value !== null && value !== undefined && <span className="text-xs text-current/80 ml-1">{unit}</span>}
        </div>
      )}
    </CardContent>
  </Card>
);


export default function DashboardPage() {
  const { currentUser } = useAuth();
  const [pendingShipments, setPendingShipments] = useState<Shipment[]>([]);
  const [completedShipments, setCompletedShipments] = useState<Shipment[]>([]);
  const [dashboardStats, setDashboardStats] = useState<{
      lastUpdateTimestamp: Timestamp | null;
  }>({ 
      lastUpdateTimestamp: null, 
  });

  const [isLoadingPending, setIsLoadingPending] = useState(true);
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [errorPending, setErrorPending] = useState<string | null>(null);
  const [errorCompleted, setErrorCompleted] = useState<string | null>(null);
  const [errorStats, setErrorStats] = useState<string | null>(null);

  const [showAllPending, setShowAllPending] = useState(false);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

   useEffect(() => {
    setIsLoadingStats(true);
    setErrorStats(null);
    getDashboardStats()
      .then(stats => {
        setDashboardStats(stats);
      })
      .catch(err => {
        console.error("Error fetching dashboard stats:", err);
        setErrorStats("Failed to load dashboard statistics.");
        setDashboardStats({ 
            lastUpdateTimestamp: null, 
        });
      })
      .finally(() => setIsLoadingStats(false));
  }, []);

  useEffect(() => {
    setIsLoadingPending(true);
    setErrorPending(null);
    const q = query(
        collection(db, 'shipments'),
        where('status', '==', 'Pending'),
        orderBy('lastUpdated', 'desc'),
        limit(5) 
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => shipmentFromFirestore(doc as QueryDocumentSnapshot<DocumentData>));
      setPendingShipments(data);
      setIsLoadingPending(false);
    }, (error) => {
      console.error("Error fetching pending shipments:", error);
      setErrorPending("Failed to load pending shipments.");
      setIsLoadingPending(false);
    });
    return () => unsubscribe(); 
  }, []);

   useEffect(() => {
    setIsLoadingCompleted(true);
    setErrorCompleted(null);
    const q = query(
        collection(db, 'shipments'),
        where('status', '==', 'Completed'),
        orderBy('lastUpdated', 'desc'),
        limit(5) 
     );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => shipmentFromFirestore(doc as QueryDocumentSnapshot<DocumentData>));
      setCompletedShipments(data);
      setIsLoadingCompleted(false);
    }, (error) => {
      console.error("Error fetching completed shipments:", error);
      setErrorCompleted("Failed to load completed shipments.");
      setIsLoadingCompleted(false);
    });
    return () => unsubscribe(); 
  }, []);

  const renderShipmentList = (
    shipments: Shipment[], 
    isLoading: boolean, 
    error: string | null, 
    status: 'Pending' | 'Completed',
    showAll: boolean,
    toggleShowAll: () => void
  ) => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
           <Skeleton className="h-8 w-1/2 mt-4" />
           <Skeleton className="h-8 w-1/2 mt-2" />
        </div>
      );
    }
    if (error) {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }
    
    const itemsToShow = showAll ? shipments : shipments.slice(0, 2); 

    return (
      <>
        {itemsToShow.length === 0 && shipments.length === 0 ? ( 
            <p className="text-muted-foreground text-center py-4">No {status.toLowerCase()} shipments found.</p>
        ) : itemsToShow.length === 0 && shipments.length > 0 ? ( 
             <p className="text-muted-foreground text-center py-4">Click "View All" to see shipments.</p>
        ) : (
          <ul className="space-y-3">
            {itemsToShow.map((shipment) => {
              // Use pre-calculated net weights directly from the shipment object
              const shipmentOtherNetWeight = shipment.remainingCustomersNetWeight || 0;
              const shipmentAsendiaACNetWeight = shipment.asendiaACNetWeight || 0;
              return (
                <li key={shipment.id}>
                  <Link href={`/shipments/${shipment.id}`}>
                    <Card className="hover:shadow-md transition-shadow duration-150 cursor-pointer border hover:border-primary/50">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold text-sm truncate">{shipment.carrierId} - {shipment.driverName}</p>
                            <p className="text-xs text-muted-foreground">
                                Departed: {formatTimestamp(shipment.departureDate)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Last Update: {formatTimestamp(shipment.lastUpdated)}
                            </p>
                          </div>
                          <Badge variant={status === 'Completed' ? 'default' : 'secondary'} className={status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                            {shipment.status}
                          </Badge>
                        </div>
                        {/* Net weight breakdown per shipment card */}
                        <div className="mt-2 pt-2 border-t border-muted/50 text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center"><ShoppingCart className="mr-1.5 h-3.5 w-3.5 text-primary/70" /> Other Net Weight:</span>
                            <span className="font-medium">{shipmentOtherNetWeight.toFixed(2)} kg</span>
                          </div>
                           <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center"><ShoppingCart className="mr-1.5 h-3.5 w-3.5 text-primary/70" /> Asendia A/C Net:</span>
                            <span className="font-medium">{shipmentAsendiaACNetWeight.toFixed(2)} kg</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {shipments.length > 2 && ( 
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={toggleShowAll} size="sm">
              {showAll ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
              {showAll ? 'Show Less' : `View All (${shipments.length})`}
            </Button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6 md:space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
             <h1 className="text-2xl md:text-3xl font-bold">Welcome, {currentUser?.displayName || 'there'}!</h1>
             {/* Only "Last Updated" card remains from the original stat cards */}
             {DASHBOARD_STATS_MAP.lastUpdateTimestamp && ( 
                 <StatCard
                   title={DASHBOARD_STATS_MAP.lastUpdateTimestamp.title}
                   value={formatTimestamp(dashboardStats.lastUpdateTimestamp)}
                   icon={DASHBOARD_STATS_MAP.lastUpdateTimestamp.icon || CalendarDays}
                   bgColorClass={DASHBOARD_STATS_MAP.lastUpdateTimestamp.bgColorClass}
                   textColorClass={DASHBOARD_STATS_MAP.lastUpdateTimestamp.textColorClass}
                   isLoading={isLoadingStats}
                   isUnavailable={!dashboardStats.lastUpdateTimestamp && !isLoadingStats}
                 />
            )}
        </div>


         {errorStats && (
             <Alert variant="destructive">
                 <AlertTriangle className="h-4 w-4" />
                 <AlertTitle>Error Loading Statistics</AlertTitle>
                 <AlertDescription>{errorStats}</AlertDescription>
             </Alert>
         )}


        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2"> {/* Adjusted for better prominence */}
            <Card className="shadow-lg rounded-xl border">
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Pending Shipments (Recent {pendingShipments.length})
                </CardTitle>
                <CardDescription>Shipments awaiting completion.</CardDescription>
                </CardHeader>
                <CardContent>
                {renderShipmentList(pendingShipments, isLoadingPending, errorPending, 'Pending', showAllPending, () => setShowAllPending(!showAllPending))}
                </CardContent>
            </Card>

            <Card className="shadow-lg rounded-xl border">
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Completed Shipments (Recent {completedShipments.length})
                </CardTitle>
                <CardDescription>Recently finalized shipments.</CardDescription>
                </CardHeader>
                <CardContent>
                {renderShipmentList(completedShipments, isLoadingCompleted, errorCompleted, 'Completed', showAllCompleted, () => setShowAllCompleted(!showAllCompleted))}
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

