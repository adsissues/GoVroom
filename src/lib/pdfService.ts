
"use client";

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // Import autoTable correctly
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
    const pdfDataUri = doc.output('datauristring');
    const pdfDataUriType = typeof pdfDataUri;
    const pdfDataUriLength = pdfDataUri?.length || 0;

    console.log(`[PDFService] ${pdfType}: Data URI generated. Type: ${pdfDataUriType}, Length: ${pdfDataUriLength}`);
    console.log(`[PDFService] ${pdfType}: Data URI Preview (first 100 chars): ${pdfDataUri?.substring(0, 100)}`);

    const isValidBase64PdfDataUri =
      pdfDataUriType === 'string' &&
      pdfDataUriLength > 100 &&
      pdfDataUri.startsWith('data:application/pdf;') && // Check for PDF MIME type
      pdfDataUri.includes(';base64,'); // Check for base64 encoding marker

    if (!isValidBase64PdfDataUri) {
      const errorMsg = `CRITICAL ERROR - pdfDataUri for ${filename} is invalid or too short. Length: ${pdfDataUriLength}. Starts with: ${pdfDataUri?.substring(0, 50)}. Contains ';base64,': ${pdfDataUri?.includes(';base64,')}`;
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
  if (!value) return defaultValueIfNotFoundOrValueMissing;
  if (!map) return value;
  return map[value] || value;
};

const addAsendiaStyleLogo = (doc: jsPDF, x: number, y: number) => {
    const logoWidth = 35; // mm
    const logoHeight = 10; // mm
    const text = "asendia";
    const textFontSize = 9;

    // Draw the teal box
    doc.setFillColor(0, 90, 106); // Dark Teal
    doc.rect(x, y, logoWidth, logoHeight, 'F');

    // Set text properties for "asendia"
    doc.setFontSize(textFontSize);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255); // White text

    // Calculate text position for centering within the box
    const textX = x + logoWidth / 2;
    const textY = y + logoHeight / 2; // Vertically center the baseline

    doc.text(text, textX, textY, { align: 'center', baseline: 'middle' });

    // Reset text color to black for subsequent text elements
    doc.setTextColor(0, 0, 0);
};

const getShipmentDetails = async (shipmentId: string): Promise<ShipmentDetail[]> => {
  console.log(`[PDFService] getShipmentDetails CALLED for shipmentId: ${shipmentId}`);
  if (!shipmentId) {
    console.warn("[PDFService] getShipmentDetails: shipmentId is empty or undefined.");
    return [];
  }
  const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');
  const q = query(detailsCollectionRef, orderBy('createdAt', 'asc'));
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

export const generatePreAlertPdf = async (shipment: Shipment): Promise<void> => {
  const pdfType = "Pre-Alert";
  const filename = `pre-alert-${shipment.id || 'unknown'}.pdf`;
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

    const pageMargin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = pageMargin;

    addAsendiaStyleLogo(doc, pageMargin, currentY);
    currentY += 10 + 5; // Space after logo

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text("Shipment Completion Report", pageWidth / 2, currentY, { align: 'center' });
    currentY += 15;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Main Shipment Details:", pageMargin, currentY);
    currentY += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const labelValuePairs = [
      { label: "Date Departure:", value: formatDateForPdf(shipment.departureDate) },
      { label: "Arrival Date:", value: formatDateForPdf(shipment.arrivalDate) },
      { label: "Carrier:", value: getLabelFromMap(dropdownMaps['carriers'], shipment.carrierId, shipment.carrierId) },
      { label: "Subcarrier:", value: getLabelFromMap(dropdownMaps['subcarriers'], shipment.subcarrierId, shipment.subcarrierId) },
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
    const secondColX = pageMargin + 45;
    const lineHeight = 6;

    labelValuePairs.forEach(pair => {
      if (currentY > doc.internal.pageSize.getHeight() - pageMargin - lineHeight) {
        doc.addPage();
        currentY = pageMargin;
        addAsendiaStyleLogo(doc, pageMargin, currentY);
        currentY += 10 + 5;
      }
      doc.text(pair.label, firstColX, currentY);
      doc.text(pair.value, secondColX, currentY);
      currentY += lineHeight;
    });
    currentY += 5;

    if (currentY > doc.internal.pageSize.getHeight() - 50) {
        doc.addPage();
        currentY = pageMargin;
        addAsendiaStyleLogo(doc, pageMargin, currentY);
        currentY += 10 + 5;
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
        getLabelFromMap(dropdownMaps['customers'], detail.customerId, detail.customerId),
        getLabelFromMap(dropdownMaps['services'], detail.serviceId, detail.serviceId),
        formatDisplay,
        `${(detail.tareWeight || 0).toFixed(2)} kg`,
        `${(detail.grossWeight || 0).toFixed(2)} kg`,
        `${(detail.netWeight || 0).toFixed(2)} kg`,
        detail.dispatchNumber || 'N/A',
        getLabelFromMap(dropdownMaps['doe'], detail.doeId, detail.doeId),
      ];
    });

    autoTable(doc, { // Correctly call autoTable
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
        fillColor: [22, 78, 99],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      tableLineColor: [180, 180, 180],
      tableLineWidth: 0.1,
      didDrawPage: (data: any) => {
        if (data.pageNumber > 1 || (data.pageNumber === 1 && data.cursor?.y && data.cursor.y < 40)) {
             addAsendiaStyleLogo(doc, pageMargin, pageMargin);
        }
      }
    });

    console.log(`[PDFService] ${pdfType}: Content added to PDF.`);
    triggerDownload(doc, filename, pdfType);
    console.log(`[PDFService] ${pdfType}: triggerDownload completed for ${filename}.`);

  } catch (error) {
    const errorMsg = `Error in generatePreAlertPdf function for ${filename}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[PDFService] ${pdfType}: ${errorMsg}`, error);
    alert(`Error creating ${pdfType} PDF for ${shipment.id}: ${errorMsg}`);
  }
};

