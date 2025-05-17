
"use client";

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Shipment, ShipmentDetail } from '@/lib/types';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, query, QueryDocumentSnapshot, DocumentData, Timestamp } from 'firebase/firestore';
import { detailFromFirestore } from '@/lib/firebase/shipmentsService';
import { getDropdownOptionsMap } from '@/lib/firebase/dropdownService';
import { SERVICE_FORMAT_MAPPING } from '@/lib/constants';
import { format } from 'date-fns';

// Helper function to trigger download via data URI
const triggerDownload = (doc: jsPDF, filename: string, pdfType: string): void => {
  console.log(`[PDFService] ${pdfType}: triggerDownload CALLED for: ${filename}`);
  try {
    console.log(`[PDFService] ${pdfType}: Attempting to generate data URI for ${filename}...`);
    const pdfDataUri = doc.output('datauristring'); // Standard jspdf output
    const pdfDataUriType = typeof pdfDataUri;
    const pdfDataUriLength = pdfDataUri?.length || 0;

    console.log(`[PDFService] ${pdfType}: Data URI generated. Type: ${pdfDataUriType}, Length: ${pdfDataUriLength}`);
    console.log(`[PDFService] ${pdfType}: Data URI Preview (first 100 chars): ${pdfDataUri?.substring(0, 100)}`);

    // Validate if it's a string, starts with 'data:application/pdf;', and contains ';base64,'
    const isValidBase64PdfDataUri =
      pdfDataUriType === 'string' &&
      pdfDataUriLength > 100 && // A very minimal PDF will still be larger than this
      pdfDataUri.startsWith('data:application/pdf;') && // Check for PDF mime type
      pdfDataUri.includes(';base64,'); // Crucially, check for base64 encoding marker

    if (!isValidBase64PdfDataUri) {
      const errorMsg = `CRITICAL ERROR - pdfDataUri for ${filename} is not a valid base64 PDF Data URI. Length: ${pdfDataUriLength}. Starts with: ${pdfDataUri?.substring(0, 50)}. Contains ';base64,': ${pdfDataUri?.includes(';base64,')}`;
      console.error(`[PDFService] ${pdfType}: ${errorMsg}`);
      alert(`Failed to generate valid PDF content for ${filename} (Type: ${pdfType}). ${errorMsg}. Please check console.`);
      return;
    }
    console.log(`[PDFService] ${pdfType}: Generated Data URI for ${filename} appears valid.`);

    console.log(`[PDFService] ${pdfType}: Creating anchor element for ${filename}...`);
    const link = document.createElement('a');
    link.href = pdfDataUri;
    link.download = filename;
    console.log(`[PDFService] ${pdfType}: Anchor element created. Href (first 50 chars): ${link.href.substring(0,50)}..., Download: ${link.download}`);

    document.body.appendChild(link);
    console.log(`[PDFService] ${pdfType}: Simulating click for ${filename}...`);
    link.click();
    console.log(`[PDFService] ${pdfType}: Click simulated.`);
    document.body.removeChild(link);
    console.log(`[PDFService] ${pdfType}: Anchor element removed. Download process should be initiated for ${filename}.`);

  } catch (error) {
    const errorMsg = `Error in triggerDownload for ${filename}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[PDFService] ${pdfType}: ${errorMsg}`);
    alert(`An error occurred while trying to download ${filename} (Type: ${pdfType}): ${errorMsg}`);
  }
};


const formatDateForPdf = (timestamp?: Timestamp): string => {
  if (!timestamp) return 'N/A';
  try {
    return format(timestamp.toDate(), 'dd/MM/yyyy');
  } catch (e) {
    console.error("Error formatting date for PDF", e);
    return 'Invalid Date';
  }
};

const getLabelFromMap = (map: Record<string, string> | undefined, value: string | undefined, defaultValueIfNotFoundOrValueMissing = 'N/A'): string => {
  if (!value) return defaultValueIfNotFoundOrValueMissing; // If value itself is missing, return default
  if (!map) return value; // If map is missing, return the value/ID itself
  return map[value] || value; // If label not in map, return the value/ID itself
};


