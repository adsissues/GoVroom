"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats, Html5QrcodeScanType, Html5Qrcode, Html5QrcodeCameraScanConfig } from "html5-qrcode";
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
import { Loader2, Scan, XCircle, CameraOff, Video } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BarcodeScannerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

interface CameraDevice {
  id: string;
  label: string;
}

export const BarcodeScannerDialog: React.FC<BarcodeScannerDialogProps> = ({ isOpen, onClose, onScan }) => {
  const { toast } = useToast();
  const qrcodeRegionRef = useRef<HTMLDivElement>(null); // Ref for the scanner div
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [html5QrCode, setHtml5QrCode] = useState<Html5Qrcode | null>(null);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined);

  const onScanSuccess = useCallback((decodedText: string) => {
    console.log("Scan successful:", decodedText);
    if (html5QrCode) {
      html5QrCode.stop().catch(error => {
        console.error("Failed to stop html5QrCode", error);
      }).finally(() => {
        setIsScanning(false);
        onScan(decodedText);
        onClose();
      });
    }
  }, [onScan, onClose, html5QrCode]);

  const onScanError = useCallback((errorMessage: string) => {
    // This can be noisy, only log for debugging or specific critical errors
    // console.warn(`Barcode scanning error: ${errorMessage}`);
  }, []);

  const stopScanner = useCallback(async () => {
    console.log("Attempting to stop scanner...");
    if (html5QrCode && isScanning) {
      try {
        await html5QrCode.stop();
        console.log("Scanner stopped successfully.");
      } catch (error) {
        console.error("Failed to stop html5QrCode", error);
      } finally {
        setIsScanning(false);
      }
    }
    setHtml5QrCode(null);
  }, [isScanning, html5QrCode]);

  const initializeAndStartScanner = useCallback(async (cameraId: string | undefined) => {
    console.log("initializeAndStartScanner called with cameraId:", cameraId);
    if (!qrcodeRegionRef.current) {
      console.warn("Scanner div not mounted yet when initializeAndStartScanner called.");
      return;
    }

    setCameraError(null);
    setHasCameraPermission(null);
    setIsScanning(true);

    // Clear any existing scanner instance before creating a new one
    if (html5QrCode) {
      console.log("Stopping existing html5QrCode before new start.");
      await html5QrCode.stop().catch(e => console.warn("Error stopping existing html5QrCode:", e));
      setHtml5QrCode(null);
    }

    const qrCode = new Html5Qrcode(qrcodeRegionRef.current.id);
    setHtml5QrCode(qrCode);

    try {
      console.log("Attempting to start Html5Qrcode...");
      const config: Html5QrcodeCameraScanConfig = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      };

      let cameraIdentifier: string | { facingMode: "environment" | "user" } | undefined = undefined;

      if (cameraId) {
        cameraIdentifier = cameraId;
      } else if (availableCameras.length > 0) {
        // Default to rear camera if available, otherwise first available
        const rearCamera = availableCameras.find(cam => cam.label.toLowerCase().includes("back") || cam.label.toLowerCase().includes("environment"));
        cameraIdentifier = rearCamera ? rearCamera.id : availableCameras[0].id;
      } else {
        // Fallback to environment facing mode if no specific camera selected or availableCameras is empty
        cameraIdentifier = { facingMode: "environment" };
      }

      console.log("Camera identifier for start:", cameraIdentifier);

      await qrCode.start(
        cameraIdentifier,
        config,
        onScanSuccess,
        onScanError
      );
      console.log("Html5Qrcode started successfully.");
      setHasCameraPermission(true);
    } catch (err: any) {
      setIsScanning(false);
      setHasCameraPermission(false);
      console.error("Html5Qrcode start error:", err);
      let errorMessage = "Failed to start camera.";
      if (err.name === "NotAllowedError") {
        errorMessage = "Camera access denied. Please grant permission in your browser settings.";
      } else if (err.name === "NotFoundError") {
        errorMessage = "No camera found matching the requested constraints (e.g., rear camera).";
      } else if (err.name === "NotReadableError") {
        errorMessage = "Camera is already in use or not accessible.";
      } else if (err.name === "OverconstrainedError") {
        errorMessage = "Camera constraints not supported by device.";
      } else if (err.name === "SecurityError") {
        errorMessage = "Camera access blocked by security policy (e.g., not on HTTPS).";
      } else if (err.name === "NotSupportedError") {
        errorMessage = "Camera API not supported by this browser.";
      }
      setCameraError(errorMessage);
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: errorMessage,
      });
      onClose(); // Automatically close dialog if camera cannot be started
    }
  }, [onScanSuccess, onScanError, toast, onClose, html5QrCode, availableCameras]);

  // Effect to enumerate cameras when dialog opens
  useEffect(() => {
    if (isOpen) {
      const enumerateCameras = async () => {
        try {
          const cameras = await Html5Qrcode.getCameras();
          console.log("Enumerated cameras:", cameras);
          setAvailableCameras(cameras);
          if (cameras.length > 0) {
            // Try to find a rear camera by label, otherwise select the first one
            const rearCamera = cameras.find(cam => cam.label.toLowerCase().includes("back") || cam.label.toLowerCase().includes("environment"));
            setSelectedCameraId(rearCamera ? rearCamera.id : cameras[0].id);
          } else {
            setCameraError("No cameras found on this device.");
            toast({
              variant: "destructive",
              title: "Camera Error",
              description: "No cameras found on this device.",
            });
          }
        } catch (err: any) {
          console.error("Error enumerating cameras:", err);
          setCameraError("Could not enumerate cameras. Permission might be denied or device not supported.");
          toast({
            variant: "destructive",
            title: "Camera Error",
            description: "Could not enumerate cameras. Permission might be denied or device not supported.",
          });
        }
      };
      enumerateCameras();
    }
  }, [isOpen, toast]);

  // Effect to start/stop scanner based on isOpen and selectedCameraId
  useEffect(() => {
    console.log("BarcodeScannerDialog main useEffect triggered. isOpen:", isOpen, "selectedCameraId:", selectedCameraId);
    if (isOpen && selectedCameraId) {
      initializeAndStartScanner(selectedCameraId);
    } else if (!isOpen) {
      stopScanner();
    }
    // Cleanup on unmount or when isOpen becomes false
    return () => {
      console.log("BarcodeScannerDialog cleanup.");
      stopScanner();
    };
  }, [isOpen, selectedCameraId, initializeAndStartScanner, stopScanner]);

  const handleRetry = () => {
    if (selectedCameraId) {
      initializeAndStartScanner(selectedCameraId);
    } else if (availableCameras.length > 0) {
      // If no specific camera was selected, try the default logic again
      const rearCamera = availableCameras.find(cam => cam.label.toLowerCase().includes("back") || cam.label.toLowerCase().includes("environment"));
      initializeAndStartScanner(rearCamera ? rearCamera.id : availableCameras[0].id);
    } else {
      // Re-enumerate cameras if none were found initially
      const enumerateCamerasAndStart = async () => {
        try {
          const cameras = await Html5Qrcode.getCameras();
          setAvailableCameras(cameras);
          if (cameras.length > 0) {
            const rearCamera = cameras.find(cam => cam.label.toLowerCase().includes("back") || cam.label.toLowerCase().includes("environment"));
            const idToUse = rearCamera ? rearCamera.id : cameras[0].id;
            setSelectedCameraId(idToUse);
            initializeAndStartScanner(idToUse);
          } else {
            setCameraError("No cameras found on this device after retry.");
          }
        } catch (err) {
          setCameraError("Could not enumerate cameras after retry. Permission might be denied.");
        }
      };
      enumerateCamerasAndStart();
    }
  };

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
              <Button onClick={handleRetry} className="mt-4"><Video className="mr-2 h-4 w-4" /> Retry Camera</Button>
            </div>
          )}
          {!cameraError && hasCameraPermission === false && (
            <div className="text-center text-red-500 p-4">
              <XCircle className="h-12 w-12 mx-auto mb-3" />
              <p className="font-semibold text-lg">Camera access denied.</p>
              <p className="text-sm mt-2">Please enable camera permissions in your browser settings to use the scanner.</p>
              <Button onClick={handleRetry} className="mt-4"><Video className="mr-2 h-4 w-4" /> Retry Camera</Button>
            </div>
          )}
          {!cameraError && isScanning && (
            <div id="qrcode-reader" ref={qrcodeRegionRef} className="w-full h-[300px] bg-gray-100 flex items-center justify-center text-gray-500 rounded-md overflow-hidden">
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

          {availableCameras.length > 1 && !isScanning && !cameraError && (
            <div className="mt-4 w-full max-w-[250px]">
              <Select onValueChange={setSelectedCameraId} value={selectedCameraId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Camera" />
                </SelectTrigger>
                <SelectContent>
                  {availableCameras.map(camera => (
                    <SelectItem key={camera.id} value={camera.id}>{camera.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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