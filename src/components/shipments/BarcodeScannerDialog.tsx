"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Scan, XCircle } from 'lucide-react';

interface BarcodeScannerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

const qrcodeRegionId = "qrcode-reader";

export const BarcodeScannerDialog: React.FC<BarcodeScannerDialogProps> = ({ isOpen, onClose, onScan }) => {
  const { toast } = useToast();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState<boolean | null>(null);

  const checkCameraAvailability = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setHasCamera(videoDevices.length > 0);
      } catch (error) {
        console.error("Error enumerating media devices:", error);
        setHasCamera(false);
      }
    } else {
      setHasCamera(false);
    }
  }, []);

  useEffect(() => {
    checkCameraAvailability();
  }, [checkCameraAvailability]);

  const startScanner = useCallback(async () => {
    if (!hasCamera) {
      toast({
        variant: "destructive",
        title: "No Camera Found",
        description: "It seems your device does not have a camera or it's not accessible.",
      });
      return;
    }

    setIsScanning(true);
    setCameraPermissionGranted(null); // Reset permission status

    // Request camera permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Stop tracks immediately after checking
      setCameraPermissionGranted(true);
    } catch (err) {
      console.error("Camera permission denied:", err);
      setCameraPermissionGranted(false);
      setIsScanning(false);
      toast({
        variant: "destructive",
        title: "Camera Permission Denied",
        description: "Please grant camera access in your browser settings to use the scanner.",
      });
      return;
    }

    if (scannerRef.current) {
      scannerRef.current.clear(); // Clear any previous scanner instance
    }

    scannerRef.current = new Html5QrcodeScanner(
      qrcodeRegionId,
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE, // Include QR code for broader compatibility
        ],
        rememberLastUsedCamera: true,
        supportedScanTypes: [
          Html5QrcodeScanType.SCAN_TYPE_CAMERA,
          Html5QrcodeScanType.SCAN_TYPE_FILE // Allow file upload as fallback
        ]
      },
      false // verbose
    );

    const onScanSuccess = (decodedText: string) => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner", error);
        });
      }
      setIsScanning(false);
      onScan(decodedText);
      onClose();
    };

    const onScanError = (errorMessage: string) => {
      // console.warn(`Barcode scanning error: ${errorMessage}`);
      // This can be noisy, only show toast for critical errors or if scanning fails to start
    };

    scannerRef.current.render(onScanSuccess, onScanError);
  }, [hasCamera, onScan, onClose, toast]);

  const stopScanner = useCallback(() => {
    if (scannerRef.current && isScanning) {
      scannerRef.current.clear().catch(error => {
        console.error("Failed to clear html5QrcodeScanner", error);
      }).finally(() => {
        setIsScanning(false);
      });
    }
  }, [isScanning]);

  useEffect(() => {
    if (isOpen) {
      startScanner();
    } else {
      stopScanner();
    }
    // Cleanup on unmount
    return () => {
      stopScanner();
    };
  }, [isOpen, startScanner, stopScanner]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        stopScanner();
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[425px] p-0">
        <DialogHeader className="p-6 pb-4 border-b sticky top-0 bg-card z-10">
          <DialogTitle>Scan Barcode</DialogTitle>
          <DialogDescription>
            Position the barcode within the scanning area.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 flex flex-col items-center justify-center">
          {!hasCamera && (
            <div className="text-center text-red-500">
              <XCircle className="h-10 w-10 mx-auto mb-2" />
              <p>No camera detected or accessible.</p>
              <p>Barcode scanning is not available on this device.</p>
            </div>
          )}
          {hasCamera && cameraPermissionGranted === false && (
            <div className="text-center text-red-500">
              <XCircle className="h-10 w-10 mx-auto mb-2" />
              <p>Camera access denied.</p>
              <p>Please enable camera permissions in your browser settings.</p>
            </div>
          )}
          {hasCamera && cameraPermissionGranted === true && isScanning && (
            <div id={qrcodeRegionId} className="w-full h-[300px] bg-gray-200 flex items-center justify-center text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading camera...
            </div>
          )}
          {hasCamera && cameraPermissionGranted === true && !isScanning && (
            <div className="text-center text-gray-500">
              <Scan className="h-10 w-10 mx-auto mb-2" />
              <p>Scanner ready. Waiting for barcode...</p>
            </div>
          )}
        </div>
        <DialogFooter className="p-6 border-t mt-0 sticky bottom-0 bg-card z-10">
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
