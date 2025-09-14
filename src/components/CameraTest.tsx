"use client";

import React, { useEffect } from 'react';

const CameraTest: React.FC = () => {
  useEffect(() => {
    const testCameraAccess = async () => {
      console.log("--- Starting Camera Access Test ---");
      let stream: MediaStream | null = null;

      try {
        // 1. List all available video input devices
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
          alert("navigator.mediaDevices not supported in this browser.");
          console.error("navigator.mediaDevices not supported in this browser.");
          return;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        console.log("Detected video input devices:", videoDevices);

        if (videoDevices.length === 0) {
          alert("No camera detected on this device.");
          console.warn("No camera detected.");
          return;
        }

        // 2. Try to open any available camera (facingMode: true)
        console.log("Attempting to open any available camera (facingMode: true)...");
        stream = await navigator.mediaDevices.getUserMedia({
          video: true // Try any available camera
        });

        alert("Camera access successful! Any available camera opened.");
        console.log("Camera access successful! Stream:", stream);

      } catch (err: any) {
        let errorMessage = "Failed to access camera.";
        if (err.name === "NotAllowedError") {
          errorMessage = "Camera access denied. Please grant permission in your browser settings.";
        } else if (err.name === "NotFoundError") {
          errorMessage = "No camera found matching the requested constraints.";
        } else if (err.name === "NotReadableError") {
          errorMessage = "Camera is already in use or not accessible.";
        } else if (err.name === "OverconstrainedError") {
          errorMessage = "Camera constraints not supported by device.";
        } else if (err.name === "SecurityError") {
          errorMessage = "Camera access blocked by security policy (e.g., not on HTTPS).";
        } else if (err.name === "AbortError") {
          errorMessage = "Camera access request was aborted.";
        } else if (err.name === "TypeError") {
          errorMessage = "Invalid constraints specified for camera access.";
        }
        alert(`Camera access failed: ${errorMessage}`);
        console.error(`Camera access failed: ${errorMessage}`, err);
      } finally {
        // 3. Stop the camera stream immediately after testing
        if (stream) {
          stream.getTracks().forEach(track => {
            track.stop();
            console.log("Camera track stopped.", track);
          });
          console.log("Camera stream stopped.");
        }
        console.log("--- Camera Access Test Finished ---");
      }
    };

    testCameraAccess();

    return () => {
      // Cleanup is handled in the finally block of testCameraAccess
    };
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Camera Access Test</h1>
      <p className="mb-2">This component will attempt to access your device's camera to verify functionality.</p>
      <p className="mb-2">Please check the browser's permission prompt and your console for detailed logs.</p>
      <p className="text-sm text-gray-500">Ensure you are on HTTPS for camera access to work.</p>
    </div>
  );
};

export default CameraTest;