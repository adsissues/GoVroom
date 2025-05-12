
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { ShipmentDetail, DropdownItem } from '@/lib/types';
import { getDropdownOptions } from '@/lib/firebase/dropdownService';
import { TARE_WEIGHT_DEFAULT, BAG_WEIGHT_MULTIPLIER, SERVICE_FORMAT_MAPPING } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query'; // For dropdown caching

// --- Zod Schema Definition ---
const detailFormSchema = z.object({
  numPallets: z.coerce.number().min(0, "Pallets cannot be negative").default(1),
  numBags: z.coerce.number().min(0, "Bags cannot be negative").default(0),
  customerId: z.string().min(1, "Customer is required"),
  serviceId: z.string().min(1, "Service is required"),
  // Format becomes required only if SERVICE_FORMAT_MAPPING has an entry for the selected service
  formatId: z.string().optional(),
  tareWeight: z.coerce.number().min(0, "Tare weight cannot be negative"),
  grossWeight: z.coerce.number().min(0, "Gross weight cannot be negative"),
  dispatchNumber: z.string().optional(),
  doeId: z.string().optional(),
}).refine(data => {
    // If service requires a format, formatId must not be empty
    const requiresFormat = !!SERVICE_FORMAT_MAPPING[data.serviceId];
    return !requiresFormat || (requiresFormat && !!data.formatId);
}, {
    message: "Format is required for the selected service.",
    path: ["formatId"], // Point error to formatId field
}).refine(data => data.grossWeight >= data.tareWeight, { // Gross weight must be >= Tare weight
    message: "Gross weight cannot be less than tare weight.",
    path: ["grossWeight"],
});

type DetailFormValues = z.infer<typeof detailFormSchema>;

