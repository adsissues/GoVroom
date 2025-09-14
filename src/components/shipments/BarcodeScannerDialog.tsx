"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats, Html5QrcodeScanType } from "html5-qrcode";
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
import { Loader2, Scan, XCircle, CameraOff } from 'lucide-react';

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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const onScanSuccess = useCallback((decodedText: string) => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(error => {
        console.error("Failed to stop html5QrcodeScanner", error);
      }).finally(() => {
        setIsScanning(false);
        onScan(decodedText);
        onClose();
      });
    }
  }, [onScan, onClose]);

  const onScanError = useCallback((errorMessage: string) => {
    // This can be noisy, only log for debugging or specific critical errors
    // console.warn(`Barcode scanning error: ${errorMessage}`);
  }, []);

  const startScanner = useCallback(async () => {
    setCameraError(null);
    setHasCameraPermission(null);
    setIsScanning(true);

    if (scannerRef.current) {
      await scannerRef.current.stop().catch(e => console.warn("Error stopping existing scanner:", e));
      scannerRef.current = null;
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
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
      },
      false // verbose
    );

    try {
      await scannerRef.current.start(
        { facingMode: "environment" }, // Prefer rear camera
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        onScanError
      );
      setHasCameraPermission(true);
    } catch (err: any) {
      setIsScanning(false);
      setHasCameraPermission(false);
      console.error("Camera start error:", err);
      let errorMessage = "Failed to start camera.";
      if (err.name === "NotAllowedError") {
        errorMessage = "Camera access denied. Please grant permission in your browser settings.";
      } else if (err.name === "NotFoundError") {
        errorMessage = "No camera found on this device.";
      } else if (err.name === "NotReadableError") {
        errorMessage = "Camera is already in use or not accessible.";
      } else if (err.name === "OverconstrainedError") {
        errorMessage = "Camera constraints not supported by device.";
      }
      setCameraError(errorMessage);
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: errorMessage,
      });
      // Automatically close dialog if camera cannot be started
      onClose();
    }
  }, [onScanSuccess, onScanError, toast, onClose]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && isScanning) {
      await scannerRef.current.stop().catch(error => {
        console.error("Failed to stop html5QrcodeScanner", error);
      }).finally(() => {
        setIsScanning(false);
      });
    }
    if (scannerRef.current) {
      scannerRef.current.clear(); // Ensure all resources are released
      scannerRef.current = null;
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
        <div className="p-4 flex flex-col items-center justify-center min-h-[300px]">
          {cameraError && (
            <div className="text-center text-red-500 p-4">
              <CameraOff className="h-12 w-12 mx-auto mb-3" />
              <p className="font-semibold text-lg">{cameraError}</p>
              {cameraError.includes("permission") && (
                <p className="text-sm mt-2">Please check your browser/device settings to enable camera access for this site.</p>
              )}
            </div>
          )}
          {!cameraError && hasCameraPermission === false && (
            <div className="text-center text-red-500 p-4">
              <XCircle className="h-12 w-12 mx-auto mb-3" />
              <p className="font-semibold text-lg">Camera access denied.</p>
              <p className="text-sm mt-2">Please enable camera permissions in your browser settings to use the scanner.</p>
            </div>
          )}
          {!cameraError && isScanning && (
            <div id={qrcodeRegionId} className="w-full h-[300px] bg-gray-100 flex items-center justify-center text-gray-500 rounded-md overflow-hidden">
              {!hasCameraPermission && hasCameraPermission !== false ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p>Requesting camera permission...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Scan className="h-8 w-8 animate-pulse mb-2" />
                  <p>Scanning for barcode...</p>
                </div>
              )}
            </div>
          )}
          {!cameraError && !isScanning && hasCameraPermission === true && (
             <div className="text-center text-gray-500 p-4">
              <Scan className="h-12 w-12 mx-auto mb-3" />
              <p className="font-semibold text-lg">Scanner ready.</p>
              <p className="text-sm mt-2">Waiting for barcode to be positioned.</p>
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
