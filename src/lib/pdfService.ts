
"use client"; // For client-side PDF generation and download

import jsPDF from 'jspdf';
import type { Shipment } from '@/lib/types';
// format from date-fns is not used in the simplified version, but can be re-added later
// import { format } from 'date-fns';

// const formatPdfTimestamp = (timestamp: any): string => {
//   if (!timestamp) return 'N/A';
//   try {
//     const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
//     return format(date, "PPP");
//   } catch (error) {
//     console.error("[PDFService] Error formatting timestamp for PDF:", error);
//     return 'Invalid Date';
//   }
// };

const triggerDownload = (doc: jsPDF, filename: string, pdfType: string): void => {
  console.log(`[PDFService] triggerDownload called for: ${filename} (Type: ${pdfType})`);
  try {
    console.log(`[PDFService] ${pdfType}: Attempting to generate data URI for ${filename}...`);
    const pdfDataUri = doc.output('datauristring');
    const pdfDataUriType = typeof pdfDataUri;
    const pdfDataUriLength = pdfDataUri?.length || 0;
    console.log(`[PDFService] ${pdfType}: Data URI generated. Type: ${pdfDataUriType}, Length: ${pdfDataUriLength}`);
    console.log(`[PDFService] ${pdfType}: Data URI Preview (first 100 chars): ${pdfDataUri?.substring(0, 100)}`);

    if (pdfDataUriType !== 'string' || pdfDataUriLength < 100 || !pdfDataUri.startsWith('data:application/pdf;base64,')) {
      console.error(`[PDFService] ${pdfType}: CRITICAL ERROR - pdfDataUri for ${filename} is invalid or too short. Length: ${pdfDataUriLength}. Starts with: ${pdfDataUri?.substring(0, 30)}`);
      alert(`Failed to generate valid PDF content for ${filename} (Type: ${pdfType}). PDF data URI was invalid. Please check console.`);
      return;
    }
    console.log(`[PDFService] ${pdfType}: Generated Data URI for ${filename} appears valid.`);

    console.log(`[PDFService] ${pdfType}: Creating anchor element for ${filename}...`);
    const link = document.createElement('a');
    link.href = pdfDataUri;
    link.download = filename;
    console.log(`[PDFService] ${pdfType}: Anchor element created. Href: ${link.href.substring(0,50)}..., Download: ${link.download}`);

    document.body.appendChild(link);
    console.log(`[PDFService] ${pdfType}: Simulating click for ${filename}...`);
    link.click();
    console.log(`[PDFService] ${pdfType}: Click simulated.`);
    document.body.removeChild(link);
    console.log(`[PDFService] ${pdfType}: Anchor element removed. Download process should be initiated for ${filename}.`);

  } catch (error) {
    console.error(`[PDFService] ${pdfType}: Error in triggerDownload for ${filename}:`, error);
    alert(`An error occurred while trying to download ${filename} (Type: ${pdfType}): ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const generatePreAlertPdf = (shipment: Shipment): void => {
  const pdfType = "Pre-Alert";
  const filename = `pre-alert-${shipment.id || 'unknown_shipment'}.pdf`;
  console.log(`[PDFService] ${pdfType}: generatePreAlertPdf CALLED. Attempting to generate: ${filename}`);
  console.log(`[PDFService] ${pdfType}: Input shipment data:`, JSON.parse(JSON.stringify(shipment))); // Log a copy

  try {
    console.log(`[PDFService] ${pdfType}: Creating new jsPDF instance...`);
    const doc = new jsPDF();
    if (!doc || typeof doc.text !== 'function') {
      console.error(`[PDFService] ${pdfType}: jsPDF document object is invalid AFTER INSTANTIATION.`);
      alert(`Error: PDF generation tool (jsPDF) is not properly initialized for ${pdfType}.`);
      return;
    }
    console.log(`[PDFService] ${pdfType}: jsPDF instance created successfully.`);

    console.log(`[PDFService] ${pdfType}: Setting font size and adding text...`);
    doc.setFontSize(18);
    doc.text(`Test PDF - ${pdfType}`, 10, 20); // Simplified content
    doc.setFontSize(12);
    doc.text(`Shipment ID: ${shipment.id || 'N/A'}`, 10, 30);
    console.log(`[PDFService] ${pdfType}: Text added to PDF.`);

    triggerDownload(doc, filename, pdfType);

  } catch (error) {
    console.error(`[PDFService] ${pdfType}: Error directly in generatePreAlertPdf function for ${filename}:`, error);
    alert(`Error creating ${pdfType} PDF for ${shipment.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const generateCmrPdf = (shipment: Shipment): void => {
  const pdfType = "CMR";
  const filename = `cmr-${shipment.id || 'unknown_shipment'}.pdf`;
  console.log(`[PDFService] ${pdfType}: generateCmrPdf CALLED. Attempting to generate: ${filename}`);
  console.log(`[PDFService] ${pdfType}: Input shipment data:`, JSON.parse(JSON.stringify(shipment))); // Log a copy

  try {
    console.log(`[PDFService] ${pdfType}: Creating new jsPDF instance...`);
    const doc = new jsPDF();
    if (!doc || typeof doc.text !== 'function') {
      console.error(`[PDFService] ${pdfType}: jsPDF document object is invalid AFTER INSTANTIATION.`);
      alert(`Error: PDF generation tool (jsPDF) is not properly initialized for ${pdfType}.`);
      return;
    }
    console.log(`[PDFService] ${pdfType}: jsPDF instance created successfully.`);

    console.log(`[PDFService] ${pdfType}: Setting font size and adding text...`);
    doc.setFontSize(18);
    doc.text(`Test PDF - ${pdfType}`, 10, 20); // Simplified content
    doc.setFontSize(12);
    doc.text(`Shipment ID: ${shipment.id || 'N/A'}`, 10, 30);
    console.log(`[PDFService] ${pdfType}: Text added to PDF.`);
    
    triggerDownload(doc, filename, pdfType);

  } catch (error) {
    console.error(`[PDFService] ${pdfType}: Error directly in generateCmrPdf function for ${filename}:`, error);
    alert(`Error creating ${pdfType} PDF for ${shipment.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

    