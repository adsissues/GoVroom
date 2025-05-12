
"use client";

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormField, FormItem, FormMessage, FormControl } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { CalendarIcon, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import { DEFAULT_SENDER_ADDRESS, DEFAULT_CONSIGNEE_ADDRESS } from '@/lib/constants';
import AISuggestionSection from './ai-suggestion-section';
import type { SuggestShipmentDetailsInput } from '@/ai/flows/suggest-shipment-details';
import { addShipmentToFirestore } from '@/lib/firebase/shipments';
import { getAppSettingsFromFirestore } from '@/lib/firebase/settings';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDropdownOptions } from '@/lib/firebase/dropdowns';
import type { SelectOption } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';


const shipmentFormSchema = z.object({
  carrier: z.string().min(1, "Carrier is required"),
  subcarrier: z.string().min(1, "Subcarrier is required"),
  driverName: z.string().min(1, "Driver name is required"),
  departureDate: z.date({ required_error: "Departure date is required" }),
  arrivalDate: z.date({ required_error: "Arrival date is required" }),
  status: z.boolean().default(false), // false for Pending, true for Completed
  sealNumber: z.string().optional(),
  truckRegistration: z.string().optional(),
  trailerRegistration: z.string().optional(),
  senderAddress: z.string().optional(), // Default will be fetched
  consigneeAddress: z.string().optional(), // Default will be fetched
  totalWeight: z.number().optional(),
});

type ShipmentFormData = z.infer<typeof shipmentFormSchema>;

