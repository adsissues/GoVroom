
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { List, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'; // Icons for sections
import type { Shipment } from '@/lib/types';
import { shipmentFromFirestore, getDashboardStats } from '@/lib/firebase/shipmentsService'; // Import helper
import { DASHBOARD_STATS_MAP } from '@/lib/constants';
import { format } from 'date-fns';

// Helper function to format date/time or return 'N/A'
const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return 'N/A';
  try {
    // Format as date and time, adjust format string as needed
    return format(timestamp.toDate(), "PPpp"); // Example: Sep 24, 2023, 10:30:00 AM
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return 'Invalid Date';
  }
};

// Component for individual stat card
const StatCard = ({ title, value, icon: Icon, unit, bgColorClass, textColorClass, isLoading }: {
  title: string;
  value: string | number | null;
  icon: React.ElementType;
  unit?: string;
  bgColorClass: string;
  textColorClass: string;
  isLoading: boolean;
}) => (
  <Card className={`shadow-md rounded-xl border ${bgColorClass} ${textColorClass}`}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-5 w-5 text-current opacity-80" />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <Skeleton className="h-8 w-3/4" />
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
      pendingCount: number | null;
      completedCount: number | null;
      totalGrossWeightSum: number | null;
      lastUpdateTimestamp: Timestamp | null;
  }>({ pendingCount: null, completedCount: null, totalGrossWeightSum: null, lastUpdateTimestamp: null });

  const [isLoadingPending, setIsLoadingPending] = useState(true);
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [errorPending, setErrorPending] = useState<string | null>(null);
  const [errorCompleted, setErrorCompleted] = useState<string | null>(null);
  const [errorStats, setErrorStats] = useState<string | null>(null);

   // Fetch Dashboard Stats (once on load)
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
      })
      .finally(() => setIsLoadingStats(false));
  }, []); // Empty dependency array means fetch once


  // Real-time listener for Pending Shipments
  useEffect(() => {
    setIsLoadingPending(true);
    setErrorPending(null);
    const q = query(
        collection(db, 'shipments'),
        where('status', '==', 'Pending'),
        orderBy('lastUpdated', 'desc'),
        limit(5) // Limit to latest 5 pending
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(shipmentFromFirestore);
      setPendingShipments(data);
      setIsLoadingPending(false);
    }, (error) => {
      console.error("Error fetching pending shipments:", error);
      setErrorPending("Failed to load pending shipments.");
      setIsLoadingPending(false);
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, []);

   // Real-time listener for Completed Shipments
   useEffect(() => {
    setIsLoadingCompleted(true);
    setErrorCompleted(null);
    const q = query(
        collection(db, 'shipments'),
        where('status', '==', 'Completed'),
        orderBy('lastUpdated', 'desc'),
        limit(5) // Limit to latest 5 completed
     );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(shipmentFromFirestore);
      setCompletedShipments(data);
      setIsLoadingCompleted(false);
    }, (error) => {
      console.error("Error fetching completed shipments:", error);
      setErrorCompleted("Failed to load completed shipments.");
      setIsLoadingCompleted(false);
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, []);


  const renderShipmentList = (shipments: Shipment[], isLoading: boolean, error: string | null, status: 'Pending' | 'Completed') => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
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
    if (shipments.length === 0) {
      return <p className="text-muted-foreground text-center py-4">No {status.toLowerCase()} shipments found.</p>;
    }
    return (
      <ul className="space-y-3">
        {shipments.map((shipment) => (
          <li key={shipment.id}>
            <Link href={`/shipments/${shipment.id}`}>
              <Card className="hover:shadow-md transition-shadow duration-150 cursor-pointer border hover:border-primary/50">
                <CardContent className="p-3 flex justify-between items-center">
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
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    );
  };


  return (
    <div className="space-y-6 md:space-y-8">
        {/* Welcome Message */}
        <h1 className="text-2xl md:text-3xl font-bold">Welcome, {currentUser?.email || 'User'}!</h1>

        {/* Dashboard Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
             <StatCard
                 title={DASHBOARD_STATS_MAP.pendingShipments.title}
                 value={dashboardStats.pendingCount}
                 icon={DASHBOARD_STATS_MAP.pendingShipments.icon}
                 bgColorClass={DASHBOARD_STATS_MAP.pendingShipments.bgColorClass}
                 textColorClass={DASHBOARD_STATS_MAP.pendingShipments.textColorClass}
                 isLoading={isLoadingStats}
             />
              <StatCard
                 title={DASHBOARD_STATS_MAP.completedShipments.title}
                 value={dashboardStats.completedCount}
                 icon={DASHBOARD_STATS_MAP.completedShipments.icon}
                 bgColorClass={DASHBOARD_STATS_MAP.completedShipments.bgColorClass}
                 textColorClass={DASHBOARD_STATS_MAP.completedShipments.textColorClass}
                 isLoading={isLoadingStats}
              />
              {/* Total weight calculation needs backend/Cloud Function */}
              <StatCard
                 title={DASHBOARD_STATS_MAP.totalGrossWeight.title}
                 value={dashboardStats.totalGrossWeightSum} // Replace with actual value later
                 icon={DASHBOARD_STATS_MAP.totalGrossWeight.icon}
                 unit={DASHBOARD_STATS_MAP.totalGrossWeight.unit}
                 bgColorClass={DASHBOARD_STATS_MAP.totalGrossWeight.bgColorClass}
                 textColorClass={DASHBOARD_STATS_MAP.totalGrossWeight.textColorClass}
                 isLoading={isLoadingStats} // Or keep loading until function provides data
              />
               <StatCard
                 title={DASHBOARD_STATS_MAP.lastUpdated.title}
                 value={formatTimestamp(dashboardStats.lastUpdateTimestamp)}
                 icon={DASHBOARD_STATS_MAP.lastUpdated.icon}
                 bgColorClass={DASHBOARD_STATS_MAP.lastUpdated.bgColorClass}
                 textColorClass={DASHBOARD_STATS_MAP.lastUpdated.textColorClass}
                 isLoading={isLoadingStats}
               />
        </div>


        {/* Pending and Completed Shipments Sections */}
        <div className="grid gap-6 md:grid-cols-2">
            {/* Pending Shipments */}
            <Card className="shadow-lg rounded-xl">
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Pending Shipments (Recent 5)
                </CardTitle>
                <CardDescription>Shipments awaiting completion.</CardDescription>
                </CardHeader>
                <CardContent>
                {renderShipmentList(pendingShipments, isLoadingPending, errorPending, 'Pending')}
                </CardContent>
            </Card>

            {/* Completed Shipments */}
            <Card className="shadow-lg rounded-xl">
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Completed Shipments (Recent 5)
                </CardTitle>
                <CardDescription>Recently finalized shipments.</CardDescription>
                </CardHeader>
                <CardContent>
                {renderShipmentList(completedShipments, isLoadingCompleted, errorCompleted, 'Completed')}
                </CardContent>
            </Card>
        </div>

        {/* Placeholder for Charts or other widgets */}
        {/* <div className="grid gap-6 md:grid-cols-1">
            <Card>
                <CardHeader>
                    <CardTitle>Shipment Status Overview</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingStats ? <Skeleton className="h-48 w-full" /> : <ShipmentsStatusChart pending={dashboardStats.pendingCount ?? 0} completed={dashboardStats.completedCount ?? 0} />}
                </CardContent>
            </Card>
        </div> */}

    </div>
  );
}
