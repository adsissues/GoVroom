
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addShipment, updateShipment } from '@/lib/firebase/shipmentsService'; // Assuming these exist and work
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
import { CalendarIcon, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { useQuery } from '@tanstack/react-query'; // For caching dropdowns

// --- Zod Schema Definition ---
// Ensure dates are required and handled correctly.
const shipmentFormSchema = z.object({
  carrierId: z.string().min(1, "Carrier is required"),
  subcarrierId: z.string().optional().default(''), // Optional, default to empty string
  driverName: z.string().min(1, "Driver name is required").default(''),
  departureDate: z.date({
    required_error: "Departure date is required.",
    invalid_type_error: "Invalid date format.",
   }),
  arrivalDate: z.date({
    required_error: "Arrival date is required.",
    invalid_type_error: "Invalid date format.",
   }),
  status: z.enum(['Pending', 'Completed'], { required_error: "Status is required." }).default('Pending'),
  sealNumber: z.string().optional().default(''),
  truckRegistration: z.string().optional().default(''),
  trailerRegistration: z.string().optional().default(''),
  // Admin fields are optional in the schema itself but controlled by UI visibility
  senderAddress: z.string().optional().default(DEFAULT_SENDER_ADDRESS),
  consigneeAddress: z.string().optional().default(DEFAULT_CONSIGNEE_ADDRESS),
}).refine(data => data.arrivalDate >= data.departureDate, { // Add validation for arrival >= departure
    message: "Arrival date cannot be before departure date.",
    path: ["arrivalDate"], // Point error to arrivalDate field
});

type ShipmentFormValues = z.infer<typeof shipmentFormSchema>;

// --- Component Props ---
interface ShipmentFormProps {
  isAdmin: boolean;
  initialData?: Shipment | null; // For editing existing shipment
  onSubmit: (data: Partial<Shipment>) => Promise<string | void>; // Return type can be ID for new, void for update
  isEditing?: boolean; // Control edit mode (passed from parent for detail page)
  shipmentId?: string; // Passed for existing shipments
  onSaveSuccess?: (shipmentId: string) => void; // Callback on successful save
}

// --- Fetch Functions for TanStack Query ---
const fetchCarriers = () => getDropdownOptions('carriers');
const fetchSubcarriers = () => getDropdownOptions('subcarriers');


// --- Component Implementation ---
export default function ShipmentForm({
  isAdmin,
  initialData,
  onSubmit,
  isEditing: isEditingProp, // Rename to avoid conflict with internal state if needed
  shipmentId: existingShipmentId,
  onSaveSuccess,
}: ShipmentFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine initial edit mode: if it's a new form (no initialData), start in edit mode.
  // If it's an existing form, use the isEditingProp passed from the parent (defaults to false).
  const isEffectivelyEditing = initialData ? isEditingProp ?? false : true;

  // --- TanStack Query for Dropdowns ---
  const { data: carrierOptions, isLoading: isLoadingCarriers, error: errorCarriers } = useQuery({
      queryKey: ['carriers'], // Unique key for carriers
      queryFn: fetchCarriers,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      gcTime: 10 * 60 * 1000,
  });
  const { data: subcarrierOptions, isLoading: isLoadingSubcarriers, error: errorSubcarriers } = useQuery({
        queryKey: ['subcarriers'], // Unique key for subcarriers
        queryFn: fetchSubcarriers,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });

  const dropdownsLoading = isLoadingCarriers || isLoadingSubcarriers;


  // --- Form Hook Setup ---
  const formHook = useForm<ShipmentFormValues>({
    resolver: zodResolver(shipmentFormSchema),
    // Set default values based on initialData or sensible defaults
    defaultValues: {
      carrierId: initialData?.carrierId ?? '',
      subcarrierId: initialData?.subcarrierId ?? '',
      driverName: initialData?.driverName ?? '',
      // Convert Timestamps back to Date objects for the form
      departureDate: initialData?.departureDate?.toDate() ?? new Date(), // Default today
      arrivalDate: initialData?.arrivalDate?.toDate() ?? new Date(Date.now() + 24 * 60 * 60 * 1000), // Default tomorrow
      status: initialData?.status ?? 'Pending',
      sealNumber: initialData?.sealNumber ?? '',
      truckRegistration: initialData?.truckRegistration ?? '',
      trailerRegistration: initialData?.trailerRegistration ?? '',
      senderAddress: initialData?.senderAddress ?? DEFAULT_SENDER_ADDRESS,
      consigneeAddress: initialData?.consigneeAddress ?? DEFAULT_CONSIGNEE_ADDRESS,
    },
  });

   // --- Reset Form on Data Change ---
   // Reset form if initialData changes (e.g., navigating between detail pages)
   useEffect(() => {
     if (initialData) {
        formHook.reset({
            carrierId: initialData.carrierId ?? '',
            subcarrierId: initialData.subcarrierId ?? '',
            driverName: initialData.driverName ?? '',
            departureDate: initialData.departureDate?.toDate() ?? new Date(),
            arrivalDate: initialData.arrivalDate?.toDate() ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: initialData.status ?? 'Pending',
            sealNumber: initialData.sealNumber ?? '',
            truckRegistration: initialData.truckRegistration ?? '',
            trailerRegistration: initialData.trailerRegistration ?? '',
            senderAddress: initialData.senderAddress ?? DEFAULT_SENDER_ADDRESS,
            consigneeAddress: initialData.consigneeAddress ?? DEFAULT_CONSIGNEE_ADDRESS,
       });
     } else {
        // Reset to defaults for a new form (though initial setup handles this)
        formHook.reset({
            carrierId: '', subcarrierId: '', driverName: '',
            departureDate: new Date(), arrivalDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: 'Pending', sealNumber: '', truckRegistration: '', trailerRegistration: '',
            senderAddress: DEFAULT_SENDER_ADDRESS, consigneeAddress: DEFAULT_CONSIGNEE_ADDRESS
        });
     }
   }, [initialData, formHook.reset]);


  // --- Form Submission Handler ---
  const handleFormSubmit = async (data: ShipmentFormValues) => {
    setIsSubmitting(true);
    try {
        // Prepare data for Firestore (convert Dates to Timestamps)
        const shipmentDataToSave: Partial<Shipment> = {
             ...data,
             // Convert dates back to Timestamps for Firestore
             departureDate: Timestamp.fromDate(data.departureDate),
             arrivalDate: Timestamp.fromDate(data.arrivalDate),
             // Ensure optional empty strings become undefined if necessary for Firestore rules/logic
             subcarrierId: data.subcarrierId || undefined,
             sealNumber: data.sealNumber || undefined,
             truckRegistration: data.truckRegistration || undefined,
             trailerRegistration: data.trailerRegistration || undefined,
             senderAddress: data.senderAddress || undefined, // Should have defaults, but handle empty case
             consigneeAddress: data.consigneeAddress || undefined,
        };

        // Call the onSubmit prop passed from the parent (handles add vs update logic)
        const resultId = await onSubmit(shipmentDataToSave);

        // If callback provided, call it (e.g., to exit edit mode on detail page)
        if (onSaveSuccess) {
            // For new shipments, resultId should be the new ID. For updates, use existing ID.
            onSaveSuccess(typeof resultId === 'string' ? resultId : existingShipmentId || '');
        }

    } catch (error: any) {
      // Error handling is done in the parent's onSubmit handler (e.g., NewShipmentPage, ShipmentDetailPage)
      // which calls toast. We don't need duplicate toasts here.
      console.error("Error during shipment save/update process:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine if the entire form should be disabled
  const formDisabled = !isEffectivelyEditing || isSubmitting || dropdownsLoading || (initialData?.status === 'Completed' && !isAdmin);

  // --- JSX Render ---
  return (
    <Form {...formHook}>
      <form onSubmit={formHook.handleSubmit(handleFormSubmit)} className="space-y-8">
        {/* Main Fields Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
          {/* Carrier */}
          <FormField
            control={formHook.control}
            name="carrierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Carrier</FormLabel>
                 {isLoadingCarriers ? <Skeleton className="h-10 w-full" /> :
                    <Select
                        onValueChange={field.onChange}
                        value={field.value || ""} // Ensure value is controlled, defaults to "" if null/undefined
                        disabled={formDisabled || !!errorCarriers}
                    >
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select a carrier" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {carrierOptions?.map((option) => (
                        <SelectItem key={option.id} value={option.value}>
                            {option.label}
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                 }
                {errorCarriers && <FormMessage>Error loading carriers.</FormMessage>}
                 <FormMessage /> {/* For Zod validation errors */}
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
                 {isLoadingSubcarriers ? <Skeleton className="h-10 w-full" /> :
                    <Select
                        onValueChange={field.onChange}
                        value={field.value || ""} // Controlled component
                        disabled={formDisabled || !!errorSubcarriers}
                    >
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select a subcarrier (optional)" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="">None</SelectItem> {/* Allow clearing */}
                        {subcarrierOptions?.map((option) => (
                        <SelectItem key={option.id} value={option.value}>
                            {option.label}
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                 }
                {errorSubcarriers && <FormMessage>Error loading subcarriers.</FormMessage>}
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
                  <Input placeholder="Enter driver's name" {...field} value={field.value || ''} disabled={formDisabled} />
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
              <FormItem className="flex flex-col pt-2 md:pt-0 md:justify-end">
                {/* Push label below for alignment in grid */}
                <div className="space-y-1">
                    <FormLabel className='mb-2'>Status</FormLabel>
                    <div className='flex items-center space-x-2 pt-2'>
                        <FormControl>
                            <Switch
                                id="status-switch"
                                checked={field.value === 'Completed'}
                                onCheckedChange={(checked) => field.onChange(checked ? 'Completed' : 'Pending')}
                                // Disable if form is generally disabled, OR if it's completed and user is not admin
                                disabled={formDisabled || (initialData?.status === 'Completed' && !isAdmin)}
                                aria-readonly={formDisabled || (initialData?.status === 'Completed' && !isAdmin)}
                            />
                        </FormControl>
                        <Label htmlFor="status-switch" className={cn("font-semibold", field.value === 'Completed' ? "text-green-600" : "text-amber-600")}>
                            {field.value}
                        </Label>
                    </div>
                    <FormMessage />
                </div>
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
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange} // react-hook-form handles the state update
                      disabled={(date) => date < new Date("2000-01-01") || formDisabled} // Example past limit
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
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
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
                         // Disable dates before the selected departure date or general disable
                         (formHook.getValues("departureDate") && date < formHook.getValues("departureDate")) || formDisabled
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
                  <Input placeholder="Enter seal number" {...field} value={field.value || ''} disabled={formDisabled} />
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
                  <Input placeholder="Enter truck registration" {...field} value={field.value || ''} disabled={formDisabled} />
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
                  <Input placeholder="Enter trailer registration" {...field} value={field.value || ''} disabled={formDisabled} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

           {/* Spacer to fill grid if admin fields aren't shown */}
           {!isAdmin && <div className="md:col-span-1"></div>}


           {/* Sender & Consignee Addresses (Admin Only) */}
           {isAdmin && (
             <>
              <FormField
                control={formHook.control}
                name="senderAddress"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Sender Address (Admin Edit)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter sender address" {...field} value={field.value || ''} disabled={formDisabled} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={formHook.control}
                name="consigneeAddress"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Consignee Address (Admin Edit)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter consignee address" {...field} value={field.value || ''} disabled={formDisabled} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
             </>
           )}

        </div>


        {/* Save Button - Only show if editing is enabled */}
         {isEffectivelyEditing && (
            <div className="flex justify-end pt-6 border-t mt-8">
             <Button type="submit" disabled={formDisabled || isSubmitting}>
                {isSubmitting ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                 ) : (
                    <>
                        <Save className="mr-2 h-4 w-4" />
                        {initialData ? 'Update Shipment' : 'Save & Add Details'}
                    </>
                 )}
             </Button>
            </div>
         )}

         {/* Informational message if form is view-only */}
         {!isEffectivelyEditing && !formDisabled && initialData?.status !== 'Completed' && (
             <p className="text-sm text-muted-foreground text-center pt-4 italic">
                 Click the 'Edit' button to make changes to the main shipment details.
             </p>
         )}
          {initialData?.status === 'Completed' && !isAdmin && (
             <p className="text-sm text-destructive text-center pt-4">
                 This shipment is completed. Main details cannot be edited by users.
             </p>
         )}
      </form>
    </Form>
  );
}
