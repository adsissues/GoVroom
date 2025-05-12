
"use client";

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addShipment, updateShipment } from '@/lib/firebase/shipmentsService';
import { getDropdownOptions } from '@/lib/firebase/dropdownService';
import type { Shipment, DropdownItem, ShipmentStatus } from '@/lib/types';
import { DEFAULT_SENDER_ADDRESS, DEFAULT_CONSIGNEE_ADDRESS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { CalendarIcon, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';


// Adjusted Schema for Form (can differ slightly from DB model for form handling)
const shipmentFormSchema = z.object({
  carrierId: z.string().min(1, "Carrier is required"),
  subcarrierId: z.string().optional(),
  driverName: z.string().min(1, "Driver name is required"),
  departureDate: z.date({ required_error: "Departure date is required." }),
  arrivalDate: z.date({ required_error: "Arrival date is required." }),
  status: z.enum(['Pending', 'Completed']).default('Pending'),
  sealNumber: z.string().optional(),
  truckRegistration: z.string().optional(),
  trailerRegistration: z.string().optional(),
  senderAddress: z.string().optional(),
  consigneeAddress: z.string().optional(),
});

type ShipmentFormValues = z.infer<typeof shipmentFormSchema>;

interface ShipmentFormProps {
  isAdmin: boolean;
  initialData?: Shipment | null; // For editing
  onSubmit: (data: Partial<Shipment>) => Promise<void>; // Modified onSubmit prop
  isEditing?: boolean; // Control edit mode from parent
  shipmentId?: string; // Needed if form enables child actions like adding details
  onSaveSuccess?: (shipmentId: string) => void; // Callback on successful save
}

export default function ShipmentForm({
  isAdmin,
  initialData,
  onSubmit,
  isEditing = initialData ? false : true, // Default to edit mode if new, view mode if existing
  shipmentId,
  onSaveSuccess,
}: ShipmentFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownsLoading, setDropdownsLoading] = useState(true);
  const [carrierOptions, setCarrierOptions] = useState<DropdownItem[]>([]);
  const [subcarrierOptions, setSubcarrierOptions] = useState<DropdownItem[]>([]);

  const formHook = useForm<ShipmentFormValues>({
    resolver: zodResolver(shipmentFormSchema),
    defaultValues: {
      carrierId: initialData?.carrierId ?? '',
      subcarrierId: initialData?.subcarrierId ?? '',
      driverName: initialData?.driverName ?? '',
      departureDate: initialData?.departureDate?.toDate() ?? new Date(),
      arrivalDate: initialData?.arrivalDate?.toDate() ?? new Date(Date.now() + 24 * 60 * 60 * 1000), // Default to tomorrow
      status: initialData?.status ?? 'Pending',
      sealNumber: initialData?.sealNumber ?? '',
      truckRegistration: initialData?.truckRegistration ?? '',
      trailerRegistration: initialData?.trailerRegistration ?? '',
      senderAddress: initialData?.senderAddress ?? DEFAULT_SENDER_ADDRESS,
      consigneeAddress: initialData?.consigneeAddress ?? DEFAULT_CONSIGNEE_ADDRESS,
    },
  });

   // Reset form if initialData changes (e.g., navigating between shipments)
   useEffect(() => {
     formHook.reset({
       carrierId: initialData?.carrierId ?? '',
       subcarrierId: initialData?.subcarrierId ?? '',
       driverName: initialData?.driverName ?? '',
       departureDate: initialData?.departureDate?.toDate() ?? new Date(),
       arrivalDate: initialData?.arrivalDate?.toDate() ?? new Date(Date.now() + 24 * 60 * 60 * 1000), // Default to tomorrow
       status: initialData?.status ?? 'Pending',
       sealNumber: initialData?.sealNumber ?? '',
       truckRegistration: initialData?.truckRegistration ?? '',
       trailerRegistration: initialData?.trailerRegistration ?? '',
       senderAddress: initialData?.senderAddress ?? DEFAULT_SENDER_ADDRESS,
       consigneeAddress: initialData?.consigneeAddress ?? DEFAULT_CONSIGNEE_ADDRESS,
     });
   }, [initialData, formHook.reset]); // Dependency includes reset

  // Fetch dropdown options
  useEffect(() => {
    const fetchOptions = async () => {
      setDropdownsLoading(true);
      try {
        const [carriers, subcarriers] = await Promise.all([
          getDropdownOptions('carriers'),
          getDropdownOptions('subcarriers'),
        ]);
        setCarrierOptions(carriers);
        setSubcarrierOptions(subcarriers);
      } catch (error) {
        console.error("Error fetching dropdown options:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load dropdown options." });
      } finally {
        setDropdownsLoading(false);
      }
    };
    fetchOptions();
  }, [toast]);

  const handleFormSubmit = async (data: ShipmentFormValues) => {
    setIsLoading(true);
    try {
        const shipmentData: Partial<Shipment> = {
             ...data,
             departureDate: Timestamp.fromDate(data.departureDate),
             arrivalDate: Timestamp.fromDate(data.arrivalDate),
             // Ensure optional fields are handled correctly if empty
             subcarrierId: data.subcarrierId || undefined,
             sealNumber: data.sealNumber || undefined,
             truckRegistration: data.truckRegistration || undefined,
             trailerRegistration: data.trailerRegistration || undefined,
             senderAddress: data.senderAddress || undefined,
             consigneeAddress: data.consigneeAddress || undefined,
        };

        await onSubmit(shipmentData); // Use the passed onSubmit prop

        // No navigation here, parent component handles success (e.g., closing edit mode)
        // if (onSaveSuccess) {
        //     onSaveSuccess(shipmentId || 'new'); // Pass ID if available
        // }

    } catch (error: any) {
      console.error("Error saving shipment:", error);
      toast({
        title: 'Save Failed',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

   const formDisabled = !isEditing || isLoading || dropdownsLoading || initialData?.status === 'Completed';


  return (
    <Form {...formHook}>
      <form onSubmit={formHook.handleSubmit(handleFormSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Carrier */}
          <FormField
            control={formHook.control}
            name="carrierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Carrier</FormLabel>
                 {dropdownsLoading ? <Skeleton className="h-10 w-full" /> :
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={formDisabled}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a carrier" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {carrierOptions.map((option) => (
                      <SelectItem key={option.id} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Subcarrier */}
          <FormField
            control={formHook.control}
            name="subcarrierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subcarrier (Optional)</FormLabel>
                 {dropdownsLoading ? <Skeleton className="h-10 w-full" /> :
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={formDisabled}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subcarrier" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {subcarrierOptions.map((option) => (
                      <SelectItem key={option.id} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Driver Name */}
          <FormField
            control={formHook.control}
            name="driverName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Driver Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter driver's name" {...field} disabled={formDisabled} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

           {/* Status Toggle */}
           <FormField
            control={formHook.control}
            name="status"
            render={({ field }) => (
              <FormItem className="flex flex-col pt-2">
                <FormLabel className='mb-2'>Status</FormLabel>
                <div className='flex items-center space-x-2'>
                    <FormControl>
                        <Switch
                        checked={field.value === 'Completed'}
                        onCheckedChange={(checked) => field.onChange(checked ? 'Completed' : 'Pending')}
                        disabled={formDisabled}
                        />
                    </FormControl>
                    <Label htmlFor="status-switch" className={cn(field.value === 'Completed' ? "text-green-600" : "text-amber-600")}>
                         {field.value}
                     </Label>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />


          {/* Departure Date */}
          <FormField
            control={formHook.control}
            name="departureDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Departure Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                         disabled={formDisabled}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                         date < new Date("1900-01-01") || formDisabled
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Arrival Date */}
          <FormField
            control={formHook.control}
            name="arrivalDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Arrival Date</FormLabel>
                 <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                         disabled={formDisabled}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                       disabled={(date) =>
                         date < (formHook.getValues("departureDate") || new Date("1900-01-01")) || formDisabled // Ensure arrival is after departure
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Seal Number */}
          <FormField
            control={formHook.control}
            name="sealNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Seal Number (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Enter seal number" {...field} disabled={formDisabled} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Truck Registration # */}
           <FormField
            control={formHook.control}
            name="truckRegistration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Truck Reg # (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Enter truck registration" {...field} disabled={formDisabled} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />


          {/* Trailer Registration # */}
          <FormField
            control={formHook.control}
            name="trailerRegistration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Trailer Reg # (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Enter trailer registration" {...field} disabled={formDisabled} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        </div>

        {/* Sender & Consignee Addresses (Admin Only) */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6 mt-6">
             <FormField
               control={formHook.control}
               name="senderAddress"
               render={({ field }) => (
                 <FormItem>
                   <FormLabel>Sender Address (Admin)</FormLabel>
                   <FormControl>
                     <Textarea placeholder="Enter sender address" {...field} disabled={formDisabled} rows={4} />
                   </FormControl>
                   <FormMessage />
                 </FormItem>
               )}
             />
              <FormField
               control={formHook.control}
               name="consigneeAddress"
               render={({ field }) => (
                 <FormItem>
                   <FormLabel>Consignee Address (Admin)</FormLabel>
                   <FormControl>
                     <Textarea placeholder="Enter consignee address" {...field} disabled={formDisabled} rows={4} />
                   </FormControl>
                   <FormMessage />
                 </FormItem>
               )}
             />
          </div>
        )}

        {/* Save Button */}
         {isEditing && (
            <div className="flex justify-end pt-6 border-t">
             <Button type="submit" disabled={formDisabled}>
               <Save className="mr-2 h-4 w-4" />
               {isLoading ? 'Saving...' : (initialData ? 'Update Shipment' : 'Save Shipment')}
             </Button>
            </div>
         )}
      </form>
    </Form>
  );
}
```