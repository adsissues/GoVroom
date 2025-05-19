
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label as ShadcnLabel } from "@/components/ui/label"; // Renamed to avoid conflict with RHF Label
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { ShipmentDetail, DropdownItem } from '@/lib/types';
import { getDropdownOptions } from '@/lib/firebase/dropdownService';
import { ASENDIA_CUSTOMER_VALUE, SERVICE_FORMAT_MAPPING, DEFAULT_PRIOR_SERVICE_ID, TARE_WEIGHT_DEFAULT, BAG_WEIGHT_MULTIPLIER } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// Define default DOE ID
const DEFAULT_DOE_ID_VALUE = "UZ1";

// Updated Zod schema
const detailFormSchema = z.object({
  numPallets: z.coerce.number().min(0, "Pallets cannot be negative").default(1),
  numBags: z.coerce.number().min(0, "Bags cannot be negative").default(0),
  customerId: z.string().min(1, "Customer is required."),
  serviceId: z.string().min(1, "Service is required."),
  formatId: z.string().optional().default(''),
  tareWeight: z.coerce.number().min(0, "Tare weight cannot be negative."),
  grossWeight: z.coerce.number({invalid_type_error: "Gross weight must be a valid number."}).min(0, "Gross weight cannot be negative.").default(0),
  dispatchNumber: z.string().optional().refine(val => val === undefined || val === '' || /^[0-9]+$/.test(val), {
    message: "Dispatch Number must contain only digits.",
  }).default(''),
  doeId: z.string().optional().default(''),
}).refine(data => {
    const serviceKey = data.serviceId ? data.serviceId.toLowerCase() : '';
    const serviceRequiresFormat = serviceKey ? !!SERVICE_FORMAT_MAPPING[serviceKey] : false;
    if (serviceRequiresFormat) {
        return typeof data.formatId === 'string' && data.formatId.trim() !== '';
    }
    return true;
}, {
    message: "Format is required for the selected service.",
    path: ["formatId"],
});

type DetailFormValues = z.infer<typeof detailFormSchema>;

interface ShipmentDetailFormProps {
  shipmentId: string;
  detail?: ShipmentDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated' | 'netWeight'>) => Promise<void>;
}

const fetchCustomers = () => getDropdownOptions('customers');
const fetchServices = () => getDropdownOptions('services');
const fetchDoes = () => getDropdownOptions('doe');
const fetchFormats = (formatCollectionId: string | null) => {
    if (!formatCollectionId) return Promise.resolve([]);
    return getDropdownOptions(formatCollectionId);
};

