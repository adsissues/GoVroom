
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

// This function remains for potential future use if doc.save() consistently fails
// const triggerDownloadViaDataUri = (doc: jsPDF, filename: string) => {
//   console.log(`[PDFService] triggerDownloadViaDataUri called for: ${filename}`);
//   try {
//     console.log(`[PDFService] Attempting to generate data URI for ${filename}...`);
//     const pdfDataUri = doc.output('datauristring');
//     console.log(`[PDFService] Data URI generated for ${filename}. Type: ${typeof pdfDataUri}`);

//     if (typeof pdfDataUri !== 'string' || pdfDataUri.length < 100 || !pdfDataUri.startsWith('data:application/pdf;base64,')) {
//         console.error(`[PDFService] Critical Error: pdfDataUri for ${filename} is invalid or too short. Length: ${pdfDataUri?.length}. Starts with: ${pdfDataUri?.substring(0,30)}`);
//         alert(`Failed to generate valid PDF content for ${filename}. PDF data URI was invalid or too short. Please check console.`);
//         return;
//     }
//     console.log(`[PDFService] Generated Data URI for ${filename} is a string and seems valid. Length: ${pdfDataUri.length}.`);
//     // console.log(`[PDFService] Data URI Preview (first 150 chars): ${pdfDataUri.substring(0,150)}`);

//     console.log(`[PDFService] Creating anchor element for ${filename}...`);
//     const link = document.createElement('a');
//     link.href = pdfDataUri;
//     link.download = filename;
    
//     console.log(`[PDFService] Anchor href set for ${filename}.`);

//     document.body.appendChild(link);
//     console.log(`[PDFService] Simulating click for ${filename}...`);
//     link.click();
//     document.body.removeChild(link);
//     console.log(`[PDFService] Download process initiated via data URI for ${filename}.`);

//   } catch (error) {
//     console.error(`[PDFService] Error in triggerDownloadViaDataUri for ${filename}:`, error);
//     alert(`An error occurred while trying to download ${filename} via data URI: ${error instanceof Error ? error.message : String(error)}`);
//   }
// };

export const generatePreAlertPdf = (shipment: Shipment): void => {
  const filename = `pre-alert-${shipment.id || 'shipment'}.pdf`;
  console.log(`[PDFService] generatePreAlertPdf called. Attempting to generate: ${filename}`);
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

    // Simplified content for robust testing
    doc.setFontSize(18);
    doc.text("Pre-Alert Document (Test)", 10, 20);
    doc.setFontSize(12);
    doc.text(`Shipment ID: ${shipment.id || 'N/A'}`, 10, 30);
    doc.text(`Carrier: ${shipment.carrierId || 'N/A'}`, 10, 40);
    doc.text(`Status: ${shipment.status || 'N/A'}`, 10, 50);
    console.log("[PDFService] Pre-Alert PDF: Content defined.");

    console.log(`[PDFService] Pre-Alert PDF: Attempting to save ${filename}...`);
    doc.save(filename); // Direct save
    console.log(`[PDFService] Pre-Alert PDF: doc.save('${filename}') called.`);

  } catch (error) {
    console.error(`[PDFService] Error directly in generatePreAlertPdf function for ${filename}:`, error);
    alert(`Error creating Pre-Alert PDF for ${shipment.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const generateCmrPdf = (shipment: Shipment): void => {
  const filename = `cmr-${shipment.id || 'shipment'}.pdf`;
  console.log(`[PDFService] generateCmrPdf called. Attempting to generate: ${filename}`);
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
    
    // Simplified content for robust testing
    doc.setFontSize(18);
    doc.text("CMR Document (Test)", 10, 20);
    doc.setFontSize(12);
    doc.text(`Shipment ID: ${shipment.id || 'N/A'}`, 10, 30);
    doc.text(`Sender: ${shipment.senderAddress || 'N/A'}`, 10, 40, { maxWidth: 180 });
    doc.text(`Consignee: ${shipment.consigneeAddress || 'N/A'}`, 10, 60, { maxWidth: 180 });
    console.log("[PDFService] CMR PDF: Content defined.");
    
    console.log(`[PDFService] CMR PDF: Attempting to save ${filename}...`);
    doc.save(filename); // Direct save
    console.log(`[PDFService] CMR PDF: doc.save('${filename}') called.`);

  } catch (error) {
    console.error(`[PDFService] Error directly in generateCmrPdf function for ${filename}:`, error);
    alert(`Error creating CMR PDF for ${shipment.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
};
