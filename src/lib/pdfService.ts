
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

// Helper function to trigger download
const triggerDownload = (doc: jsPDF, filename: string) => {
  try {
    const pdfDataUri = doc.output('datauristring');
    console.log(`[PDFService] Generated Data URI for ${filename}. Length: ${pdfDataUri.length}`);

    const link = document.createElement('a');
    link.href = pdfDataUri;
    link.download = filename;
    document.body.appendChild(link); // Required for Firefox
    console.log(`[PDFService] Triggering click for ${filename}`);
    link.click();
    document.body.removeChild(link); // Clean up
    console.log(`[PDFService] Download triggered for ${filename}`);
  } catch (error) {
    console.error(`[PDFService] Error in triggerDownload for ${filename}:`, error);
  }
};

export const generatePreAlertPdf = (shipment: Shipment): void => {
  console.log("[PDFService] generatePreAlertPdf called with shipment:", JSON.stringify(shipment));
  try {
    const doc = new jsPDF();
    if (!doc) {
      console.error("[PDFService] Pre-Alert PDF: jsPDF document object is null or undefined before text calls.");
      return;
    }

    doc.setFontSize(18);
    doc.text("Pre-Alert Document", 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Shipment ID: ${shipment.id}`, 20, 40);
    doc.text(`Carrier: ${shipment.carrierId || 'N/A'}`, 20, 50);
    doc.text(`Driver Name: ${shipment.driverName || 'N/A'}`, 20, 60);
    doc.text(`Departure Date: ${formatPdfTimestamp(shipment.departureDate)}`, 20, 70);
    doc.text(`Arrival Date: ${formatPdfTimestamp(shipment.arrivalDate)}`, 20, 80);
    doc.text(`Status: ${shipment.status}`, 20, 90);
    doc.text(`Seal Number: ${shipment.sealNumber || 'N/A'}`, 20, 100);

    console.log("[PDFService] Pre-Alert PDF: jsPDF document object before generating output:", doc);
    const filename = `pre-alert-${shipment.id}.pdf`;
    triggerDownload(doc, filename);

  } catch (error) {
    console.error("[PDFService] Error in generatePreAlertPdf:", error);
  }
};

export const generateCmrPdf = (shipment: Shipment): void => {
  console.log("[PDFService] generateCmrPdf called with shipment:", JSON.stringify(shipment));
  try {
    const doc = new jsPDF();
     if (!doc) {
      console.error("[PDFService] CMR PDF: jsPDF document object is null or undefined before text calls.");
      return;
    }

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

    console.log("[PDFService] CMR PDF: jsPDF document object before generating output:", doc);
    const filename = `cmr-${shipment.id}.pdf`;
    triggerDownload(doc, filename);

  } catch (error) {
    console.error("[PDFService] Error in generateCmrPdf:", error);
  }
};

