
"use client";

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { CalendarIcon, Search, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { getDropdownOptions } from '@/lib/firebase/dropdowns';
import type { SelectOption } from '@/lib/types';

interface SearchFilterBarProps {
  onSearch: (filters: Record<string, any>) => void;
}

// Using a sentinel value to represent "All Items" selection clearly
const ALL_ITEMS_VALUE = "all_items_selection_sentinel";

type FilterFormData = {
  carrier?: string;
  driverName?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  customer?: string;
};

export default function SearchFilterBar({ onSearch }: SearchFilterBarProps) {
  const form = useForm<FilterFormData>({
    defaultValues: {
      carrier: ALL_ITEMS_VALUE,
      driverName: '',
      status: ALL_ITEMS_VALUE,
      customer: ALL_ITEMS_VALUE,
      dateFrom: undefined,
      dateTo: undefined,
    }
  });

  const { data: carriers, isLoading: isLoadingCarriers, error: carriersError } = useQuery<SelectOption[]>({
    queryKey: ['carriersFilterList'],
    queryFn: () => getDropdownOptions('carriers'),
  });

  const { data: customers, isLoading: isLoadingCustomers, error: customersError } = useQuery<SelectOption[]>({
    queryKey: ['customersFilterList'],
    queryFn: () => getDropdownOptions('customers'),
  });


  const handleSubmit = (data: FilterFormData) => {
    const filters: Record<string, any> = {};
    // Only add filter if a specific value (not the sentinel) is selected
    if (data.carrier && data.carrier !== ALL_ITEMS_VALUE) filters.carrier = data.carrier;
    if (data.driverName) filters.driverName = data.driverName;
    if (data.status && data.status !== ALL_ITEMS_VALUE) filters.status = data.status;
    if (data.customer && data.customer !== ALL_ITEMS_VALUE) filters.customer = data.customer;
    if (data.dateFrom || data.dateTo) {
        filters.dateRange = { from: data.dateFrom, to: data.dateTo };
    }
    onSearch(filters);
  };

  const handleReset = () => {
    form.reset({
      carrier: ALL_ITEMS_VALUE,
      driverName: '',
      status: ALL_ITEMS_VALUE,
      dateFrom: undefined,
      dateTo: undefined,
      customer: ALL_ITEMS_VALUE,
    });
    onSearch({});
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4 bg-card rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="filter-carrier">Carrier</Label>
          <Controller
            name="carrier"
            control={form.control}
            render={({ field }) => (
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={isLoadingCarriers || !!carriersError}
              >
                <SelectTrigger id="filter-carrier" className="mt-1">
                  <SelectValue placeholder="All Carriers" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingCarriers && <SelectItem value="loading_carriers_sentinel" disabled>Loading carriers...</SelectItem>}
                  {carriersError && <SelectItem value="error_carriers_sentinel" disabled>Error: {(carriersError as Error).message}</SelectItem>}
                  {!isLoadingCarriers && !carriersError && (
                    <>
                      <SelectItem value={ALL_ITEMS_VALUE}>All Carriers</SelectItem>
                      {carriers?.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </>
                  )}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div>
          <Label htmlFor="filter-driverName">Driver Name</Label>
          <Input id="filter-driverName" placeholder="Enter driver name" {...form.register("driverName")} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="filter-status">Status</Label>
          <Controller
            name="status"
            control={form.control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="filter-status" className="mt-1">
                  <SelectValue placeholder="Any Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ITEMS_VALUE}>Any Status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div>
          <Label htmlFor="filter-dateFrom">Date From</Label>
           <Controller
            name="dateFrom"
            control={form.control}
            render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn("w-full justify-start text-left font-normal mt-1", !field.value && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                </PopoverContent>
              </Popover>
            )}
          />
        </div>
        <div>
          <Label htmlFor="filter-dateTo">Date To</Label>
          <Controller
            name="dateTo"
            control={form.control}
            render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn("w-full justify-start text-left font-normal mt-1", !field.value && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                </PopoverContent>
              </Popover>
            )}
          />
        </div>
        <div>
          <Label htmlFor="filter-customer">Customer</Label>
          <Controller
            name="customer"
            control={form.control}
            render={({ field }) => (
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={isLoadingCustomers || !!customersError}
              >
                <SelectTrigger id="filter-customer" className="mt-1">
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingCustomers && <SelectItem value="loading_customers_sentinel" disabled>Loading customers...</SelectItem>}
                  {customersError && <SelectItem value="error_customers_sentinel" disabled>Error: {(customersError as Error).message}</SelectItem>}
                  {!isLoadingCustomers && !customersError && (
                    <>
                      <SelectItem value={ALL_ITEMS_VALUE}>All Customers</SelectItem>
                      {customers?.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </>
                  )}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
      <div className="flex justify-end space-x-3 pt-3 border-t border-border">
        <Button type="button" variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset Filters
        </Button>
        <Button type="submit">
            <Search className="mr-2 h-4 w-4" /> Search Shipments
        </Button>
      </div>
    </form>
  );
}
