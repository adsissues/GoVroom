
"use client"; // For client-side PDF generation and download

import jsPDF from 'jspdf';
import type { Shipment } from '@/lib/types';
import { format } from 'date-fns';

const formatPdfTimestamp = (timestamp: any): string => {
  if (!timestamp) return 'N/A';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "PPP");
  } catch (error) {
    console.error("[PDFService] Error formatting timestamp for PDF:", error);
    return 'Invalid Date';
  }
};

const triggerDownload = (doc: jsPDF, filename: string) => {
  console.log(`[PDFService] triggerDownload called for: ${filename}`);
  try {
    console.log(`[PDFService] Attempting to generate data URI for ${filename}...`);
    const pdfDataUri = doc.output('datauristring');
    
    console.log(`[PDFService] Data URI generated for ${filename}. Type: ${typeof pdfDataUri}`);
    if (typeof pdfDataUri !== 'string' || pdfDataUri.length < 100 || !pdfDataUri.startsWith('data:application/pdf;base64,')) {
        console.error(`[PDFService] Critical Error: pdfDataUri for ${filename} is invalid or too short. Length: ${pdfDataUri?.length}. Starts with: ${pdfDataUri?.substring(0,30)}`);
        alert(`Failed to generate valid PDF content for ${filename}. PDF data URI was invalid or too short. Please check console.`);
        return;
    }
    console.log(`[PDFService] Generated Data URI for ${filename} is a string and seems valid. Length: ${pdfDataUri.length}.`);
    console.log(`[PDFService] Data URI Preview (first 150 chars): ${pdfDataUri.substring(0,150)}`);

    console.log(`[PDFService] Creating anchor element for ${filename}...`);
    const link = document.createElement('a');
    link.href = pdfDataUri;
    link.download = filename;
    
    console.log(`[PDFService] Anchor href (first 100): ${link.href.substring(0,100)}, download: ${link.download}`);

    document.body.appendChild(link);
    console.log(`[PDFService] Simulating click for ${filename}...`);
    link.click();
    document.body.removeChild(link);
    console.log(`[PDFService] Download process initiated for ${filename}.`);

  } catch (error) {
    console.error(`[PDFService] Error in triggerDownload for ${filename}:`, error);
    alert(`An error occurred while trying to download ${filename}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const generatePreAlertPdf = (shipment: Shipment): void => {
  console.log("[PDFService] generatePreAlertPdf called. Shipment ID:", shipment.id);
  console.log("[PDFService] Full shipment data for Pre-Alert:", JSON.stringify(shipment, null, 2));
  try {
    console.log("[PDFService] Pre-Alert: Creating new jsPDF instance...");
    const doc = new jsPDF();
    if (!doc || typeof doc.text !== 'function') {
      console.error("[PDFService] Pre-Alert PDF: jsPDF document object is invalid.");
      alert("Error: PDF generation tool (jsPDF) is not properly initialized for Pre-Alert.");
      return;
    }
    console.log("[PDFService] Pre-Alert: jsPDF instance created.");

    doc.setFontSize(18);
    doc.text("Test Pre-Alert PDF", 10, 20); // Simplified content
    // doc.text("Pre-Alert Document", 105, 20, { align: 'center' });
    // doc.setFontSize(12);
    // doc.text(`Shipment ID: ${shipment.id || 'N/A'}`, 20, 40);
    // doc.text(`Carrier: ${shipment.carrierId || 'N/A'}`, 20, 50);
    // doc.text(`Driver Name: ${shipment.driverName || 'N/A'}`, 20, 60);
    // doc.text(`Departure Date: ${formatPdfTimestamp(shipment.departureDate)}`, 20, 70);
    // doc.text(`Arrival Date: ${formatPdfTimestamp(shipment.arrivalDate)}`, 20, 80);
    // doc.text(`Status: ${shipment.status || 'N/A'}`, 20, 90);
    // doc.text(`Seal Number: ${shipment.sealNumber || 'N/A'}`, 20, 100);

    console.log("[PDFService] Pre-Alert PDF: Content defined (simplified).");
    const filename = `pre-alert-${shipment.id || 'unknown'}.pdf`;
    triggerDownload(doc, filename);

  } catch (error) {
    console.error("[PDFService] Error directly in generatePreAlertPdf function:", error);
    alert(`Error creating Pre-Alert PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const generateCmrPdf = (shipment: Shipment): void => {
  console.log("[PDFService] generateCmrPdf called. Shipment ID:", shipment.id);
  console.log("[PDFService] Full shipment data for CMR:", JSON.stringify(shipment, null, 2));
  try {
    console.log("[PDFService] CMR: Creating new jsPDF instance...");
    const doc = new jsPDF();
    if (!doc || typeof doc.text !== 'function') {
      console.error("[PDFService] CMR PDF: jsPDF document object is invalid.");
      alert("Error: PDF generation tool (jsPDF) is not properly initialized for CMR.");
      return;
    }
    console.log("[PDFService] CMR: jsPDF instance created.");

    doc.setFontSize(18);
    doc.text("Test CMR PDF", 10, 20); // Simplified content
    // doc.text("CMR Document", 105, 20, { align: 'center' });
    // doc.setFontSize(12);
    // doc.text("1. Sender (Name, address, country)", 20, 40);
    // doc.text(shipment.senderAddress || "N/A", 25, 47, { maxWidth: 170 });
    // doc.text("2. Consignee (Name, address, country)", 20, 70);
    // doc.text(shipment.consigneeAddress || "N/A", 25, 77, { maxWidth: 170 });
    // doc.text(`Truck Registration: ${shipment.truckRegistration || 'N/A'}`, 20, 120);
    // doc.text(`Total Gross Weight (kg): ${shipment.totalGrossWeight?.toFixed(3) || 'N/A'}`, 20, 170);

    console.log("[PDFService] CMR PDF: Content defined (simplified).");
    const filename = `cmr-${shipment.id || 'unknown'}.pdf`;
    triggerDownload(doc, filename);

  } catch (error) {
    console.error("[PDFService] Error directly in generateCmrPdf function:", error);
    alert(`Error creating CMR PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
};

