
"use client"; // For client-side PDF generation and download

import jsPDF from 'jspdf';
import type { Shipment } from '@/lib/types';
import { format } from 'date-fns';

const formatPdfTimestamp = (timestamp: any): string => {
  if (!timestamp) return 'N/A';
  try {
    // Firestore Timestamps have a toDate() method
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "PPP"); // Example format: Jun 10, 2024
  } catch (error) {
    console.error("[PDFService] Error formatting timestamp for PDF:", error);
    return 'Invalid Date';
  }
};

// Helper function to trigger download
const triggerDownload = (doc: jsPDF, filename: string) => {
  console.log(`[PDFService] Attempting to trigger download for: ${filename}`);
  try {
    console.log(`[PDFService] Generating data URI for ${filename}...`);
    const pdfDataUri = doc.output('datauristring');
    
    if (!pdfDataUri) {
        console.error(`[PDFService] Critical Error: doc.output('datauristring') returned undefined or null for ${filename}.`);
        alert(`Failed to generate PDF data (output was null/undefined) for ${filename}. Check console for jsPDF errors.`);
        return;
    }

    console.log(`[PDFService] Generated Data URI for ${filename}. Length: ${pdfDataUri.length}.`);
    // Log a small preview to avoid flooding console, but enough to see if it's a real data URI
    console.log(`[PDFService] Data URI Preview (first 150 chars): ${pdfDataUri.substring(0,150)}`);

    // Check for obviously empty or malformed data URI
    if (pdfDataUri.length < 100 || !pdfDataUri.startsWith('data:application/pdf;base64,')) {
        console.error(`[PDFService] Generated Data URI for ${filename} appears to be empty or malformed. URI: ${pdfDataUri.substring(0,150)}`);
        alert(`Failed to generate valid PDF content for ${filename}. The data URI was too short or malformed. URI starts with: ${pdfDataUri.substring(0,30)}`);
        return;
    }

    console.log(`[PDFService] Creating anchor element for ${filename}...`);
    const link = document.createElement('a');
    link.href = pdfDataUri;
    link.download = filename;
    
    // Log a snippet of the href to ensure it's set
    console.log(`[PDFService] Anchor element href set (first 100 chars): ${link.href.substring(0,100)}...`);
    console.log(`[PDFService] Anchor element download attribute set: ${link.download}`);

    console.log(`[PDFService] Appending anchor to body for ${filename}...`);
    document.body.appendChild(link);
    
    console.log(`[PDFService] Simulating click for ${filename}...`);
    link.click();
    
    console.log(`[PDFService] Removing anchor from body for ${filename}...`);
    document.body.removeChild(link);
    
    console.log(`[PDFService] Download process initiated for ${filename}. If no download occurs, check browser console for security warnings or pop-up blocker messages.`);

  } catch (error) {
    console.error(`[PDFService] Error in triggerDownload for ${filename}:`, error);
    alert(`An error occurred while trying to download ${filename}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const generatePreAlertPdf = (shipment: Shipment): void => {
  console.log("[PDFService] generatePreAlertPdf called with shipment ID:", shipment.id);
  console.log("[PDFService] Pre-Alert Shipment Data:", {
    id: shipment.id,
    carrierId: shipment.carrierId,
    driverName: shipment.driverName,
    departureDate: shipment.departureDate, // This will log the Firestore Timestamp object
    status: shipment.status
  });

  try {
    const doc = new jsPDF();
    // Enhanced check for jsPDF instance validity
    if (!doc || typeof doc.text !== 'function' || typeof doc.output !== 'function') {
      console.error("[PDFService] Pre-Alert PDF: jsPDF document object is invalid or not fully initialized.");
      alert("Error: PDF generation tool (jsPDF) is not properly initialized for Pre-Alert.");
      return;
    }
    console.log("[PDFService] Pre-Alert PDF: jsPDF document object is valid and initialized.");

    doc.setFontSize(18);
    doc.text("Pre-Alert Document", 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Shipment ID: ${shipment.id || 'N/A'}`, 20, 40);
    doc.text(`Carrier: ${shipment.carrierId || 'N/A'}`, 20, 50);
    doc.text(`Driver Name: ${shipment.driverName || 'N/A'}`, 20, 60);
    doc.text(`Departure Date: ${formatPdfTimestamp(shipment.departureDate)}`, 20, 70);
    doc.text(`Arrival Date: ${formatPdfTimestamp(shipment.arrivalDate)}`, 20, 80);
    doc.text(`Status: ${shipment.status || 'N/A'}`, 20, 90);
    doc.text(`Seal Number: ${shipment.sealNumber || 'N/A'}`, 20, 100);

    console.log("[PDFService] Pre-Alert PDF: jsPDF document content defined.");
    const filename = `pre-alert-${shipment.id}.pdf`;
    triggerDownload(doc, filename);

  } catch (error) {
    console.error("[PDFService] Error in generatePreAlertPdf function:", error);
    alert(`Error creating Pre-Alert PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const generateCmrPdf = (shipment: Shipment): void => {
  console.log("[PDFService] generateCmrPdf called with shipment ID:", shipment.id);
  console.log("[PDFService] CMR Shipment Data:", {
    id: shipment.id,
    senderAddress: shipment.senderAddress,
    consigneeAddress: shipment.consigneeAddress,
    totalGrossWeight: shipment.totalGrossWeight
  });
  try {
    const doc = new jsPDF();
     if (!doc || typeof doc.text !== 'function' || typeof doc.output !== 'function') {
      console.error("[PDFService] CMR PDF: jsPDF document object is invalid or not fully initialized.");
      alert("Error: PDF generation tool (jsPDF) is not properly initialized for CMR.");
      return;
    }
    console.log("[PDFService] CMR PDF: jsPDF document object is valid and initialized.");


    doc.setFontSize(18);
    doc.text("CMR Document", 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text("1. Sender (Name, address, country)", 20, 40);
    doc.text(shipment.senderAddress || "N/A", 25, 47, { maxWidth: 170 });

    doc.text("2. Consignee (Name, address, country)", 20, 70);
    doc.text(shipment.consigneeAddress || "N/A", 25, 77, { maxWidth: 170 });

    doc.text(`3. Place of delivery of goods (Place, country)`, 20, 100);
    doc.text(`(As per consignee address)`, 25, 107);

    doc.text(`Truck Registration: ${shipment.truckRegistration || 'N/A'}`, 20, 120);
    doc.text(`Trailer Registration: ${shipment.trailerRegistration || 'N/A'}`, 20, 130);
    doc.text(`Seal Number: ${shipment.sealNumber || 'N/A'}`, 20, 140);

    doc.text(`Description of Goods: General Goods (As per manifest)`, 20, 160);
    doc.text(`Total Gross Weight (kg): ${shipment.totalGrossWeight?.toFixed(3) || 'N/A'}`, 20, 170);
    doc.text(`Total Pallets: ${shipment.totalPallets || 'N/A'}`, 20, 180);
    doc.text(`Total Bags: ${shipment.totalBags || 'N/A'}`, 20, 190);

    doc.text("Carrier's Signature / Stamp:", 20, 220);
    doc.text("Sender's Signature / Stamp:", 110, 220);

    console.log("[PDFService] CMR PDF: jsPDF document content defined.");
    const filename = `cmr-${shipment.id}.pdf`;
    triggerDownload(doc, filename);

  } catch (error) {
    console.error("[PDFService] Error in generateCmrPdf function:", error);
    alert(`Error creating CMR PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
};