// --- Component Props ---
interface ShipmentDetailFormProps {
  shipmentId: string; // Parent shipment ID is always required
  detail?: ShipmentDetail | null; // Pass existing detail for editing, null/undefined for adding
  isOpen: boolean; // Control modal visibility from parent
  onClose: () => void; // Function to call when modal should close
  onSave: (data: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated'>) => Promise<void>; // Callback after successful save attempt
}

// --- Fetch Functions for TanStack Query ---
const fetchCustomers = () => getDropdownOptions('customers');
const fetchServices = () => getDropdownOptions('services');
const fetchDoes = () => getDropdownOptions('doe');
const fetchFormats = (formatCollectionId: string | null) => {
    if (!formatCollectionId) return Promise.resolve([]); // Return empty if no collection ID
    return getDropdownOptions(formatCollectionId);
};


// --- Component Implementation ---
export default function ShipmentDetailForm({
  shipmentId,
  detail,
  isOpen,
  onClose,
  onSave,
}: ShipmentDetailFormProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [currentServiceId, setCurrentServiceId] = useState<string>(detail?.serviceId ?? '');

  // Determine the format collection based on the currently selected service
  const formatCollectionId = useMemo(() => SERVICE_FORMAT_MAPPING[currentServiceId] || null, [currentServiceId]);
  const showFormatDropdown = !!formatCollectionId; // Show format only if there's a mapping

  // --- TanStack Query for Dropdowns ---
  const { data: customerOptions = [], isLoading: isLoadingCustomers } = useQuery({
      queryKey: ['customers'], queryFn: fetchCustomers, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 });
  const { data: serviceOptions = [], isLoading: isLoadingServices } = useQuery({
      queryKey: ['services'], queryFn: fetchServices, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 });
  const { data: doeOptions = [], isLoading: isLoadingDoes } = useQuery({
      queryKey: ['doe'], queryFn: fetchDoes, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 });
  const { data: formatOptions = [], isLoading: isLoadingFormats } = useQuery({
      queryKey: ['formats', formatCollectionId], // Include collection ID in key
      queryFn: () => fetchFormats(formatCollectionId),
      enabled: !!formatCollectionId && isOpen, // Only fetch if a valid collection ID exists and modal is open
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
  });

  const dropdownsLoading = isLoadingCustomers || isLoadingServices || isLoadingDoes || (showFormatDropdown && isLoadingFormats);

  // --- Form Hook Setup ---
  const formHook = useForm<DetailFormValues>({
    resolver: zodResolver(detailFormSchema),
    defaultValues: {
        numPallets: 1,
        numBags: 0,
        customerId: '',
        serviceId: '',
        formatId: '',
        tareWeight: TARE_WEIGHT_DEFAULT,
        grossWeight: 0,
        dispatchNumber: '',
        doeId: '',
    },
  });
  const { watch, setValue, reset, getValues, trigger } = formHook;

  // Watch relevant fields for dynamic calculations/updates
  const numBags = watch('numBags');
  const numPallets = watch('numPallets'); // Watch pallets to potentially hide bags
  const watchedServiceId = watch('serviceId');


  // --- Effects ---

  // Effect to reset form when modal opens/closes or detail data changes
  useEffect(() => {
    if (isOpen) {
      console.log("ShipmentDetailForm: Resetting form for detail:", detail?.id ?? 'New');
      reset({
        numPallets: detail?.numPallets ?? 1,
        numBags: detail?.numBags ?? 0,
        customerId: detail?.customerId ?? '',
        serviceId: detail?.serviceId ?? '',
        formatId: detail?.formatId ?? '',
        tareWeight: detail?.tareWeight ?? TARE_WEIGHT_DEFAULT,
        grossWeight: detail?.grossWeight ?? 0,
        dispatchNumber: detail?.dispatchNumber ?? '',
        doeId: detail?.doeId ?? '',
      });
      setCurrentServiceId(detail?.serviceId ?? ''); // Sync local service ID state
    } else {
       // Optional: Reset fully when closing to clear stale data if needed
       // reset(); // Resets to defaultValues defined in useForm
       // setCurrentServiceId('');
    }
  }, [isOpen, detail, reset]);


  // Update local service ID state when form value changes
  useEffect(() => {
    if (watchedServiceId !== currentServiceId) {
        setCurrentServiceId(watchedServiceId);
        // Reset formatId when service changes, as options will change
        setValue('formatId', '', { shouldValidate: true }); // Reset and validate
    }
  }, [watchedServiceId, currentServiceId, setValue]);


  // Auto-calculate Tare Weight based on number of bags
  useEffect(() => {
      let newTareWeight = TARE_WEIGHT_DEFAULT; // Start with default
      // Only auto-calculate if bags > 0
      if (numBags > 0) {
          newTareWeight = parseFloat((numBags * BAG_WEIGHT_MULTIPLIER).toFixed(3));
      }
      // Set the value only if it differs from the current form value
      if (newTareWeight !== getValues('tareWeight')) {
          setValue('tareWeight', newTareWeight, { shouldValidate: true });
          // Re-validate gross weight as tare weight change might affect gross >= tare validation
          trigger("grossWeight");
      }
  }, [numBags, setValue, getValues, trigger]);


  // --- Form Submission Handler ---
  const onSubmit = async (data: DetailFormValues) => {
    setIsSaving(true);
    console.log("ShipmentDetailForm: Submitting data:", data);
    try {
       // Prepare data for saving (omit fields not directly part of the DB model if needed)
       // Net weight calculation is handled by service/firestore helpers
       const saveData: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated' | 'netWeight'> = {
         numPallets: data.numPallets,
         numBags: data.numBags,
         customerId: data.customerId,
         serviceId: data.serviceId,
         formatId: showFormatDropdown ? data.formatId || '' : '', // Save format only if shown, ensure it's string
         tareWeight: data.tareWeight,
         grossWeight: data.grossWeight,
         dispatchNumber: data.dispatchNumber || undefined, // Save as undefined if empty
         doeId: data.doeId || undefined, // Save as undefined if empty
       };
       // Call the parent's save function
      await onSave(saveData);
      // Toast message is handled by the parent component after successful save
      // toast({ title: detail ? "Detail Updated" : "Detail Added", description: "Shipment item saved successfully." });
      onClose(); // Close dialog on successful save
    } catch (error) {
      console.error("Error saving shipment detail:", error);
      // Toast message is handled by the parent component on error
      // toast({ variant: "destructive", title: "Save Failed", description: error instanceof Error ? error.message : "Could not save item." });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render Logic ---
  return (
     <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{detail ? 'Edit Shipment Item' : 'Add Shipment Item'}</DialogTitle>
        </DialogHeader>
         {dropdownsLoading && isOpen ? ( // Show loading skeleton only when open
             <div className="space-y-4 p-6">
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
             </div>
         ) : (
             <Form {...formHook}>
                 {/* Use overflow-y-auto on the form itself if content might exceed modal height */}
                 <form onSubmit={formHook.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                     {/* Grid for layout */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                        {/* Number of Pallets */}
                        <FormField
                           control={formHook.control}
                           name="numPallets"
                           render={({ field }) => (
                           <FormItem>
                              <FormLabel>Number of Pallets</FormLabel>
                              <FormControl>
                                 <Input type="number" min="0" {...field} disabled={isSaving} />
                              </FormControl>
                              <FormMessage />
                           </FormItem>
                           )}
                        />
                         {/* Number of Bags (Conditional) */}
                         {/* Conditionally render based on numPallets > 0, but use visibility hidden for layout stability? */}
                         {/* Or just remove from DOM - simpler here */}
                         {numPallets > 0 && (
                           <FormField
                              control={formHook.control}
                              name="numBags"
                              render={({ field }) => (
                                 <FormItem>
                                    <FormLabel>Number of Bags</FormLabel>
                                    <FormControl>
                                       <Input type="number" min="0" {...field} disabled={isSaving} />
                                    </FormControl>
                                    <FormMessage />
                                 </FormItem>
                              )}
                           />
                         )}
                         {/* Customer Dropdown */}
                         <FormField
                            control={formHook.control}
                            name="customerId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Customer</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={isSaving || isLoadingCustomers}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a customer" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {customerOptions.map((option) => (
                                        <SelectItem key={option.id} value={option.value}>
                                        {option.label}
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                         />
                         {/* Service Dropdown */}
                         <FormField
                            control={formHook.control}
                            name="serviceId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Service</FormLabel>
                                <Select
                                    onValueChange={field.onChange} // Let react-hook-form handle value change
                                    value={field.value} // Controlled by react-hook-form
                                    disabled={isSaving || isLoadingServices}
                                 >
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a service" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {serviceOptions.map((option) => (
                                        <SelectItem key={option.id} value={option.value}>
                                        {option.label}
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                         />
                         {/* Format Dropdown (Conditional) */}
                         {showFormatDropdown && (
                            <FormField
                                control={formHook.control}
                                name="formatId"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Format</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value || ""} // Ensure controlled, default to ""
                                        disabled={isSaving || isLoadingFormats}
                                    >
                                    <FormControl>
                                        <SelectTrigger>
                                        <SelectValue placeholder="Select a format" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {isLoadingFormats && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                                        {!isLoadingFormats && formatOptions.length === 0 && <SelectItem value="no-options" disabled>No formats for this service</SelectItem>}
                                        {formatOptions.map((option) => (
                                        <SelectItem key={option.id} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                        ))}
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                          )}

                         {/* Tare Weight */}
                        <FormField
                           control={formHook.control}
                           name="tareWeight"
                           render={({ field }) => (
                              <FormItem>
                                 <FormLabel>Tare Weight (kg)</FormLabel>
                                 <FormControl>
                                    {/* Disable if bags > 0 as it's auto-calculated */}
                                    <Input type="number" step="0.001" min="0" {...field} disabled={isSaving || numBags > 0} title={numBags > 0 ? "Auto-calculated based on number of bags" : "Enter tare weight"}/>
                                 </FormControl>
                                 {numBags > 0 && <p className="text-xs text-muted-foreground pt-1">Auto-calculated ({numBags} bags × {BAG_WEIGHT_MULTIPLIER} kg/bag)</p>}
                                 <FormMessage />
                              </FormItem>
                           )}
                        />

                         {/* Gross Weight */}
                        <FormField
                           control={formHook.control}
                           name="grossWeight"
                           render={({ field }) => (
                           <FormItem>
                              <FormLabel>Gross Weight (kg)</FormLabel>
                              <FormControl>
                                 <Input type="number" step="0.001" min="0" {...field} disabled={isSaving} />
                              </FormControl>
                              <FormMessage />
                           </FormItem>
                           )}
                        />
                         {/* Dispatch Number */}
                         <FormField
                           control={formHook.control}
                           name="dispatchNumber"
                           render={({ field }) => (
                           <FormItem>
                              <FormLabel>Dispatch Number (Optional)</FormLabel>
                              <FormControl>
                                 <Input type="text" {...field} value={field.value || ''} disabled={isSaving} />
                              </FormControl>
                              <FormMessage />
                           </FormItem>
                           )}
                        />
                         {/* DOE Dropdown */}
                         <FormField
                           control={formHook.control}
                           name="doeId"
                           render={({ field }) => (
                              <FormItem>
                                 <FormLabel>DOE (Optional)</FormLabel>
                                 <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSaving || isLoadingDoes}>
                                    <FormControl>
                                       <SelectTrigger>
                                          <SelectValue placeholder="Select DOE" />
                                       </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                       <SelectItem value="">None</SelectItem> {/* Allow clearing */}
                                       {doeOptions.map((option) => (
                                          <SelectItem key={option.id} value={option.value}>
                                             {option.label}
                                          </SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                                 <FormMessage />
                              </FormItem>
                           )}
                         />
                     </div>
                     {/* Form Footer with Actions */}
                      <DialogFooter className="pt-6 border-t mt-6">
                         <DialogClose asChild>
                            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
                         </DialogClose>
                         <Button type="submit" disabled={isSaving || dropdownsLoading}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                </>
                               ) : (detail ? 'Update Item' : 'Add Item')
                            }
                         </Button>
                     </DialogFooter>
                 </form>
             </Form>
          )}
      </DialogContent>
    </Dialog>
  );
}
