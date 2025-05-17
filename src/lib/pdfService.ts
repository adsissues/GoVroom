
"use client";

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Shipment, ShipmentDetail } from '@/lib/types';
import { db } from '@/lib/firebase/config';
import {
    collection,
    getDocs,
    query,
    orderBy, // Ensure orderBy is imported
    type QueryDocumentSnapshot,
    type DocumentData,
    Timestamp
} from 'firebase/firestore';
import { detailFromFirestore } from '@/lib/firebase/shipmentsService';
import { getDropdownOptionsMap } from '@/lib/firebase/dropdownService';
import { SERVICE_FORMAT_MAPPING } from '@/lib/constants';
import { format } from 'date-fns';

// Helper function to trigger download via data URI
const triggerDownload = (doc: jsPDF, filename: string, pdfType: string): void => {
  console.log(`[PDFService] ${pdfType}: triggerDownload CALLED for: ${filename}`);
  try {
    console.log(`[PDFService] ${pdfType}: Attempting to generate data URI for ${filename}...`);
    const pdfDataUri = doc.output('datauristring'); // Use default: "datauristring"
    const pdfDataUriType = typeof pdfDataUri;
    const pdfDataUriLength = pdfDataUri?.length || 0;

    console.log(`[PDFService] ${pdfType}: Data URI generated. Type: ${pdfDataUriType}, Length: ${pdfDataUriLength}`);
    console.log(`[PDFService] ${pdfType}: Data URI Preview (first 100 chars): ${pdfDataUri?.substring(0, 100)}`);

    // Updated validation: Check it starts with 'data:application/pdf;' and contains ';base64,'
    const isValidBase64PdfDataUri =
      pdfDataUriType === 'string' &&
      pdfDataUriLength > 100 && // Basic check for non-trivial length
      pdfDataUri.startsWith('data:application/pdf;') && // Standard start
      pdfDataUri.includes(';base64,'); // Indicates base64 encoding

    if (!isValidBase64PdfDataUri) {
      const errorMsg = `CRITICAL ERROR - pdfDataUri for ${filename} is invalid or too short. Length: ${pdfDataUriLength}. Starts with: ${pdfDataUri?.substring(0, 50)}. Contains ';base64,': ${pdfDataUri?.includes(';base64,')}`;
      console.error(`[PDFService] ${pdfType}: ${errorMsg}`);
      alert(`Failed to generate valid PDF content for ${filename} (Type: ${pdfType}). ${errorMsg}. Please check console.`);
      return;
    }
    console.log(`[PDFService] ${pdfType}: Generated Data URI for ${filename} appears valid.`);

    console.log(`[PDFService] ${pdfType}: Creating anchor element for ${filename}...`);
    const link = document.createElement('a');
    // Use a simple data URI for the href, filename is handled by link.download
    link.href = `data:application/pdf;base64,${pdfDataUri.substring(pdfDataUri.indexOf(';base64,') + ';base64,'.length)}`;
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
  if (!value) return defaultValueIfNotFoundOrValueMissing;
  if (!map) return value; // If map is not available, return the value itself
  return map[value] || value; // If value not in map, return the value itself
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
    return [];
  }
};

