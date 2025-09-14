
"use client"

import { TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from "recharts" // Import directly needed components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip as ChartTooltipWrapper, // Rename wrapper
  ChartTooltipContent, // Keep content name
} from "@/components/ui/chart" // Use ShadCN Chart components

// Define chart configuration with explicit colors matching dashboard stats
const chartConfig = {
  pending: {
    label: "Pending",
    color: "hsl(var(--chart-2))", // Use a color variable (e.g., amber/orange)
  },
  completed: {
    label: "Completed",
    color: "hsl(var(--chart-1))", // Use a color variable (e.g., green/blue)
  },
} satisfies ChartConfig

interface ShipmentsStatusChartProps {
    pending: number;
    completed: number;
}

export function ShipmentsStatusChart({ pending, completed }: ShipmentsStatusChartProps) {
   // Data should be structured for the chart library
   const chartData = [
    { status: "Shipments", pending: pending, completed: completed },
    // Add more data points if needed (e.g., by month, by carrier)
   ];

  return (
     <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      <BarChart accessibilityLayer data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="status"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          // tickFormatter={(value) => value.slice(0, 3)} // Example formatter
        />
        <YAxis />
        {/* Use the wrapper and content components from ShadCN Chart */}
        <ChartTooltipWrapper
           cursor={false}
           content={<ChartTooltipContent indicator="dot" hideLabel />}
        />
        <Legend />
        <Bar dataKey="pending" fill="var(--color-pending)" radius={4} />
        <Bar dataKey="completed" fill="var(--color-completed)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
