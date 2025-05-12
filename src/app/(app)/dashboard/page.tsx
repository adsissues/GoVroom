
"use client";

import { useState, useEffect, useMemo } from 'react';
import SummaryCard from '@/components/dashboard/summary-card';
import ShipmentsStatusChart from '@/components/dashboard/shipments-status-chart';
import { ShipmentsTable } from '@/components/shipments/shipments-table';
import type { Shipment } from '@/lib/types';
import { AlertTriangle, CheckCircle2, Weight, CalendarClock, PackageSearch } from 'lucide-react'; // Removed unused Truck
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import ClientFormattedDate from '@/components/shared/client-formatted-date';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle as UiAlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase/config';
import { collection, query, orderBy, onSnapshot, Timestamp, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';

// Helper to convert Firestore document snapshot to Shipment type
const fromFirestore = (docSnap: QueryDocumentSnapshot<DocumentData>): Shipment => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    carrier: data.carrier,
    subcarrier: data.subcarrier,
    driverName: data.driverName,
    departureDate: (data.departureDate as Timestamp)?.toDate(),
    arrivalDate: (data.arrivalDate as Timestamp)?.toDate(),
    status: data.status,
    sealNumber: data.sealNumber,
    truckRegistration: data.truckRegistration,
    trailerRegistration: data.trailerRegistration,
    senderAddress: data.senderAddress,
    consigneeAddress: data.consigneeAddress,
    totalWeight: data.totalWeight,
    lastUpdated: (data.lastUpdated as Timestamp)?.toDate(),
  };
};


export default function DashboardPage() {
  const [allShipments, setAllShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [clientLastUpdatedStatString, setClientLastUpdatedStatString] = useState<string | null>(null);

  useEffect(() => {
    const shipmentsQuery = query(collection(db, 'shipments'), orderBy('lastUpdated', 'desc'));

    const unsubscribe = onSnapshot(shipmentsQuery,
      (snapshot) => {
        const fetchedShipments = snapshot.docs.map(doc => fromFirestore(doc as QueryDocumentSnapshot<DocumentData>));
        // console.log("Dashboard onSnapshot: Fetched shipments", fetchedShipments.length, "docs");
        setAllShipments(fetchedShipments);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Error fetching real-time shipments for dashboard:", err);
        let specificError = err;
        if (err.message.includes("Missing or insufficient permissions") || err.message.includes("The caller does not have permission")) {
            specificError = new Error("Missing or insufficient permissions to fetch shipment data. Please check your Firestore security rules.");
        } else if (err.message.includes("The database (default) does not exist")) {
            specificError = new Error("Firestore database not found. Please ensure Firestore is enabled for your Firebase project and environment variables are correct.");
        }
        setError(specificError);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const pendingCount = useMemo(() => allShipments.filter(s => s.status === 'Pending').length, [allShipments]);
  const completedCount = useMemo(() => allShipments.filter(s => s.status === 'Completed').length, [allShipments]);
  const totalWeight = useMemo(() => allShipments.reduce((acc, s) => acc + (s.totalWeight || 0), 0), [allShipments]);

  const lastUpdatedForStats = useMemo(() => {
    if (allShipments.length > 0 && allShipments[0].lastUpdated) {
      return allShipments[0].lastUpdated;
    }
    return null;
  }, [allShipments]);

  useEffect(() => {
    if (lastUpdatedForStats) {
      setClientLastUpdatedStatString(new Date(lastUpdatedForStats).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }));
    } else if (!isLoading && !lastUpdatedForStats) {
      setClientLastUpdatedStatString('N/A');
    }
  }, [lastUpdatedForStats, isLoading]);


  const recentShipmentsForActivity = allShipments.slice(0, 3);
  const recentShipmentsForTable = allShipments.slice(0, 5);

  const summaryStatsData = [
    { title: "Pending Shipments", value: pendingCount, icon: AlertTriangle, color: "text-orange-500", isLoading: isLoading },
    { title: "Completed Shipments", value: completedCount, icon: CheckCircle2, color: "text-accent", isLoading: isLoading }, // Use accent for completed
    { title: "Total Weight (kg)", value: totalWeight.toLocaleString(), icon: Weight, color: "text-primary", isLoading: isLoading }, // Use primary for blue
    { title: "Last Updated", value: clientLastUpdatedStatString || (isLoading ? 'Loading...' : 'N/A'), icon: CalendarClock, color: "text-purple-500", isLoading: isLoading },
  ];

  if (error) {
    const errorMessage = error.message || "Could not fetch dashboard data.";
    const isDbNotFoundError = errorMessage.includes("Firestore database not found");
    const finalErrorMessage = isDbNotFoundError
      ? `${errorMessage} Please ensure Firestore is enabled for your Firebase project and the environment variables (NEXT_PUBLIC_FIREBASE_PROJECT_ID, etc.) in .env.local are correctly configured.`
      : errorMessage;

    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <UiAlertTitle>Error Loading Dashboard</UiAlertTitle>
        <AlertDescription>
          {finalErrorMessage}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {summaryStatsData.map(stat => (
          stat.isLoading ? (
            <Card key={stat.title} className="shadow-lg rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-1/2" />
              </CardContent>
            </Card>
          ) : (
            <SummaryCard
              key={stat.title}
              title={stat.title}
              value={stat.value.toString()}
              icon={stat.icon}
              iconColorClass={stat.color}
            />
          )
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle>Shipment Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ShipmentsStatusChart
                pending={pendingCount}
                completed={completedCount}
              />
            )}
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
           <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {recentShipmentsForActivity.length > 0 ? recentShipmentsForActivity.map(shipment => (
                  <div key={shipment.id} className="mb-2 pb-2 border-b last:border-b-0">
                    <p><strong>{shipment.carrier} - {shipment.driverName}</strong></p>
                    <p>Status: <span className={cn(shipment.status === 'Completed' ? 'text-accent font-semibold' : 'text-orange-500 font-medium')}>{shipment.status}</span></p>
                    {shipment.lastUpdated && <p>Last Update: <ClientFormattedDate date={shipment.lastUpdated} /></p>}
                  </div>
                )) : <p>No recent activity.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle>Recent Shipments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ShipmentsTable shipments={recentShipmentsForTable} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