export const generateCmrPdf = async (shipment: Shipment): Promise<void> => {
  const pdfType = "CMR";
  const filename = `cmr-${shipment.id || 'unknown'}.pdf`;
  console.log(`[PDFService] ${pdfType}: generateCmrPdf CALLED. Attempting to generate: ${filename}`);
  console.log(`[PDFService] ${pdfType} PDF: Full shipment data:`, JSON.stringify(shipment, null, 2));

  try {
    console.log(`[PDFService] ${pdfType}: Creating new jsPDF instance...`);
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    console.log(`[PDFService] ${pdfType}: jsPDF instance created successfully.`);

    const pageMargin = 15;
    let currentY;

    // 1. Add Asendia-style logo (top-left)
    addAsendiaStyleLogo(doc, pageMargin, pageMargin);

    // 2. Add title "CMR Document - Placeholder" (to the right of the logo)
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    // Position title: X starts after logo + a gap, Y is vertically aligned with logo's visual center or slightly below its top.
    // Logo width 35mm, pageMargin 15mm. Start title at X = 15 (margin) + 35 (logo) + 10 (gap) = 60mm.
    // Logo Y is 15, height 10. Center Y of logo is 20. Title baseline can be around 20-22mm.
    doc.text("CMR Document - Placeholder", 60, 22); // Adjusted X and Y

    // 3. Display Shipment ID and placeholder text (below logo/title area, left-aligned)
    // Start Y for this block well below the logo (height 10mm at Y=15) and title area.
    currentY = pageMargin + 10 + 10 + 5; // Approx. 15(margin) + 10(logo_h) + 10(space) + 5(extra_space) = 40mm
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Shipment ID: ${shipment.id || 'N/A'}`, pageMargin, currentY);
    currentY += 7; // Space after shipment ID

    doc.text("This is a placeholder for the CMR document content.", pageMargin, currentY);
    currentY += 7;
    doc.text("Detailed CMR fields will be added here based on specific requirements.", pageMargin, currentY);

    console.log(`[PDFService] ${pdfType}: Content added to PDF for placeholder CMR.`);
    triggerDownload(doc, filename, pdfType);
  } catch (error) {
    const errorMsg = `Error in generateCmrPdf function for ${filename}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[PDFService] ${pdfType}: ${errorMsg}`, error);
    alert(`Error creating ${pdfType} PDF for ${shipment.id}: ${errorMsg}`);
  }
};

