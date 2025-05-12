
"use client";

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { AlertCircle } from 'lucide-react';


// Validation Schema
const detailFormSchema = z.object({
  numPallets: z.coerce.number().min(0, "Number of pallets cannot be negative").default(1),
  numBags: z.coerce.number().min(0, "Number of bags cannot be negative").default(0),
  customerId: z.string().min(1, "Customer is required"),
  serviceId: z.string().min(1, "Service is required"),
  formatId: z.string().min(1, "Format is required"), // Initially required, may become optional based on service
  tareWeight: z.coerce.number().min(0, "Tare weight cannot be negative"),
  grossWeight: z.coerce.number().min(0, "Gross weight cannot be negative"),
  dispatchNumber: z.string().optional(),
  doeId: z.string().optional(),
});

type DetailFormValues = z.infer<typeof detailFormSchema>;

interface ShipmentDetailFormProps {
  shipmentId: string;
  detail?: ShipmentDetail | null; // Pass existing detail for editing
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated' | 'netWeight'>) => Promise<void>; // Callback after saving
}

export default function ShipmentDetailForm({
  shipmentId,
  detail,
  isOpen,
  onClose,
  onSave,
}: ShipmentDetailFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownsLoading, setDropdownsLoading] = useState(true);
  const [customerOptions, setCustomerOptions] = useState<DropdownItem[]>([]);
  const [serviceOptions, setServiceOptions] = useState<DropdownItem[]>([]);
  const [formatOptions, setFormatOptions] = useState<DropdownItem[]>([]);
  const [doeOptions, setDoeOptions] = useState<DropdownItem[]>([]);
  const [selectedService, setSelectedService] = useState<string>(detail?.serviceId || '');
  const [showFormat, setShowFormat] = useState(!!detail?.serviceId); // Show format if service is pre-selected

  const formHook = useForm<DetailFormValues>({
    resolver: zodResolver(detailFormSchema),
    defaultValues: {
      numPallets: detail?.numPallets ?? 1,
      numBags: detail?.numBags ?? 0,
      customerId: detail?.customerId ?? '',
      serviceId: detail?.serviceId ?? '',
      formatId: detail?.formatId ?? '',
      tareWeight: detail?.tareWeight ?? TARE_WEIGHT_DEFAULT,
      grossWeight: detail?.grossWeight ?? 0,
      dispatchNumber: detail?.dispatchNumber ?? '',
      doeId: detail?.doeId ?? '',
    },
  });

  const { watch, setValue, reset } = formHook;
  const numBags = watch('numBags');
  const numPallets = watch('numPallets');
  const currentServiceId = watch('serviceId');

  // Fetch dropdown options
  useEffect(() => {
    const fetchOptions = async () => {
      setDropdownsLoading(true);
      try {
        const [customers, services, does] = await Promise.all([
          getDropdownOptions('customers'),
          getDropdownOptions('services'),
          getDropdownOptions('doe'),
        ]);
        setCustomerOptions(customers);
        setServiceOptions(services);
        setDoeOptions(does);

        // Pre-select service if editing
        if (detail?.serviceId) {
           setSelectedService(detail.serviceId);
           setShowFormat(true); // Assume format is needed if service exists
        }

      } catch (error) {
        console.error("Error fetching dropdown options:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load dropdown options." });
      } finally {
        setDropdownsLoading(false);
      }
    };
    if (isOpen) { // Only fetch when the dialog opens
        fetchOptions();
    }
  }, [isOpen, detail, toast]);


   // Fetch format options based on selected service
   useEffect(() => {
    const fetchFormatOptions = async () => {
      if (!currentServiceId) {
        setFormatOptions([]);
        setShowFormat(false);
        setValue('formatId', ''); // Reset format if service is cleared
        return;
      }

      const formatCollectionId = SERVICE_FORMAT_MAPPING[currentServiceId];
      if (!formatCollectionId) {
        console.warn(`No format mapping found for service: ${currentServiceId}`);
        setFormatOptions([]);
        setShowFormat(false); // Hide format if no mapping exists
        setValue('formatId', ''); // Reset format
        return;
      }

      setShowFormat(true); // Show format dropdown
      try {
        const formats = await getDropdownOptions(formatCollectionId);
        setFormatOptions(formats);
        // If editing and the original formatId doesn't exist in new options, reset it.
         if (detail && detail.serviceId === currentServiceId && !formats.some(f => f.value === detail.formatId)) {
            setValue('formatId', '');
         } else if (detail && detail.serviceId !== currentServiceId) {
             setValue('formatId', ''); // Reset if service changed
         }

      } catch (error) {
        console.error(`Error fetching formats from ${formatCollectionId}:`, error);
        toast({ variant: "destructive", title: "Error", description: "Could not load format options." });
        setFormatOptions([]);
      }
    };

     fetchFormatOptions();
  }, [currentServiceId, detail, setValue, toast]);


  // Auto-calculate Tare Weight
  useEffect(() => {
    if (numBags > 0) {
      const calculatedTare = parseFloat((numBags * BAG_WEIGHT_MULTIPLIER).toFixed(3)); // Keep precision
      setValue('tareWeight', calculatedTare, { shouldValidate: true });
    } else {
      // Reset to default only if user hasn't manually changed it from the initial default
       const currentTare = formHook.getValues('tareWeight');
       if (currentTare === parseFloat((0 * BAG_WEIGHT_MULTIPLIER).toFixed(3))) { // Check if it was auto-calculated based on 0 bags before
           setValue('tareWeight', TARE_WEIGHT_DEFAULT, { shouldValidate: true });
       } else if (detail && currentTare === parseFloat((detail.numBags * BAG_WEIGHT_MULTIPLIER).toFixed(3))) {
           // if editing and tare weight matches calculation for original bags, reset to default
           setValue('tareWeight', TARE_WEIGHT_DEFAULT, { shouldValidate: true });
       }
       // Otherwise, keep the manually entered value even if bags are 0
    }
  }, [numBags, setValue, detail, formHook]);


   // Reset form when dialog closes or detail changes
   useEffect(() => {
     if (isOpen) {
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
       setSelectedService(detail?.serviceId || '');
       setShowFormat(!!detail?.serviceId);
     } else {
        reset(); // Reset to defaults when closed
        setSelectedService('');
        setShowFormat(false);
        setFormatOptions([]); // Clear format options
     }
   }, [isOpen, detail, reset]);


  const onSubmit = async (data: DetailFormValues) => {
    setIsLoading(true);
    try {
       const saveData: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated' | 'netWeight'> = {
         ...data,
         numPallets: Number(data.numPallets),
         numBags: Number(data.numBags),
         tareWeight: Number(data.tareWeight),
         grossWeight: Number(data.grossWeight),
         // Ensure optional fields that might be empty strings are saved as undefined or null
         dispatchNumber: data.dispatchNumber || undefined,
         doeId: data.doeId || undefined,
       };
      await onSave(saveData);
      toast({ title: detail ? "Detail Updated" : "Detail Added", description: "Shipment detail saved successfully." });
      onClose(); // Close dialog on success
    } catch (error) {
      console.error("Error saving shipment detail:", error);
      toast({ variant: "destructive", title: "Save Failed", description: error instanceof Error ? error.message : "Could not save detail." });
    } finally {
      setIsLoading(false);
    }
  };


  return (
     <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{detail ? 'Edit Shipment Detail' : 'Add Shipment Detail'}</DialogTitle>
        </DialogHeader>
         {dropdownsLoading ? (
             <div className="space-y-4 p-6">
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
             </div>
         ) : (
             <Form {...formHook}>
                 <form onSubmit={formHook.handleSubmit(onSubmit)} className="space-y-6 p-6">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                           control={formHook.control}
                           name="numPallets"
                           render={({ field }) => (
                           <FormItem>
                              <FormLabel>Number of Pallets</FormLabel>
                              <FormControl>
                                 <Input type="number" min="0" {...field} />
                              </FormControl>
                              <FormMessage />
                           </FormItem>
                           )}
                        />
                         {/* Conditionally render Number of Bags */}
                         {numPallets > 0 && (
                           <FormField
                              control={formHook.control}
                              name="numBags"
                              render={({ field }) => (
                                 <FormItem>
                                 <FormLabel>Number of Bags</FormLabel>
                                 <FormControl>
                                    <Input type="number" min="0" {...field} />
                                 </FormControl>
                                 <FormMessage />
                                 </FormItem>
                              )}
                           />
                         )}
                         <FormField
                            control={formHook.control}
                            name="customerId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Customer</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                         <FormField
                            control={formHook.control}
                            name="serviceId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Service</FormLabel>
                                <Select
                                    onValueChange={(value) => {
                                        field.onChange(value);
                                        setSelectedService(value); // Update local state for format fetching
                                    }}
                                    defaultValue={field.value}
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
                         {/* Conditionally render Format */}
                         {showFormat && (
                            <FormField
                                control={formHook.control}
                                name="formatId"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Format</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || ""}>
                                    <FormControl>
                                        <SelectTrigger>
                                        <SelectValue placeholder="Select a format" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {formatOptions.length === 0 && <SelectItem value="loading" disabled>Loading formats...</SelectItem>}
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

                        <FormField
                           control={formHook.control}
                           name="tareWeight"
                           render={({ field }) => (
                              <FormItem>
                                 <FormLabel>Tare Weight (kg)</FormLabel>
                                 <FormControl>
                                    {/* Make read-only if auto-calculated? Maybe add tooltip */}
                                    <Input type="number" step="0.001" {...field} disabled={numBags > 0} title={numBags > 0 ? "Auto-calculated based on number of bags" : ""}/>
                                 </FormControl>
                                 {numBags > 0 && <p className="text-xs text-muted-foreground">Auto-calculated ({numBags} bags * {BAG_WEIGHT_MULTIPLIER} kg/bag)</p>}
                                 <FormMessage />
                              </FormItem>
                           )}
                        />

                        <FormField
                           control={formHook.control}
                           name="grossWeight"
                           render={({ field }) => (
                           <FormItem>
                              <FormLabel>Gross Weight (kg)</FormLabel>
                              <FormControl>
                                 <Input type="number" step="0.001" min="0" {...field} />
                              </FormControl>
                              <FormMessage />
                           </FormItem>
                           )}
                        />
                         <FormField
                           control={formHook.control}
                           name="dispatchNumber"
                           render={({ field }) => (
                           <FormItem>
                              <FormLabel>Dispatch Number</FormLabel>
                              <FormControl>
                                 <Input type="text" {...field} />
                              </FormControl>
                              <FormMessage />
                           </FormItem>
                           )}
                        />
                         <FormField
                           control={formHook.control}
                           name="doeId"
                           render={({ field }) => (
                              <FormItem>
                                 <FormLabel>DOE</FormLabel>
                                 <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                                    <FormControl>
                                       <SelectTrigger>
                                          <SelectValue placeholder="Select DOE" />
                                       </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
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
                      <DialogFooter>
                         <DialogClose asChild>
                            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                         </DialogClose>
                         <Button type="submit" disabled={isLoading}>
                            {isLoading ? (detail ? 'Updating...' : 'Adding...') : (detail ? 'Update Detail' : 'Add Detail')}
                         </Button>
                     </DialogFooter>
                 </form>
             </Form>
          )}
      </DialogContent>
    </Dialog>
  );
}
