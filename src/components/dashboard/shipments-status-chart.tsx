
"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface ShipmentsStatusChartProps {
  pending: number;
  completed: number;
}

const chartConfig = {
  pending: {
    label: "Pending",
    color: "hsl(var(--chart-1))", // Blue, maps to --primary
  },
  completed: {
    label: "Completed",
    color: "hsl(var(--chart-2))", // Green, maps to --accent
  },
} satisfies ChartConfig

export default function ShipmentsStatusChart({ pending, completed }: ShipmentsStatusChartProps) {
  const chartData = [
    { status: "Shipments", pending, completed },
  ];

  if (pending === 0 && completed === 0) {
    return <p className="text-center text-muted-foreground py-8">No shipment data available for chart.</p>;
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="status"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={(value) => value.slice(0, 3)}
          />
          <YAxis />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend />
          <Bar dataKey="pending" fill="var(--color-pending)" radius={4} />
          <Bar dataKey="completed" fill="var(--color-completed)" radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
