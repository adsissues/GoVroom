
"use client";

import { useState, useEffect } from 'react';
import SummaryCard from '@/components/dashboard/summary-card';
import ShipmentsStatusChart from '@/components/dashboard/shipments-status-chart';
import { ShipmentsTable } from '@/components/shipments/shipments-table';
import { MOCK_SHIPMENTS, DASHBOARD_STATS_MAP } from '@/lib/constants';
import type { Shipment } from '@/lib/types';
import { AlertTriangle, CheckCircle2, Weight, Truck, CalendarClock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import ClientFormattedDate from '@/components/shared/client-formatted-date';

export default function DashboardPage() {
  const [pendingCount, setPendingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalWeight, setTotalWeight] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [recentShipments, setRecentShipments] = useState<Shipment[]>([]);
  const [clientLastUpdatedString, setClientLastUpdatedString] = useState<string | null>(null);


  useEffect(() => {
    // Simulate fetching data
    const pending = MOCK_SHIPMENTS.filter(s => s.status === 'Pending').length;
    const completed = MOCK_SHIPMENTS.filter(s => s.status === 'Completed').length;
    const weight = MOCK_SHIPMENTS.reduce((acc, s) => acc + (s.totalWeight || 0), 0);
    
    setPendingCount(pending);
    setCompletedCount(completed);
    setTotalWeight(weight);
    if (MOCK_SHIPMENTS.length > 0) {
      // Ensure lastUpdated is derived from valid Date objects
      const validDates = MOCK_SHIPMENTS
        .map(s => s.lastUpdated instanceof Date ? s.lastUpdated.getTime() : new Date(s.lastUpdated).getTime())
        .filter(time => !isNaN(time));
      if (validDates.length > 0) {
        const maxDate = new Date(Math.max(...validDates));
        setLastUpdated(maxDate);
        setClientLastUpdatedString(maxDate.toLocaleDateString());
      } else {
        setClientLastUpdatedString('N/A');
      }
    } else {
      setClientLastUpdatedString('N/A');
    }
    setRecentShipments(MOCK_SHIPMENTS.slice(0,3));

  }, []);

  const summaryStats = [
    { title: "Pending Shipments", value: pendingCount, icon: AlertTriangle, color: "text-orange-500" },
    { title: "Completed Shipments", value: completedCount, icon: CheckCircle2, color: "text-green-500" },
    { title: "Total Weight (kg)", value: totalWeight.toLocaleString(), icon: Weight, color: "text-blue-500" },
    { title: "Last Updated", value: clientLastUpdatedString || 'N/A', icon: CalendarClock, color: "text-purple-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {summaryStats.map(stat => (
          <SummaryCard 
            key={stat.title} 
            title={stat.title} 
            value={stat.value.toString()} 
            icon={stat.icon} 
            iconColorClass={stat.color} 
          />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle>Shipment Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ShipmentsStatusChart 
              pending={pendingCount} 
              completed={completedCount} 
            />
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
           <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {recentShipments.map(shipment => (
                <div key={shipment.id} className="mb-2 pb-2 border-b last:border-b-0">
                  <p><strong>{shipment.carrier} - {shipment.driverName}</strong></p>
                  <p>Status: <span className={shipment.status === 'Completed' ? 'text-green-500' : 'text-orange-500'}>{shipment.status}</span></p>
                  <p>Last Update: <ClientFormattedDate date={shipment.lastUpdated} /></p>
                </div>
              ))}
               {recentShipments.length === 0 && <p>No recent activity.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle>Recent Shipments</CardTitle>
        </CardHeader>
        <CardContent>
          <ShipmentsTable shipments={MOCK_SHIPMENTS.slice(0, 5)} />
        </CardContent>
      </Card>
    </div>
  );
}