const addAsendiaStyleLogo = (doc: jsPDF, x: number, y: number) => {
  const logoWidth = 35; // mm
  const logoHeight = 10; // mm
  const text = "asendia";
  const textFontSize = 8; // Approximate font size
  const dotRadius = 0.8; // mm
  const dotOffsetX = 22.6; // Approximate X offset for the dot on 'i' relative to start of "asendia" text
                       // This needs fine-tuning based on font and exact text rendering
  const dotOffsetY = -0.9; // Approximate Y offset for the dot relative to text baseline

  // Teal background rectangle (Asendia-like color: #005A6A or RGB 0, 90, 106)
  doc.setFillColor(0, 90, 106);
  doc.rect(x, y, logoWidth, logoHeight, 'F');

  // White text "asendia"
  doc.setFontSize(textFontSize);
  doc.setFont('helvetica', 'bold'); // Using bold for better visibility
  doc.setTextColor(255, 255, 255); // White text

  // Calculate text width to center it (optional, for this specific text it's simpler to estimate)
  // const textWidth = doc.getTextWidth(text);
  // const textX = x + (logoWidth - textWidth) / 2; // For precise centering
  const textX = x + 3; // Approximate padding from left
  const textY = y + logoHeight / 2 + (textFontSize / 3.5); // Center text vertically (approx)

  doc.text(text, textX, textY, { baseline: 'middle' });

  // Yellow dot on 'i' (Asendia yellow: #FFCD00 or RGB 255, 205, 0)
  doc.setFillColor(255, 205, 0);
  // Estimate position of the 'i's dot
  // The text "asendia" - 'i' is the 5th character.
  // This is a rough estimation and will depend heavily on the font metrics.
  // We need the x-coordinate of where the 'i' is rendered.
  // Let's assume `textX` is the start of "asendia".
  // We need to find the x position of the 'i'.
  // For "asendia", the dot of 'i' is roughly above the stem.
  const iDotX = textX + dotOffsetX;
  const iDotY = textY + dotOffsetY; // Adjust baseline for dot

  doc.circle(iDotX, iDotY, dotRadius, 'F');

  // Reset text color for subsequent text
  doc.setTextColor(0, 0, 0); // Black text
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
    const pageMargin = 15; // mm
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = pageMargin + 10; // Start Y position, leaving space for logo

    // Add Asendia Style Logo (top-left)
    addAsendiaStyleLogo(doc, pageMargin, pageMargin);

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    // Adjust title Y if logo is present and takes space, or center title relative to remaining space
    // For top-left logo, title can start further down or be aligned differently.
    // Let's place the title below the logo.
    currentY = pageMargin + 10 + 15; // Start below logo height + some padding

    doc.text("Shipment Completion Report", pageWidth / 2, currentY, { align: 'center' });
    currentY += 15;

    // Main Shipment Details Section Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Main Shipment Details:", pageMargin, currentY);
    currentY += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const labelValuePairs = [
      { label: "Date Departure:", value: formatDateForPdf(shipment.departureDate) },
      { label: "Arrival Date:", value: formatDateForPdf(shipment.arrivalDate) },
      { label: "Carrier:", value: getLabelFromMap(dropdownMaps['carriers'], shipment.carrierId, shipment.carrierId || 'N/A') },
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
    const secondColX = pageMargin + 45; // X for value column
    const lineHeight = 6;

    labelValuePairs.forEach(pair => {
      doc.text(pair.label, firstColX, currentY);
      doc.text(pair.value, secondColX, currentY);
      currentY += lineHeight;
      if (currentY > doc.internal.pageSize.getHeight() - 30) { // Check for page overflow
        doc.addPage();
        currentY = pageMargin; // Reset Y for new page
        addAsendiaStyleLogo(doc, pageMargin, pageMargin); // Re-add logo on new page
        currentY += 25; // Space for logo
      }
    });
    currentY += 5; // Extra space before details table


    // Check for page overflow before drawing table
    if (currentY > doc.internal.pageSize.getHeight() - 50) { // Arbitrary threshold for table header + some rows
        doc.addPage();
        currentY = pageMargin;
        addAsendiaStyleLogo(doc, pageMargin, pageMargin); // Re-add logo on new page
        currentY += 25; // Space for logo
    }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Shipment Details:", pageMargin, currentY);
    currentY += 7;


    const tableHead = [['Customer', 'Service', 'Format', 'Tare Weight', 'Gross Weight', 'Net Weight', 'Dispatch No.', 'DOE']];
    const tableBody = details.map(detail => {
      const serviceKey = detail.serviceId?.toLowerCase();
      const formatCollectionId = serviceKey && SERVICE_FORMAT_MAPPING[serviceKey] ? SERVICE_FORMAT_MAPPING[serviceKey] : null;
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
        fillColor: [0, 90, 106], // Asendia-like teal
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      tableLineColor: [180, 180, 180], // Lighter gray for table lines
      tableLineWidth: 0.1,
      didDrawPage: (data) => {
        // Add logo to each new page created by autoTable
        if (data.pageNumber > 1) {
             addAsendiaStyleLogo(doc, pageMargin, pageMargin);
        }
      }
    });


    console.log(`[PDFService] ${pdfType}: Content added to PDF.`);
    console.log(`[PDFService] ${pdfType}: Attempting to trigger download for ${filename}...`);
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
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    console.log(`[PDFService] ${pdfType}: jsPDF instance created successfully.`);
    
    const pageMargin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = pageMargin + 10;

    // Add Asendia Style Logo (top-left)
    addAsendiaStyleLogo(doc, pageMargin, pageMargin);
    currentY = pageMargin + 10 + 15; // Start below logo

    console.log(`[PDFService] ${pdfType}: Setting font size and adding simplified text...`);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text("CMR Document - Placeholder", pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Shipment ID: ${shipment.id || 'N/A'}`, pageMargin, currentY);
    currentY += 10;
    doc.text("This is a placeholder for the CMR document content.", pageMargin, currentY);
    currentY += 10;
    doc.text("Detailed CMR fields will be added here based on specific requirements.", pageMargin, currentY);
    console.log(`[PDFService] ${pdfType}: Simplified text added to PDF.`);

    console.log(`[PDFService] ${pdfType}: Attempting to trigger download for ${filename}...`);
    triggerDownload(doc, filename, pdfType);
    console.log(`[PDFService] ${pdfType}: triggerDownload completed for ${filename}.`);

  } catch (error) {
    const errorMsg = `Error in generateCmrPdf function for ${filename}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[PDFService] ${pdfType}: ${errorMsg}`, error);
    alert(`Error creating ${pdfType} PDF for ${shipment.id}: ${errorMsg}`);
  }
};
