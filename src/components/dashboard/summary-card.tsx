
import type { ElementType } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  title: string;
  value: string;
  icon: ElementType;
  iconColorClass?: string;
  change?: string; // e.g. "+5% from last month"
}

export default function SummaryCard({ title, value, icon: Icon, iconColorClass = "text-primary", change }: SummaryCardProps) {
  return (
    <Card className="shadow-lg rounded-xl hover:shadow-xl transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={cn("h-6 w-6", iconColorClass)} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        {change && (
          <p className="text-xs text-muted-foreground pt-1">{change}</p>
        )}
      </CardContent>
    </Card>
  );
}