export default function ShipmentDetailForm({
  shipmentId,
  detail,
  isOpen,
  onClose,
  onSave,
}: ShipmentDetailFormProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [currentServiceId, setCurrentServiceId] = useState<string>(DEFAULT_PRIOR_SERVICE_ID);
  const [showPalletInputMode, setShowPalletInputMode] = useState(true);

  // Fetch dropdown options
  const { data: customerOptions = [], isLoading: isLoadingCustomers, error: errorCustomers } = useQuery<DropdownItem[]>({
      queryKey: ['customers'], queryFn: fetchCustomers, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 });
  const { data: serviceOptions = [], isLoading: isLoadingServices, error: errorServices } = useQuery<DropdownItem[]>({
      queryKey: ['services'], queryFn: fetchServices, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 });
  const { data: doeOptions = [], isLoading: isLoadingDoes, error: errorDoes } = useQuery<DropdownItem[]>({
      queryKey: ['doe'], queryFn: fetchDoes, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 });

  const newFormDefaults: DetailFormValues = useMemo(() => ({
    numPallets: 1,
    numBags: 0,
    customerId: ASENDIA_CUSTOMER_VALUE,
    serviceId: DEFAULT_PRIOR_SERVICE_ID,
    formatId: '',
    tareWeight: TARE_WEIGHT_DEFAULT,
    grossWeight: 0,
    dispatchNumber: '',
    doeId: DEFAULT_DOE_ID_VALUE,
  }), []);

  const formHook = useForm<DetailFormValues>({
    resolver: zodResolver(detailFormSchema),
    defaultValues: newFormDefaults,
  });

  const { watch, setValue, reset, getValues, trigger, control, formState } = formHook;
  const numPalletsWatched = watch('numPallets');
  const numBagsWatched = watch('numBags');
  const watchedServiceId = watch('serviceId');
  const watchedFormatId = watch('formatId');


  const serviceLabelForFormat = useMemo(() => {
    if (isLoadingServices || !serviceOptions || serviceOptions.length === 0) return "FORMAT";
    const selectedService = serviceOptions.find(s => s.value === currentServiceId);
    return selectedService ? selectedService.label.toUpperCase() : "FORMAT";
  }, [currentServiceId, serviceOptions, isLoadingServices]);

  const formatCollectionId = useMemo(() => {
    const serviceKey = currentServiceId ? currentServiceId.toLowerCase() : '';
    const mappedCollection = serviceKey ? SERVICE_FORMAT_MAPPING[serviceKey] || null : null;
    // console.log(`[ShipmentDetailForm DEBUG] Service: ${currentServiceId}, ServiceKey: ${serviceKey}, Mapped Collection: ${mappedCollection}`);
    return mappedCollection;
  }, [currentServiceId]);

  const { data: rawFormatOptions = [], isLoading: isLoadingFormats, error: errorFormats } = useQuery<DropdownItem[]>({
      queryKey: ['formats', formatCollectionId],
      queryFn: () => fetchFormats(formatCollectionId),
      enabled: !!formatCollectionId && isOpen,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
  });

  const validCustomerOptions = useMemo(() => customerOptions.filter(option => option && typeof option.value === 'string' && option.value.trim() !== ''), [customerOptions]);
  const validServiceOptions = useMemo(() => serviceOptions.filter(option => option && typeof option.value === 'string' && option.value.trim() !== ''), [serviceOptions]);
  const validDoeOptions = useMemo(() => doeOptions.filter(option => option && typeof option.value === 'string' && option.value.trim() !== ''), [doeOptions]);
  const validFormatOptions = useMemo(() => rawFormatOptions.filter(option => option && typeof option.value === 'string' && option.value.trim() !== ''), [rawFormatOptions]);
  
  const dropdownsLoading = isLoadingCustomers || isLoadingServices || isLoadingDoes || (!!formatCollectionId && isLoadingFormats);

  // Function to synchronize RHF values based on mode
  const syncPalletBagRHFValues = useCallback((isPalletMode: boolean) => {
    if (isPalletMode) {
      setValue('numBags', 0, { shouldValidate: false });
      if (getValues('numPallets') === 0) {
        setValue('numPallets', 1, { shouldValidate: false });
      }
    } else { // Bag Mode
      setValue('numPallets', 0, { shouldValidate: false });
    }
  }, [setValue, getValues]);


  // Initialize or reset form when dialog opens or detail changes
  useEffect(() => {
    if (isOpen) {
      if (detail) {
        const initialPallets = detail.numPallets ?? 0;
        const initialBags = detail.numBags ?? 0;
        const initialTareWeight = detail.tareWeight ?? TARE_WEIGHT_DEFAULT;

        reset({
          numPallets: initialPallets,
          numBags: initialBags,
          customerId: detail.customerId ?? ASENDIA_CUSTOMER_VALUE,
          serviceId: detail.serviceId ?? DEFAULT_PRIOR_SERVICE_ID,
          formatId: detail.formatId ?? '',
          tareWeight: initialTareWeight,
          grossWeight: detail.grossWeight ?? 0,
          dispatchNumber: detail.dispatchNumber ?? '',
          doeId: detail.doeId ?? DEFAULT_DOE_ID_VALUE,
        });
        setCurrentServiceId(detail.serviceId ?? DEFAULT_PRIOR_SERVICE_ID);
        setShowPalletInputMode(initialPallets > 0 || (initialPallets === 0 && initialBags === 0));
      } else if (!isLoadingCustomers && !isLoadingServices && !isLoadingDoes) { // Adding new detail, ensure options are loaded
        reset(newFormDefaults);
        setCurrentServiceId(DEFAULT_PRIOR_SERVICE_ID);
        setShowPalletInputMode(true); // Default to pallet mode for new items
        setTimeout(() => syncPalletBagRHFValues(true), 0);
      }
    }
  }, [isOpen, detail, reset, newFormDefaults, isLoadingCustomers, isLoadingServices, isLoadingDoes, syncPalletBagRHFValues]);


  // Effect to sync RHF values when mode changes via button OR input changes
  useEffect(() => {
    syncPalletBagRHFValues(showPalletInputMode);
  }, [showPalletInputMode, syncPalletBagRHFValues]);


  // Effect to calculate Tare Weight
  useEffect(() => {
    let newTareWeight;
    if (showPalletInputMode) {
        newTareWeight = TARE_WEIGHT_DEFAULT;
    } else {
        if (numBagsWatched > 0) {
            newTareWeight = parseFloat((numBagsWatched * BAG_WEIGHT_MULTIPLIER).toFixed(3));
        } else {
            // If editing an existing 0-pallet, 0-bag item with a manually saved tare, preserve it.
            // Otherwise, default to TARE_WEIGHT_DEFAULT (25.7) when bags are 0, making it editable from this default.
            if (detail && detail.numPallets === 0 && detail.numBags === 0 && typeof detail.tareWeight === 'number' && detail.tareWeight !== (numBagsWatched * BAG_WEIGHT_MULTIPLIER) && detail.tareWeight !== TARE_WEIGHT_DEFAULT ) {
                 newTareWeight = detail.tareWeight;
            } else {
                 newTareWeight = TARE_WEIGHT_DEFAULT;
            }
        }
    }
    if (newTareWeight !== getValues('tareWeight')) {
        setValue('tareWeight', newTareWeight, { shouldValidate: true });
    }
  }, [showPalletInputMode, numBagsWatched, setValue, getValues, detail]);

  // Effect to handle service change and format dropdown
  useEffect(() => {
    const currentServiceInForm = getValues('serviceId');
    if (watchedServiceId !== currentServiceId) {
      setCurrentServiceId(watchedServiceId);
      setValue('formatId', '', { shouldValidate: false });
      const serviceKey = watchedServiceId ? watchedServiceId.toLowerCase() : '';
      const newFormatCollectionId = serviceKey ? SERVICE_FORMAT_MAPPING[serviceKey] || null : null;
      if (!newFormatCollectionId) {
        formHook.clearErrors('formatId');
      }
    }
  }, [watchedServiceId, currentServiceId, setValue, formHook, getValues]);

  // Effect to trigger formatId validation when it changes or form is submitted/touched
  useEffect(() => {
    const formatFieldState = formHook.getFieldState('formatId');
    const serviceKey = currentServiceId ? currentServiceId.toLowerCase() : '';
    const serviceRequiresFormat = serviceKey ? !!SERVICE_FORMAT_MAPPING[serviceKey] : false;

    if (serviceRequiresFormat && (formState.isSubmitted || formatFieldState.isTouched)) {
      trigger('formatId');
    }
  }, [watchedFormatId, formState.isSubmitted, trigger, currentServiceId, formHook]);


  const handleToggleInputMode = () => {
    setShowPalletInputMode(prev => !prev);
  };

  const onSubmit = async (data: DetailFormValues) => {
    setIsSaving(true);
    try {
       let finalData = { ...data };
       if (showPalletInputMode) {
           finalData.numBags = 0;
           if (finalData.numPallets <= 0 && !detail) finalData.numPallets = 1;
       } else {
           finalData.numPallets = 0;
       }

       const serviceKeyForSave = finalData.serviceId ? finalData.serviceId.toLowerCase() : '';
       const formatRequiredForSave = serviceKeyForSave ? !!SERVICE_FORMAT_MAPPING[serviceKeyForSave] : false;
       
       const saveData: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated' | 'netWeight'> = {
         numPallets: finalData.numPallets,
         numBags: finalData.numBags,
         customerId: finalData.customerId,
         serviceId: finalData.serviceId,
         formatId: formatRequiredForSave ? (finalData.formatId || '') : '',
         tareWeight: finalData.tareWeight,
         grossWeight: finalData.grossWeight,
         dispatchNumber: finalData.dispatchNumber || undefined,
         doeId: finalData.doeId || undefined,
       };
      await onSave(saveData);
      onClose();
    } catch (error) {
      console.error("Error saving shipment detail:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Could not save item.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const radioButtonStyle = (checked: boolean) =>
    cn(
      "flex items-center justify-center rounded-md border px-3 py-2 text-xs sm:text-sm font-medium cursor-pointer transition-colors shadow-sm whitespace-nowrap",
      "hover:bg-accent hover:text-accent-foreground",
      checked
        ? "bg-primary text-primary-foreground hover:bg-primary/90 ring-2 ring-primary ring-offset-2"
        : "bg-muted text-muted-foreground hover:bg-muted/80"
    );

  return (
     <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-4 border-b sticky top-0 bg-card z-10">
          <DialogTitle>{detail ? 'Edit Shipment Item' : 'Add Shipment Item'}</DialogTitle>
          <DialogDescription>
            Fill in the details for this item. Required fields are marked with an asterisk (*).
          </DialogDescription>
        </DialogHeader>

         {dropdownsLoading && isOpen ? (
             <div className="space-y-4 p-6">
                 {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
             </div>
         ) : (
             <Form {...formHook}>
                 <form onSubmit={formHook.handleSubmit(onSubmit)} className="overflow-y-auto">
                    <div className="space-y-6 p-6 max-h-[calc(90vh-180px)] overflow-y-auto">

                     <div className="flex justify-end mb-4">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleToggleInputMode}
                            disabled={isSaving}
                            className="shadow-sm"
                        >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            {showPalletInputMode ? "Enter Bags Instead" : "Enter Pallets Instead"}
                        </Button>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                        {showPalletInputMode && (
                            <FormField
                               control={control}
                               name="numPallets"
                               render={({ field }) => (
                               <FormItem>
                                  <FormLabel>Pallet Number</FormLabel>
                                  <FormControl>
                                     <Input type="number" min="0" {...field} disabled={isSaving}
                                     onChange={e => {
                                        const pallets = parseInt(e.target.value, 10);
                                        const newPalletValue = isNaN(pallets) || pallets < 0 ? 0 : pallets;
                                        field.onChange(newPalletValue);
                                        if (newPalletValue <= 0 && showPalletInputMode) {
                                            setShowPalletInputMode(false);
                                        }
                                     }}
                                     />
                                  </FormControl>
                                  <FormMessage />
                               </FormItem>
                               )}
                            />
                        )}
                        {!showPalletInputMode && (
                           <FormField
                              control={control}
                              name="numBags"
                              render={({ field }) => (
                                 <FormItem>
                                    <FormLabel>Number of Bags</FormLabel>
                                    <FormControl>
                                       <Input type="number" min="0" {...field}
                                        onChange={e => {
                                            const bags = parseInt(e.target.value, 10);
                                            const newBagValue = isNaN(bags) || bags < 0 ? 0 : bags;
                                            field.onChange(newBagValue);
                                            if (newBagValue <= 0 && !showPalletInputMode) {
                                                 setShowPalletInputMode(true);
                                            }
                                        }}
                                       disabled={isSaving} />
                                    </FormControl>
                                    <FormMessage />
                                 </FormItem>
                              )}
                           />
                         )}

                         <FormField
                            control={control}
                            name="customerId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Customer *</FormLabel>
                                <Controller
                                  name="customerId"
                                  control={control}
                                  render={({ field: controllerField }) => (
                                    <ShadcnLabel
                                        className={cn(
                                            "block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                                            isLoadingCustomers || isSaving ? "cursor-not-allowed opacity-50" : ""
                                        )}
                                        aria-disabled={isLoadingCustomers || isSaving}
                                    >
                                        <select
                                            {...controllerField}
                                            value={controllerField.value || ""}
                                            disabled={isSaving || isLoadingCustomers}
                                            className="w-full bg-transparent outline-none appearance-none"
                                            onChange={(e) => {
                                                controllerField.onChange(e.target.value);
                                            }}
                                        >
                                            <option value="" disabled hidden>{isLoadingCustomers ? "Loading..." : "Select a customer"}</option>
                                            {validCustomerOptions.map((option) => (
                                            <option key={option.id} value={option.value}>
                                                {option.label}
                                            </option>
                                            ))}
                                        </select>
                                    </ShadcnLabel>
                                  )}
                                />
                                {errorCustomers && <p className="text-xs text-destructive">Error loading customers.</p>}
                                <FormMessage />
                                </FormItem>
                            )}
                         />
                        </div>

                        <FormField
                            control={control}
                            name="serviceId"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                <FormLabel>Service *</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                    onValueChange={(value) => {
                                        field.onChange(value);
                                    }}
                                    value={field.value || ""}
                                    className="flex flex-wrap gap-2"
                                    disabled={isSaving || isLoadingServices}
                                    >
                                    {validServiceOptions.map((option) => (
                                        <FormItem key={option.id} className="flex items-center space-x-0 space-y-0">
                                            <FormControl>
                                                <RadioGroupItem value={option.value} id={`serv-${option.id}-${option.value}`} className="peer sr-only" />
                                            </FormControl>
                                            <ShadcnLabel htmlFor={`serv-${option.id}-${option.value}`} className={radioButtonStyle(field.value === option.value)}>
                                                {option.label}
                                            </ShadcnLabel>
                                        </FormItem>
                                    ))}
                                    </RadioGroup>
                                </FormControl>
                                {errorServices && <p className="text-xs text-destructive">Error loading services.</p>}
                                <FormMessage />
                                </FormItem>
                            )}
                        />

                        {!!formatCollectionId && (
                            <FormField
                                control={control}
                                name="formatId"
                                render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Format {serviceLabelForFormat} *</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            key={currentServiceId} 
                                            onValueChange={(value) => {
                                                field.onChange(value);
                                            }}
                                            value={field.value || ""}
                                            className="flex flex-wrap gap-2"
                                            disabled={isSaving || isLoadingFormats}
                                        >
                                        {isLoadingFormats && <Skeleton className="h-10 w-24" />}
                                        {!isLoadingFormats && validFormatOptions.length === 0 && <p className="text-sm text-muted-foreground">No formats available for this service.</p>}
                                        {validFormatOptions.map((option) => (
                                            <FormItem key={option.id} className="flex items-center space-x-0 space-y-0">
                                                <FormControl>
                                                    <RadioGroupItem value={option.value} id={`fmt-${currentServiceId}-${option.id}-${option.value}`} className="peer sr-only" />
                                                </FormControl>
                                                <ShadcnLabel htmlFor={`fmt-${currentServiceId}-${option.id}-${option.value}`} className={radioButtonStyle(field.value === option.value)}>
                                                    {option.label}
                                                </ShadcnLabel>
                                            </FormItem>
                                        ))}
                                        </RadioGroup>
                                    </FormControl>
                                    {errorFormats && <p className="text-xs text-destructive">Error loading formats.</p>}
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                          )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                            <FormField
                               control={control}
                               name="tareWeight"
                               render={({ field }) => (
                                  <FormItem>
                                     <FormLabel>Tare Weight *</FormLabel>
                                     <FormControl>
                                        <Input type="number" step="0.001" min="0" {...field}
                                               disabled={isSaving}
                                        />
                                     </FormControl>
                                     {showPalletInputMode && <p className="text-xs text-muted-foreground pt-1">Default for pallets: {TARE_WEIGHT_DEFAULT} kg. Editable.</p>}
                                     {!showPalletInputMode && numBagsWatched > 0 && <p className="text-xs text-muted-foreground pt-1">Auto-calculated ({numBagsWatched} bags × {BAG_WEIGHT_MULTIPLIER} kg/bag). Editable.</p>}
                                     {!showPalletInputMode && numBagsWatched === 0 && <p className="text-xs text-muted-foreground pt-1">Default: {TARE_WEIGHT_DEFAULT} kg. Editable.</p>}
                                     <FormMessage />
                                  </FormItem>
                               )}
                            />

                            <FormField
                               control={control}
                               name="grossWeight"
                               render={({ field }) => (
                               <FormItem>
                                  <FormLabel>Gross Weight *</FormLabel>
                                  <FormControl>
                                     <Input
                                        type="number"
                                        step="0.001"
                                        placeholder="Enter gross weight"
                                        {...field}
                                        value={
                                          (field.value === 0 && !formHook.getFieldState(field.name).isTouched && !detail)
                                            ? ""
                                            : field.value
                                        }
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          field.onChange(val === "" ? 0 : parseFloat(val) || 0);
                                        }}
                                        disabled={isSaving}
                                     />
                                  </FormControl>
                                  <FormMessage />
                               </FormItem>
                               )}
                            />
                             <FormField
                               control={control}
                               name="dispatchNumber"
                               render={({ field }) => (
                               <FormItem>
                                  <FormLabel>Dispatch Number *</FormLabel>
                                  <FormControl>
                                     <Input
                                        type="text"
                                        pattern="[0-9]*"
                                        inputMode="numeric"
                                        placeholder="Enter dispatch number (digits only)"
                                        {...field}
                                        value={field.value || ''}
                                        disabled={isSaving}
                                    />
                                  </FormControl>
                                  <FormMessage />
                               </FormItem>
                               )}
                            />
                            <FormField
                                control={control}
                                name="doeId"
                                render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>DOE</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                        onValueChange={field.onChange}
                                        value={field.value || ""}
                                        className="flex flex-wrap gap-2"
                                        disabled={isSaving || isLoadingDoes}
                                        >
                                        {isLoadingDoes && <Skeleton className="h-10 w-24" />}
                                        {!isLoadingDoes && validDoeOptions.length === 0 && <p className="text-sm text-muted-foreground">No DOE options available.</p>}
                                        {validDoeOptions.map((option) => (
                                            <FormItem key={option.id} className="flex items-center space-x-0 space-y-0">
                                                <FormControl>
                                                    <RadioGroupItem value={option.value} id={`doe-${option.id}-${option.value}`} className="peer sr-only" />
                                                </FormControl>
                                                <ShadcnLabel htmlFor={`doe-${option.id}-${option.value}`} className={radioButtonStyle(field.value === option.value)}>
                                                    {option.label}
                                                </ShadcnLabel>
                                            </FormItem>
                                        ))}
                                        </RadioGroup>
                                    </FormControl>
                                    {errorDoes && <p className="text-xs text-destructive">Error loading DOE options.</p>}
                                    <FormMessage />
                                </FormItem>
                               )}
                            />
                        </div>
                    </div>

                      <DialogFooter className="p-6 border-t mt-0 sticky bottom-0 bg-card z-10">
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
