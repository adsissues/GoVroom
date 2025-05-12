
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Search, X, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ShipmentStatus, DropdownItem } from '@/lib/types';
import { getDropdownOptions } from '@/lib/firebase/dropdownService'; // Import service
import { Skeleton } from '../ui/skeleton';
import { useQuery } from '@tanstack/react-query'; // Use TanStack Query for caching dropdowns


interface SearchFilterBarProps {
  onFilterChange: (filters: Record<string, any>) => void;
}

// Fetch functions for TanStack Query
const fetchCarriers = () => getDropdownOptions('carriers');
const fetchCustomers = () => getDropdownOptions('customers');


export default function SearchFilterBar({ onFilterChange }: SearchFilterBarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState<ShipmentStatus | ''>('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [carrierId, setCarrierId] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>(''); // Placeholder - requires details fetch

  // Use TanStack Query to fetch and cache dropdown options
    const { data: carrierOptions, isLoading: isLoadingCarriers, error: errorCarriers } = useQuery({
        queryKey: ['carriersFilterList'],
        queryFn: fetchCarriers,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    });

   // TODO: Add query for customers if needed for filtering later
   // const { data: customerOptions, isLoading: isLoadingCustomers, error: errorCustomers } = useQuery({
   //     queryKey: ['customersFilterList'],
   //     queryFn: fetchCustomers,
   //     staleTime: 5 * 60 * 1000,
   //     gcTime: 10 * 60 * 1000,
   // });


  // Debounce mechanism
  const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const debounced = (...args: Parameters<F>) => {
          if (timeout !== null) {
              clearTimeout(timeout);
              timeout = null;
          }
          timeout = setTimeout(() => func(...args), waitFor);
      };

      return debounced as (...args: Parameters<F>) => ReturnType<F>;
  };

  // Memoize the debounced filter function
  const debouncedOnFilterChange = useCallback(debounce(onFilterChange, 300), [onFilterChange]);

  // Trigger filter change when any state changes
  useEffect(() => {
    const filters = {
      searchTerm,
      status,
      startDate,
      endDate,
      carrierId,
      // customerId, // Add when customer filtering is implemented
    };
    debouncedOnFilterChange(filters);
  }, [searchTerm, status, startDate, endDate, carrierId, /* customerId, */ debouncedOnFilterChange]);


  const clearFilters = () => {
    setSearchTerm('');
    setStatus('');
    setStartDate(undefined);
    setEndDate(undefined);
    setCarrierId('');
    setCustomerId('');
    // Trigger filter change immediately after clearing
    onFilterChange({});
  };

  return (
    <div className="p-4 bg-card border rounded-lg mb-6 shadow">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 items-end">
             {/* Search Term */}
            <div className="space-y-1">
                <Label htmlFor="search-term">Search (ID, Carrier, Driver)</Label>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="search-term"
                        placeholder="Enter search term..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

             {/* Status Filter */}
            <div className="space-y-1">
                <Label htmlFor="status-filter">Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as ShipmentStatus | '')}>
                    <SelectTrigger id="status-filter">
                        <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">All Statuses</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

             {/* Carrier Filter */}
             <div className="space-y-1">
                 <Label htmlFor="carrier-filter">Carrier</Label>
                 {isLoadingCarriers ? <Skeleton className="h-10 w-full" /> :
                  <Select value={carrierId} onValueChange={setCarrierId} disabled={!!errorCarriers}>
                    <SelectTrigger id="carrier-filter">
                      <SelectValue placeholder="All Carriers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Carriers</SelectItem>
                      {carrierOptions?.map((option) => (
                        <SelectItem key={option.id} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                 }
                 {errorCarriers && <p className="text-xs text-destructive">Error loading carriers</p>}
             </div>


            {/* Departure Date Range Start */}
            <div className="space-y-1">
                <Label htmlFor="start-date">Departure From</Label>
                <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="start-date"
                        variant={"outline"}
                        className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : <span>Pick a start date</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                    />
                </PopoverContent>
                </Popover>
            </div>

             {/* Departure Date Range End */}
            <div className="space-y-1">
                 <Label htmlFor="end-date">Departure To</Label>
                <Popover>
                <PopoverTrigger asChild>
                     <Button
                        id="end-date"
                        variant={"outline"}
                        className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : <span>Pick an end date</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => // Prevent selecting end date before start date
                          startDate ? date < startDate : false
                        }
                        initialFocus
                    />
                </PopoverContent>
                </Popover>
            </div>


            {/* Clear Filters Button */}
            <div className="flex items-end">
                 <Button variant="ghost" onClick={clearFilters} className="w-full sm:w-auto">
                    <X className="mr-2 h-4 w-4" /> Clear Filters
                 </Button>
            </div>
        </div>
    </div>
  );
}