const getShipmentDetails = async (shipmentId: string): Promise<ShipmentDetail[]> => {
  console.log(`[PDFService] getShipmentDetails CALLED for shipmentId: ${shipmentId}`);
  if (!shipmentId) {
    console.warn("[PDFService] getShipmentDetails: shipmentId is empty or undefined.");
    return [];
  }
  const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');
  const q = query(detailsCollectionRef, orderBy('createdAt', 'asc')); // Assuming you want details ordered
  try {
    const snapshot = await getDocs(q);
    const details = snapshot.docs.map(doc => detailFromFirestore(doc as QueryDocumentSnapshot<DocumentData>));
    console.log(`[PDFService] getShipmentDetails: Fetched ${details.length} details for shipment ${shipmentId}.`);
    return details;
  } catch (error) {
    console.error(`[PDFService] getShipmentDetails: Error fetching details for shipment ${shipmentId}:`, error);
    return []; // Return empty array on error
  }
};


export const generatePreAlertPdf = async (shipment: Shipment): Promise<void> => {
  const pdfType = "Pre-Alert";
  const filename = `pre-alert-${shipment.id || 'shipment'}.pdf`;
  console.log(`[PDFService] ${pdfType}: generatePreAlertPdf CALLED. Attempting to generate: ${filename}`);
  console.log(`[PDFService] ${pdfType} PDF: Full shipment data:`, JSON.stringify(shipment, null, 2));

  try {
    console.log(`[PDFService] ${pdfType}: Creating new jsPDF instance...`);
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    console.log(`[PDFService] ${pdfType}: jsPDF instance created successfully.`);

    const details = await getShipmentDetails(shipment.id);
    console.log(`[PDFService] ${pdfType}: Fetched ${details.length} shipment details.`);

    const allFormatCollectionIds = Object.values(SERVICE_FORMAT_MAPPING).filter(Boolean) as string[];
    const dropdownCollectionNames = [...new Set(['carriers', 'subcarriers', 'customers', 'services', 'doe', ...allFormatCollectionIds])];
    const dropdownMaps = await getDropdownOptionsMap(dropdownCollectionNames);
    console.log(`[PDFService] ${pdfType}: Fetched dropdown maps for labels.`);

    // --- PDF Content ---
    const pageMargin = 15;
    const contentWidth = doc.internal.pageSize.getWidth() - 2 * pageMargin;
    let currentY = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text("Shipment Completion Report", doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
    currentY += 15;

    // Main Shipment Details Section Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Main Shipment Details:", pageMargin, currentY);
    currentY += 7;

    // Main Shipment Details Content (Two-column layout)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const labelValuePairs = [
      { label: "Date Departure:", value: formatDateForPdf(shipment.departureDate) },
      { label: "Arrival Date:", value: formatDateForPdf(shipment.arrivalDate) },
      { label: "Carrier:", value: getLabelFromMap(dropdownMaps['carriers'], shipment.carrierId, 'N/A') }, // Explicitly N/A if carrierId is undefined or not found
      { label: "Subcarrier:", value: getLabelFromMap(dropdownMaps['subcarriers'], shipment.subcarrierId, shipment.subcarrierId || 'N/A') },
      { label: "Driver Name:", value: shipment.driverName || 'N/A' },
      { label: "Truck Reg No:", value: shipment.truckRegistration || 'N/A' },
      { label: "Trailer Reg No:", value: shipment.trailerRegistration || 'N/A' },
      { label: "Seal No:", value: shipment.sealNumber || 'N/A' },
      { label: "Total Gross Weight:", value: `${(shipment.totalGrossWeight || 0).toFixed(2)} kg` },
      { label: "Total Net Weight:", value: `${(shipment.totalNetWeight || 0).toFixed(2)} kg` },
      { label: "Total Pallets:", value: (shipment.totalPallets || 0).toString() },
      { label: "Total Bags:", value: (shipment.totalBags || 0).toString() },
    ];

    const firstColX = pageMargin;
    const secondColX = pageMargin + 45; // Adjusted for potentially longer labels
    const lineHeight = 6;

    labelValuePairs.forEach(pair => {
      doc.text(pair.label, firstColX, currentY);
      doc.text(pair.value, secondColX, currentY);
      currentY += lineHeight;
      if (currentY > doc.internal.pageSize.getHeight() - 30) { // Basic page break
        doc.addPage();
        currentY = 20;
      }
    });
    currentY += 5; // Extra space before next section

    // Shipment Details Section Title
    if (currentY > doc.internal.pageSize.getHeight() - 50) { // Check if enough space for title + some table
        doc.addPage();
        currentY = 20;
    }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Shipment Details:", pageMargin, currentY);
    currentY += 7;

    // Shipment Details Table
    const tableHead = [['Customer', 'Service', 'Format', 'Tare Weight', 'Gross Weight', 'Net Weight', 'Dispatch No.', 'DOE']];
    const tableBody = details.map(detail => {
      const serviceKey = detail.serviceId?.toLowerCase();
      const formatCollectionId = serviceKey ? SERVICE_FORMAT_MAPPING[serviceKey] : null;
      let formatDisplay = detail.formatId || 'N/A';
      if (formatCollectionId && detail.formatId) {
        formatDisplay = getLabelFromMap(dropdownMaps[formatCollectionId], detail.formatId, detail.formatId);
      }

      return [
        getLabelFromMap(dropdownMaps['customers'], detail.customerId, detail.customerId || 'N/A'),
        getLabelFromMap(dropdownMaps['services'], detail.serviceId, detail.serviceId || 'N/A'),
        formatDisplay,
        `${(detail.tareWeight || 0).toFixed(2)} kg`,
        `${(detail.grossWeight || 0).toFixed(2)} kg`,
        `${(detail.netWeight || 0).toFixed(2)} kg`,
        detail.dispatchNumber || 'N/A',
        getLabelFromMap(dropdownMaps['doe'], detail.doeId, detail.doeId || 'N/A'),
      ];
    });

    autoTable(doc, {
      head: tableHead,
      body: tableBody,
      startY: currentY,
      theme: 'grid', 
      styles: {
        fontSize: 8,
        cellPadding: 1.5,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [22, 78, 99], // Dark blue
        textColor: [255, 255, 255], // White
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: { // Example: Center specific columns
        // 0: { halign: 'left' }, // Customer
        // 3: { halign: 'right' }, // Tare Weight
        // 4: { halign: 'right' }, // Gross Weight
        // 5: { halign: 'right' }, // Net Weight
      },
      tableLineColor: [189, 195, 199], 
      tableLineWidth: 0.1,
      didDrawPage: (data) => { // For multi-page tables, re-draw headers etc. if needed
        // You can add headers/footers on each page here if autoTable spans multiple pages
      }
    });
    // currentY = (doc as any).lastAutoTable.finalY + 10; // Not strictly needed if it's the last element


    console.log(`[PDFService] ${pdfType}: Content added to PDF.`);
    console.log(`[PDFService] ${pdfType}: Attempting to save ${filename}...`);
    triggerDownload(doc, filename, pdfType);
    console.log(`[PDFService] ${pdfType}: triggerDownload completed for ${filename}.`);

  } catch (error) {
    const errorMsg = `Error in generatePreAlertPdf for ${filename}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[PDFService] ${pdfType}: ${errorMsg}`, error);
    alert(`Error creating ${pdfType} PDF for ${shipment.id}: ${errorMsg}`);
  }
};