export default function ShipmentForm() {
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiInput, setAiInput] = useState<SuggestShipmentDetailsInput | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient(); 

  const isAdmin = currentUser?.role === 'admin';
  
  const formHook = useForm<ShipmentFormData>({
    resolver: zodResolver(shipmentFormSchema),
    // Default values will be set after fetching app settings
  });

  const { data: appSettings, isLoading: isLoadingAppSettings } = useQuery({
    queryKey: ['appSettings'],
    queryFn: getAppSettingsFromFirestore,
  });

  useEffect(() => {
    if (appSettings) {
      formHook.reset({
        carrier: '', 
        subcarrier: '', 
        driverName: '',
        departureDate: new Date(),
        arrivalDate: new Date(new Date().setDate(new Date().getDate() + 1)),
        status: false,
        senderAddress: appSettings.defaultSenderAddress || DEFAULT_SENDER_ADDRESS,
        consigneeAddress: appSettings.defaultConsigneeAddress || DEFAULT_CONSIGNEE_ADDRESS,
        sealNumber: '',
        truckRegistration: '',
        trailerRegistration: '',
        totalWeight: 0,
      });
    } else if (!isLoadingAppSettings) { // Not loading and no settings from Firestore
         formHook.reset({
            carrier: '', 
            subcarrier: '', 
            driverName: '',
            departureDate: new Date(),
            arrivalDate: new Date(new Date().setDate(new Date().getDate() + 1)),
            status: false,
            senderAddress: DEFAULT_SENDER_ADDRESS, // Fallback
            consigneeAddress: DEFAULT_CONSIGNEE_ADDRESS, // Fallback
            sealNumber: '',
            truckRegistration: '',
            trailerRegistration: '',
            totalWeight: 0,
         });
    }
  }, [appSettings, isLoadingAppSettings, formHook]);


  const { data: carriers, isLoading: isLoadingCarriers, error: carriersError } = useQuery<SelectOption[]>({
    queryKey: ['carriersDropdown'],
    queryFn: () => getDropdownOptions('carriers'),
  });

  const { data: subcarriers, isLoading: isLoadingSubcarriers, error: subcarriersError } = useQuery<SelectOption[]>({
    queryKey: ['subcarriersDropdown'],
    queryFn: () => getDropdownOptions('subcarriers'),
  });

  const watchedCarrier = formHook.watch('carrier');
  const watchedSubcarrier = formHook.watch('subcarrier');
  const watchedDriverName = formHook.watch('driverName');
  const watchedDepartureDate = formHook.watch('departureDate');
  const watchedArrivalDate = formHook.watch('arrivalDate');
  const watchedSenderAddress = formHook.watch('senderAddress');
  const watchedConsigneeAddress = formHook.watch('consigneeAddress');

  useEffect(() => {
    if (watchedCarrier && watchedSubcarrier && watchedDriverName && watchedDepartureDate && watchedArrivalDate && watchedSenderAddress && watchedConsigneeAddress) {
      const preparedAiInput: SuggestShipmentDetailsInput = {
        carrier: watchedCarrier,
        subcarrier: watchedSubcarrier,
        driverName: watchedDriverName,
        departureDate: format(watchedDepartureDate, 'yyyy-MM-dd'),
        arrivalDate: format(watchedArrivalDate, 'yyyy-MM-dd'),
        senderAddress: watchedSenderAddress,
        consigneeAddress: watchedConsigneeAddress,
      };
      setAiInput(preparedAiInput);
      setShowAISuggestions(true);
    } else {
      setShowAISuggestions(false);
      setAiInput(null);
    }
  }, [watchedCarrier, watchedSubcarrier, watchedDriverName, watchedDepartureDate, watchedArrivalDate, watchedSenderAddress, watchedConsigneeAddress]);


  const onSubmit = async (data: ShipmentFormData) => {
    setIsSubmitting(true);
    try {
      const shipmentDataForFirestore = {
        ...data,
        departureDate: new Date(data.departureDate),
        arrivalDate: new Date(data.arrivalDate),
        senderAddress: data.senderAddress || (appSettings?.defaultSenderAddress || DEFAULT_SENDER_ADDRESS),
        consigneeAddress: data.consigneeAddress || (appSettings?.defaultConsigneeAddress || DEFAULT_CONSIGNEE_ADDRESS),
      };
      
      const newShipmentId = await addShipmentToFirestore(shipmentDataForFirestore);
      
      toast({
        title: "Shipment Created",
        description: "The new shipment has been saved successfully.",
        variant: "default", 
      });

      await queryClient.invalidateQueries({ queryKey: ['shipments'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboardStats'] }); // If exists

      formHook.reset(); // Reset to initial values including fetched defaults
      setShowAISuggestions(false); 
      setAiInput(null);
      
      router.push(`/shipments/${newShipmentId}`); 
    } catch (error) {
      console.error("Error saving shipment:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save the shipment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoadingAppSettings) {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
            {isAdmin && (
                <div className="space-y-6 border-t border-border pt-6 mt-6">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            )}
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-1/4" />
            <div className="flex justify-end space-x-3 pt-6">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
            </div>
        </div>
    );
  }


  return (
    <Form {...formHook}>
      <form onSubmit={formHook.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={formHook.control}
            name="carrier"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="carrier">Carrier</Label>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value}
                  disabled={isLoadingCarriers || !!carriersError}
                >
                  <FormControl>
                    <SelectTrigger id="carrier" className="mt-1">
                      <SelectValue placeholder="Select carrier" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingCarriers && <SelectItem value="loading_carriers_sentinel" disabled>Loading carriers...</SelectItem>}
                    {carriersError && <SelectItem value="error_carriers_sentinel" disabled>Error: {(carriersError as Error).message}</SelectItem>}
                    {!isLoadingCarriers && !carriersError && carriers?.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formHook.control}
            name="subcarrier"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="subcarrier">Subcarrier</Label>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value}
                  disabled={isLoadingSubcarriers || !!subcarriersError}
                >
                  <FormControl>
                    <SelectTrigger id="subcarrier" className="mt-1">
                      <SelectValue placeholder="Select subcarrier" />
                    SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingSubcarriers && <SelectItem value="loading_subcarriers_sentinel" disabled>Loading subcarriers...</SelectItem>}
                    {subcarriersError && <SelectItem value="error_subcarriers_sentinel" disabled>Error: {(subcarriersError as Error).message}</SelectItem>}
                    {!isLoadingSubcarriers && !subcarriersError && subcarriers?.map(sc => <SelectItem key={sc.value} value={sc.value}>{sc.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={formHook.control}
          name="driverName"
          render={({ field }) => (
            <FormItem>
              <Label htmlFor="driverName">Driver Name</Label>
              <FormControl>
                <Input id="driverName" {...field} className="mt-1" placeholder="Enter driver's full name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={formHook.control}
            name="departureDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <Label htmlFor="departureDate">Departure Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal mt-1", !field.value && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  PopoverContent>
                Popover>
                <FormMessage />
              FormItem>
            )}
          />
          <FormField
            control={formHook.control}
            name="arrivalDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <Label htmlFor="arrivalDate">Arrival Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal mt-1", !field.value && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  PopoverContent>
                Popover>
                <FormMessage />
              FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={formHook.control}
            name="sealNumber"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="sealNumber">Seal Number</Label>
                <FormControl>
                  <Input id="sealNumber" {...field} className="mt-1" placeholder="Optional" />
                FormControl>
                <FormMessage />
              FormItem>
            )}
          />
          <FormField
            control={formHook.control}
            name="truckRegistration"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="truckRegistration">Truck Registration #</Label>
                <FormControl>
                  <Input id="truckRegistration" {...field} className="mt-1" placeholder="Optional" />
                FormControl>
                <FormMessage />
              FormItem>
            )}
          />
          <FormField
            control={formHook.control}
            name="trailerRegistration"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="trailerRegistration">Trailer Registration #</Label>
                <FormControl>
                  <Input id="trailerRegistration" {...field} className="mt-1" placeholder="Optional" />
                FormControl>
                <FormMessage />
              FormItem>
            )}
          />
        </div>
        
        {isAdmin && (
          <div className="space-y-6 border-t border-border pt-6 mt-6">
              <h3 className="text-lg font-medium text-foreground">
                  Address Information (Admin only)
              </h3>
              <FormField
                control={formHook.control}
                name="senderAddress"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="senderAddress">Sender Address</Label>
                    <FormControl>
                      <Textarea id="senderAddress" {...field} className="mt-1 min-h-[80px]" />
                    FormControl>
                    <FormMessage />
                  FormItem>
                )}
              />
              <FormField
                control={formHook.control}
                name="consigneeAddress"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="consigneeAddress">Consignee Address</Label>
                    <FormControl>
                      <Textarea id="consigneeAddress" {...field} className="mt-1 min-h-[80px]" />
                    FormControl>
                    <FormMessage />
                  FormItem>
                )}
              />
          </div>
        )}

        <FormField
            control={formHook.control}
            name="totalWeight"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="totalWeight">Total Weight (kg)</Label>
                <FormControl>
                  <Input id="totalWeight" type="number" {...field} onChange={event => field.onChange(event.target.value === '' ? undefined : +event.target.value)} className="mt-1" placeholder="Optional, e.g., 1250.5" />
                FormControl>
                <FormMessage />
              FormItem>
            )}
          />

        <FormField
          control={formHook.control}
          name="status"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-4">
              <FormControl>
                <Switch
                  id="status"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              FormControl>
              <Label htmlFor="status" className="text-base">
                Mark as Completed (Status: {formHook.watch("status") ? "Completed" : "Pending"})
              </Label>
            FormItem>
          )}
        />

        {showAISuggestions && aiInput && (
          <div className="mt-8 border-t border-border pt-8">
             <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
              <Lightbulb className="w-6 h-6 mr-2 text-yellow-400" />
              AI Suggestions for Shipment Details
            </h3>
            <AISuggestionSection input={aiInput} />
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-6">
          <Button type="button" variant="outline" onClick={() => { router.back(); }}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Shipment"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
