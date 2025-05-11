
"use client";

import { useState, useEffect } from 'react';
import SummaryCard from '@/components/dashboard/summary-card';
import ShipmentsStatusChart from '@/components/dashboard/shipments-status-chart';
import { ShipmentsTable } from '@/components/shipments/shipments-table';
import type { Shipment } from '@/lib/types';
import { AlertTriangle, CheckCircle2, Weight, Truck, CalendarClock, PackageSearch } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import ClientFormattedDate from '@/components/shared/client-formatted-date';
import { useQuery } from '@tanstack/react-query';
import { getShipmentsFromFirestore, getShipmentStats } from '@/lib/firebase/shipments';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle as UiAlertTitle } from '@/components/ui/alert'; // Renamed AlertTitle to avoid conflict

export default function DashboardPage() {
  const { data: shipments = [], isLoading: isLoadingShipments, error: shipmentsError } = useQuery<Shipment[]>({
    queryKey: ['shipmentsDashboard'], // Use a different key for dashboard specific fetch if needed, or could share with shipments page
    queryFn: () => getShipmentsFromFirestore(), 
  });

  const { data: stats, isLoading: isLoadingStats, error: statsError } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: getShipmentStats,
  });

  const [clientLastUpdatedString, setClientLastUpdatedString] = useState<string | null>(null);

  useEffect(() => {
    if (stats?.lastUpdated) {
      setClientLastUpdatedString(new Date(stats.lastUpdated).toLocaleDateString());
    } else if (!isLoadingStats && !stats?.lastUpdated) {
      setClientLastUpdatedString('N/A');
    }
  }, [stats?.lastUpdated, isLoadingStats]);

  const recentShipments = shipments.slice(0, 3);

  const summaryStatsData = [
    { title: "Pending Shipments", value: stats?.pendingCount ?? 0, icon: AlertTriangle, color: "text-orange-500", isLoading: isLoadingStats },
    { title: "Completed Shipments", value: stats?.completedCount ?? 0, icon: CheckCircle2, color: "text-green-500", isLoading: isLoadingStats },
    { title: "Total Weight (kg)", value: (stats?.totalWeight ?? 0).toLocaleString(), icon: Weight, color: "text-blue-500", isLoading: isLoadingStats },
    { title: "Last Updated", value: clientLastUpdatedString || (isLoadingStats ? 'Loading...' : 'N/A'), icon: CalendarClock, color: "text-purple-500", isLoading: isLoadingStats },
  ];

  if (shipmentsError || statsError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <UiAlertTitle>Error Loading Dashboard</UiAlertTitle>
        <AlertDescription>
          { (shipmentsError instanceof Error && shipmentsError.message) || 
            (statsError instanceof Error && statsError.message) || 
            "Could not fetch dashboard data."}
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
            {isLoadingStats ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ShipmentsStatusChart 
                pending={stats?.pendingCount ?? 0} 
                completed={stats?.completedCount ?? 0} 
              />
            )}
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
           <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingShipments ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {recentShipments.length > 0 ? recentShipments.map(shipment => (
                  <div key={shipment.id} className="mb-2 pb-2 border-b last:border-b-0">
                    <p><strong>{shipment.carrier} - {shipment.driverName}</strong></p>
                    <p>Status: <span className={cn(shipment.status === 'Completed' ? 'text-accent' : 'text-orange-500')}>{shipment.status}</span></p>
                    <p>Last Update: <ClientFormattedDate date={shipment.lastUpdated} /></p>
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
          {isLoadingShipments ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ShipmentsTable shipments={shipments.slice(0, 5)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
