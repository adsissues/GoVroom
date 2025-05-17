
"use client"; 

import jsPDF from 'jspdf';
import type { Shipment } from '@/lib/types';

// Helper function to trigger download via data URI
const triggerDownload = (doc: jsPDF, filename: string, pdfType: string): void => {
  console.log(`[PDFService] ${pdfType}: triggerDownload called for: ${filename}`);
  try {
    console.log(`[PDFService] ${pdfType}: Attempting to generate data URI for ${filename}...`);
    const pdfDataUri = doc.output('datauristring');
    const pdfDataUriType = typeof pdfDataUri;
    const pdfDataUriLength = pdfDataUri?.length || 0;
    console.log(`[PDFService] ${pdfType}: Data URI generated. Type: ${pdfDataUriType}, Length: ${pdfDataUriLength}`);
    console.log(`[PDFService] ${pdfType}: Data URI Preview (first 100 chars): ${pdfDataUri?.substring(0, 100)}`);

    if (pdfDataUriType !== 'string' || pdfDataUriLength < 100 || !pdfDataUri.startsWith('data:application/pdf;base64,')) {
      const errorMsg = `CRITICAL ERROR - pdfDataUri for ${filename} is invalid or too short. Length: ${pdfDataUriLength}. Starts with: ${pdfDataUri?.substring(0, 30)}`;
      console.error(`[PDFService] ${pdfType}: ${errorMsg}`);
      alert(`Failed to generate valid PDF content for ${filename} (Type: ${pdfType}). ${errorMsg}. Please check console.`);
      return;
    }
    console.log(`[PDFService] ${pdfType}: Generated Data URI for ${filename} appears valid.`);

    console.log(`[PDFService] ${pdfType}: Creating anchor element for ${filename}...`);
    const link = document.createElement('a');
    link.href = pdfDataUri;
    link.download = filename; // Ensure the filename is set for download
    console.log(`[PDFService] ${pdfType}: Anchor element created. Href (first 50 chars): ${link.href.substring(0,50)}..., Download: ${link.download}`);

    document.body.appendChild(link); // Append to body to ensure it's clickable
    console.log(`[PDFService] ${pdfType}: Simulating click for ${filename}...`);
    link.click();
    console.log(`[PDFService] ${pdfType}: Click simulated.`);
    document.body.removeChild(link); // Clean up the anchor element
    console.log(`[PDFService] ${pdfType}: Anchor element removed. Download process should be initiated for ${filename}.`);

  } catch (error) {
    const errorMsg = `Error in triggerDownload for ${filename}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[PDFService] ${pdfType}: ${errorMsg}`);
    alert(`An error occurred while trying to download ${filename} (Type: ${pdfType}): ${errorMsg}`);
  }
};

export const generatePreAlertPdf = (shipment: Shipment): void => {
  const pdfType = "Pre-Alert";
  const filename = `pre-alert-${shipment.id || 'shipment'}.pdf`; // Simplified filename
  console.log(`[PDFService] ${pdfType}: generatePreAlertPdf CALLED. Attempting to generate: ${filename}`);
  console.log(`[PDFService] ${pdfType}: Full shipment data:`, JSON.stringify(shipment, null, 2));

  try {
    console.log(`[PDFService] ${pdfType}: Creating new jsPDF instance...`);
    const doc = new jsPDF();
    if (!doc || typeof doc.text !== 'function') {
      console.error(`[PDFService] ${pdfType}: jsPDF document object is invalid AFTER INSTANTIATION.`);
      alert(`Error: PDF generation tool (jsPDF) is not properly initialized for ${pdfType}.`);
      return;
    }
    console.log(`[PDFService] ${pdfType}: jsPDF instance created successfully.`);

    console.log(`[PDFService] ${pdfType}: Setting font size and adding simplified text...`);
    doc.setFontSize(18);
    doc.text(`Test PDF - ${pdfType}`, 10, 20); 
    doc.setFontSize(12);
    doc.text(`Shipment ID: ${shipment.id || 'N/A'}`, 10, 30);
    console.log(`[PDFService] ${pdfType}: Simplified text added to PDF.`);

    triggerDownload(doc, filename, pdfType);

  } catch (error) {
    const errorMsg = `Error directly in generatePreAlertPdf function for ${filename}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[PDFService] ${pdfType}: ${errorMsg}`);
    alert(`Error creating ${pdfType} PDF for ${shipment.id}: ${errorMsg}`);
  }
};

export const generateCmrPdf = (shipment: Shipment): void => {
  const pdfType = "CMR";
  const filename = `cmr-${shipment.id || 'shipment'}.pdf`; // Simplified filename
  console.log(`[PDFService] ${pdfType}: generateCmrPdf CALLED. Attempting to generate: ${filename}`);
  console.log(`[PDFService] ${pdfType}: Full shipment data:`, JSON.stringify(shipment, null, 2));

  try {
    console.log(`[PDFService] ${pdfType}: Creating new jsPDF instance...`);
    const doc = new jsPDF();
     if (!doc || typeof doc.text !== 'function') {
      console.error(`[PDFService] ${pdfType}: jsPDF document object is invalid AFTER INSTANTIATION.`);
      alert(`Error: PDF generation tool (jsPDF) is not properly initialized for ${pdfType}.`);
      return;
    }
    console.log(`[PDFService] ${pdfType}: jsPDF instance created successfully.`);

    console.log(`[PDFService] ${pdfType}: Setting font size and adding simplified text...`);
    doc.setFontSize(18);
    doc.text(`Test PDF - ${pdfType}`, 10, 20);
    doc.setFontSize(12);
    doc.text(`Shipment ID: ${shipment.id || 'N/A'}`, 10, 30);
    console.log(`[PDFService] ${pdfType}: Simplified text added to PDF.`);
    
    triggerDownload(doc, filename, pdfType);

  } catch (error) {
    const errorMsg = `Error directly in generateCmrPdf function for ${filename}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[PDFService] ${pdfType}: ${errorMsg}`);
    alert(`Error creating ${pdfType} PDF for ${shipment.id}: ${errorMsg}`);
  }
};

    