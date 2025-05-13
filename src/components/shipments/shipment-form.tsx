"use client";

import { useEffect, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getDropdownOptions } from '@/lib/firebase/dropdownService';
import type { Shipment, DropdownItem, ShipmentStatus } from '@/lib/types';
import { DEFAULT_SENDER_ADDRESS, DEFAULT_CONSIGNEE_ADDRESS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label'; // Keep if used directly, FormLabel is preferred within FormField
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
import { useQuery } from '@tanstack/react-query';

const shipmentFormSchema = z.object({
  carrierId: z.string().min(1, "Carrier is required"),
  subcarrierId: z.string().optional().default(''),
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
  senderAddress: z.string().optional().default(DEFAULT_SENDER_ADDRESS),
  consigneeAddress: z.string().optional().default(DEFAULT_CONSIGNEE_ADDRESS),
}).refine(data => data.arrivalDate >= data.departureDate, {
    message: "Arrival date cannot be before departure date.",
    path: ["arrivalDate"],
});

type ShipmentFormValues = z.infer<typeof shipmentFormSchema>;

interface ShipmentFormProps {
  isAdmin: boolean;
  initialData?: Shipment | null;
  onSubmit: (data: Partial<Shipment>) => Promise<string | void>;
  isEditing?: boolean;
  shipmentId?: string;
  onSaveSuccess?: (shipmentId: string) => void;
}

const fetchCarriers = () => getDropdownOptions('carriers');
const fetchSubcarriers = () => getDropdownOptions('subcarriers');

export default function ShipmentForm({
  isAdmin,
  initialData,
  onSubmit,
  isEditing: isEditingProp,
  shipmentId: existingShipmentId,
  onSaveSuccess,
}: ShipmentFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEffectivelyEditing = initialData ? isEditingProp ?? false : true;

  const { data: carrierOptions, isLoading: isLoadingCarriers, error: errorCarriers } = useQuery({
      queryKey: ['carriers'],
      queryFn: fetchCarriers,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
  });
  const { data: subcarrierOptions, isLoading: isLoadingSubcarriers, error: errorSubcarriers } = useQuery({
        queryKey: ['subcarriers'],
        queryFn: fetchSubcarriers,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });

  const dropdownsLoading = isLoadingCarriers || isLoadingSubcarriers;

  const formHook = useForm<ShipmentFormValues>({
    resolver: zodResolver(shipmentFormSchema),
    defaultValues: {
      carrierId: initialData?.carrierId ?? '',
      subcarrierId: initialData?.subcarrierId ?? '',
      driverName: initialData?.driverName ?? '',
      departureDate: initialData?.departureDate?.toDate() ?? new Date(),
      arrivalDate: initialData?.arrivalDate?.toDate() ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: initialData?.status ?? 'Pending',
      sealNumber: initialData?.sealNumber ?? '',
      truckRegistration: initialData?.truckRegistration ?? '',
      trailerRegistration: initialData?.trailerRegistration ?? '',
      senderAddress: initialData?.senderAddress ?? DEFAULT_SENDER_ADDRESS,
      consigneeAddress: initialData?.consigneeAddress ?? DEFAULT_CONSIGNEE_ADDRESS,
    },
  });

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
        formHook.reset({
            carrierId: '', subcarrierId: '', driverName: '',
            departureDate: new Date(), arrivalDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: 'Pending', sealNumber: '', truckRegistration: '', trailerRegistration: '',
            senderAddress: DEFAULT_SENDER_ADDRESS, consigneeAddress: DEFAULT_CONSIGNEE_ADDRESS
        });
     }
   }, [initialData, formHook.reset]);

  const handleFormSubmit = async (data: ShipmentFormValues) => {
    setIsSubmitting(true);
    try {
        const shipmentDataToSave: Partial<Shipment> = {
             ...data,
             departureDate: Timestamp.fromDate(data.departureDate),
             arrivalDate: Timestamp.fromDate(data.arrivalDate),
             subcarrierId: data.subcarrierId || undefined,
             sealNumber: data.sealNumber || undefined,
             truckRegistration: data.truckRegistration || undefined,
             trailerRegistration: data.trailerRegistration || undefined,
             senderAddress: data.senderAddress || undefined,
             consigneeAddress: data.consigneeAddress || undefined,
        };

        const resultId = await onSubmit(shipmentDataToSave);

        if (onSaveSuccess) {
            onSaveSuccess(typeof resultId === 'string' ? resultId : existingShipmentId || '');
        }

    } catch (error: any) {
      console.error("Error during shipment save/update process:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formDisabled = !isEffectivelyEditing || isSubmitting || dropdownsLoading || (initialData?.status === 'Completed' && !isAdmin);

  return (
    <Form {...formHook}>
      <form onSubmit={formHook.handleSubmit(handleFormSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
          <FormField
            control={formHook.control}
            name="carrierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Carrier</FormLabel>
                 {isLoadingCarriers ? <Skeleton className="h-10 w-full" /> :
                    <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
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
                 <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={formHook.control}
            name="subcarrierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subcarrier (Optional)</FormLabel>
                 {isLoadingSubcarriers ? <Skeleton className="h-10 w-full" /> :
                    <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                        disabled={formDisabled || !!errorSubcarriers}
                    >
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select a subcarrier (optional)" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {/* <SelectItem value="">None</SelectItem>  Removed this line */}
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

           <FormField
            control={formHook.control}
            name="status"
            render={({ field }) => (
              <FormItem className="flex flex-col pt-2 md:pt-0 md:justify-end">
                <div className="space-y-1">
                    <FormLabel className='mb-2'>Status</FormLabel>
                    <div className='flex items-center space-x-2 pt-2'>
                        <FormControl>
                            <Switch
                                id="status-switch"
                                checked={field.value === 'Completed'}
                                onCheckedChange={(checked) => field.onChange(checked ? 'Completed' : 'Pending')}
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
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date("2000-01-01") || formDisabled}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

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

           {!isAdmin && <div className="md:col-span-1"></div>}

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