export const generateCmrPdf = async (shipment: Shipment): Promise<void> => {
  const pdfType = "CMR";
  const filename = `cmr-${shipment.id || 'shipment'}.pdf`;
  console.log(`[PDFService] ${pdfType}: generateCmrPdf CALLED. Attempting to generate: ${filename}`);
  console.log(`[PDFService] ${pdfType} PDF: Full shipment data:`, JSON.stringify(shipment, null, 2));
  
  try {
    console.log(`[PDFService] ${pdfType}: Creating new jsPDF instance...`);
    const doc = new jsPDF();
    console.log(`[PDFService] ${pdfType}: jsPDF instance created successfully.`);

    console.log(`[PDFService] ${pdfType}: Setting font size and adding simplified text...`);
    doc.setFontSize(18);
    doc.text("CMR PDF - Placeholder", 10, 20);
    doc.setFontSize(12);
    doc.text(`Shipment ID: ${shipment.id || 'N/A'}`, 10, 30);
    doc.text("This is a placeholder for the CMR document.", 10, 40);
    console.log(`[PDFService] ${pdfType}: Simplified text added to PDF.`);
    
    console.log(`[PDFService] ${pdfType}: Attempting to save ${filename}...`);
    triggerDownload(doc, filename, pdfType);
    console.log(`[PDFService] ${pdfType}: triggerDownload completed for ${filename}.`);

  } catch (error) {
    const errorMsg = `Error directly in generateCmrPdf function for ${filename}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[PDFService] ${pdfType}: ${errorMsg}`, error);
    alert(`Error creating ${pdfType} PDF for ${shipment.id}: ${errorMsg}`);
  }
};

