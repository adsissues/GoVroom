
"use client";

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Shipment, ShipmentDetail } from '@/lib/types';
import { db } from '@/lib/firebase/config';
import {
    collection,
    getDocs,
    query,
    type QueryDocumentSnapshot,
    type DocumentData,
    Timestamp,
    orderBy
} from 'firebase/firestore';
import { detailFromFirestore } from '@/lib/firebase/shipmentsService';
import { getDropdownOptionsMap } from '@/lib/firebase/dropdownService';
import { SERVICE_FORMAT_MAPPING, BAG_WEIGHT_MULTIPLIER } from '@/lib/constants';
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
      pdfDataUriLength > 100 && // Arbitrary length check
      pdfDataUri.startsWith('data:application/pdf;') && // Must start with this
      pdfDataUri.includes(';base64,'); // Must contain this segment

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
    console.error(`[PDFService] ${pdfType}: ${errorMsg}`, error);
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
  if (!map) return value; // Return the value itself if map is not available
  return map[value] || value; // Return value if not found in map, or the label
};

const addAsendiaStyleLogo = (doc: jsPDF, x: number, y: number) => {
    const logoWidth = 35; // mm
    const logoHeight = 10; // mm
    const text = "asendia";
    const textFontSize = 12; // Increased font size

    doc.setFillColor(0, 90, 106); // Dark Teal
    doc.rect(x, y, logoWidth, logoHeight, 'F');

    doc.setFontSize(textFontSize);
    doc.setFont('helvetica', 'normal'); // Using normal weight
    doc.setTextColor(255, 255, 255); // White text

    // Calculate text width for centering
    const textMetrics = doc.getTextDimensions(text, { fontSize: textFontSize });
    
    // Center horizontally
    const textX = x + (logoWidth - textMetrics.w) / 2;
    // Center vertically (adjusting baseline for better visual centering)
    const textY = y + (logoHeight / 2) + (textMetrics.h / 3.5); // Common adjustment for jsPDF text

    doc.text(text, textX, textY, { baseline: 'middle', align: 'left' }); // Use align: 'left' after calculating x, baseline 'middle'

    doc.setTextColor(0, 0, 0); // Reset text color
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
  const filename = `pre-alert-${shipment.id || 'shipment'}.pdf`;
  console.log(`[PDFService] ${pdfType} PDF: Full shipment data:`, JSON.stringify(shipment, null, 2));
  console.log(`[PDFService] ${pdfType}: generatePreAlertPdf CALLED. Attempting to generate: ${filename}`);

  try {
    console.log(`[PDFService] ${pdfType}: Creating new jsPDF instance...`);
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    console.log(`[PDFService] ${pdfType}: jsPDF instance created successfully.`);

    const details = await getShipmentDetails(shipment.id);
    console.log(`[PDFService] ${pdfType}: Fetched ${details.length} shipment details for table.`);

    const allFormatCollectionIds = Object.values(SERVICE_FORMAT_MAPPING).filter(Boolean) as string[];
    const dropdownCollectionNames = [...new Set(['carriers', 'subcarriers', 'customers', 'services', 'doe', ...allFormatCollectionIds])];
    const dropdownMaps = await getDropdownOptionsMap(dropdownCollectionNames);
    console.log(`[PDFService] ${pdfType}: Fetched dropdown maps for labels.`);

    const pageMargin = 10; // mm
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - 2 * pageMargin;
    let currentY = pageMargin;
    const lightYellowBg = [255, 253, 230]; // RGB for light yellow
    const cellPadding = 1.5; // mm
    const infoRowHeight = 10; // mm, increased to better accommodate two lines
    const infoBlockLabelFontSize = 6.5;
    const infoBlockValueFontSize = 8;

    // Header
    addAsendiaStyleLogo(doc, pageMargin, currentY);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("SHIPMENT REPORT / ASENDIA UK", pageWidth / 2, currentY + 5, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const departureDateText = `Date de départ: ${formatDateForPdf(shipment.departureDate)}`;
    const arrivalDateText = `Date d'arrivée: ${formatDateForPdf(shipment.arrivalDate)}`;
    const dateTextY = currentY + 3;
    const dateTextLineHeight = 4;
    const departureTextWidth = doc.getStringUnitWidth(departureDateText) * doc.getFontSize() / doc.internal.scaleFactor;
    const arrivalTextWidth = doc.getStringUnitWidth(arrivalDateText) * doc.getFontSize() / doc.internal.scaleFactor;
    const maxDateTextWidth = Math.max(departureTextWidth, arrivalTextWidth);

    doc.text(departureDateText, pageWidth - pageMargin - maxDateTextWidth, dateTextY);
    doc.text(arrivalDateText, pageWidth - pageMargin - maxDateTextWidth, dateTextY + dateTextLineHeight);
    
    currentY += 10 + 8; // Logo height + gap

    // Shipment Information Block (5 columns)
    const infoBlockLabels = ["Carrier", "Driver Name", "Truck Reg No", "Trailer Reg No", "Seal Number"];
    const infoBlockValues = [
      getLabelFromMap(dropdownMaps['carriers'], shipment.carrierId, shipment.carrierId),
      shipment.driverName || 'N/A',
      shipment.truckRegistration || 'N/A',
      shipment.trailerRegistration || 'N/A',
      shipment.sealNumber || 'N/A'
    ];
    const numInfoCells = infoBlockLabels.length;
    const infoCellWidth = contentWidth / numInfoCells;

    infoBlockLabels.forEach((label, index) => {
      const cellX = pageMargin + (index * infoCellWidth);
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
      doc.rect(cellX, currentY, infoCellWidth, infoRowHeight, 'FD'); // Draw cell border and fill
      
      doc.setFontSize(infoBlockLabelFontSize);
      doc.setFont('helvetica', 'normal'); // Labels are normal weight in sample
      const labelY = currentY + cellPadding + 1; // Position label near top
      doc.text(label, cellX + infoCellWidth / 2, labelY, { align: 'center', baseline: 'top', maxWidth: infoCellWidth - (2 * cellPadding) });
      
      doc.setFontSize(infoBlockValueFontSize);
      doc.setFont('helvetica', 'bold'); // Values are more prominent
      // Position value below the label, ensuring it's still within the cell height
      const valueY = labelY + infoBlockLabelFontSize * 0.35 + 1.5; // Adjust spacing as needed
      doc.text(infoBlockValues[index], cellX + infoCellWidth / 2, valueY, { align: 'center', baseline: 'top', maxWidth: infoCellWidth - (2 * cellPadding) });
    });
    currentY += infoRowHeight + 5; // Gap after this block

    // Totals Block (4 columns)
    const totalsBlockLabels = ["Total Pallets", "Total Bags", "Total Net Weight", "Total Gross Weight"];
    const totalsBlockValues = [
      (shipment.totalPallets || 0).toString(),
      (shipment.totalBags || 0).toString(),
      `${(shipment.totalNetWeight || 0).toFixed(2)} kg`,
      `${(shipment.totalGrossWeight || 0).toFixed(2)} kg`
    ];
    const numTotalCells = totalsBlockLabels.length;
    const totalsCellWidth = contentWidth / numTotalCells;

    totalsBlockLabels.forEach((label, index) => {
      const cellX = pageMargin + (index * totalsCellWidth);
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
      doc.rect(cellX, currentY, totalsCellWidth, infoRowHeight, 'FD');
      
      doc.setFontSize(infoBlockLabelFontSize);
      doc.setFont('helvetica', 'normal');
      const labelY = currentY + cellPadding + 1;
      doc.text(label, cellX + totalsCellWidth / 2, labelY, { align: 'center', baseline: 'top', maxWidth: totalsCellWidth - (2 * cellPadding) });
      
      doc.setFontSize(infoBlockValueFontSize);
      doc.setFont('helvetica', 'bold');
      const valueY = labelY + infoBlockLabelFontSize * 0.35 + 1.5;
      doc.text(totalsBlockValues[index], cellX + totalsCellWidth / 2, valueY, { align: 'center', baseline: 'top', maxWidth: totalsCellWidth - (2 * cellPadding) });
    });
    currentY += infoRowHeight + 5; // Gap

    // Service Type Header Block
    const serviceHeaderY = currentY;
    const serviceBoxHeight = 7; // mm
    
    const customerColWidth = 30; // Corresponds to autoTable colStyles[0]
    const dispatchNoColWidth = 20; // Corresponds to autoTable colStyles[1]
    const doeColWidth = 15;       // Corresponds to autoTable colStyles[2]
    const formatColumnWidth = 18; // Corresponds to autoTable colStyles[3,4,5]

    const hubTextWidth = customerColWidth + dispatchNoColWidth + doeColWidth;
    const hubText = "ROISSY HUB & Cellule S3C";
    doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
    doc.rect(pageMargin, serviceHeaderY, hubTextWidth, serviceBoxHeight, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0,0,0);
    doc.text(hubText, pageMargin + hubTextWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle', maxWidth: hubTextWidth - 2*cellPadding });

    const initialPrioBoxX = pageMargin + hubTextWidth;
    doc.setFillColor(0, 0, 255); // Blue for Prio
    doc.rect(initialPrioBoxX, serviceHeaderY, formatColumnWidth, serviceBoxHeight, 'FD');
    doc.setTextColor(255, 255, 255); // White text
    doc.text("Prio", initialPrioBoxX + formatColumnWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });

    const initialEcoBoxX = initialPrioBoxX + formatColumnWidth;
    doc.setFillColor(255, 255, 0); // Yellow for Eco
    doc.rect(initialEcoBoxX, serviceHeaderY, formatColumnWidth, serviceBoxHeight, 'FD');
    doc.setTextColor(0, 0, 0); // Black text
    doc.text("Eco", initialEcoBoxX + formatColumnWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });

    const initialS3CBoxX = initialEcoBoxX + formatColumnWidth;
    doc.setFillColor(230, 159, 0); // Orange/Dark Yellow for S3C
    doc.rect(initialS3CBoxX, serviceHeaderY, formatColumnWidth, serviceBoxHeight, 'FD');
    doc.setTextColor(0,0,0); // Black text for S3C as per sample
    doc.text("S3C", initialS3CBoxX + formatColumnWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });

    const weightKgTextX = initialS3CBoxX + formatColumnWidth;
    const weightKgTextBlockWidth = contentWidth - hubTextWidth - (formatColumnWidth * 3);
    const weightKgText = "Weight Kg";
    doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
    doc.rect(weightKgTextX, serviceHeaderY, weightKgTextBlockWidth, serviceBoxHeight, 'FD');
    doc.setTextColor(0,0,0);
    doc.text(weightKgText, weightKgTextX + weightKgTextBlockWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });
    currentY += serviceBoxHeight; // Advance Y after drawing this header row

    // Main Details Table
    const tableHeadData = [['Customer', 'Dispatch No', 'D-OE', 'Format', 'Format', 'Format', 'Tare Weight', 'Gross Weight', 'Net Weight']];
    const tableBodyData = details.map(detail => {
      const customerLabel = getLabelFromMap(dropdownMaps['customers'], detail.customerId, detail.customerId);
      const doeLabel = getLabelFromMap(dropdownMaps['doe'], detail.doeId, detail.doeId || 'N/A');
      let formatPrio = '', formatEco = '', formatS3C = '';
      const serviceKey = detail.serviceId?.toLowerCase();
      const mappedFormatCollection = serviceKey && SERVICE_FORMAT_MAPPING[serviceKey] ? SERVICE_FORMAT_MAPPING[serviceKey] : null;
      let formatLabel = detail.formatId || ''; // Show ID if no label
      if (mappedFormatCollection && detail.formatId) {
          formatLabel = getLabelFromMap(dropdownMaps[mappedFormatCollection], detail.formatId, detail.formatId);
      }

      // Determine which format column to populate
      if (serviceKey === 'e' || serviceKey === 'prior' || serviceKey === 'priority') { formatPrio = formatLabel; }
      else if (serviceKey === 'c' || serviceKey === 'eco' || serviceKey === 'economy') { formatEco = formatLabel; }
      else if (serviceKey === 's' || serviceKey === 's3c') { formatS3C = formatLabel; }

      return [
        customerLabel,
        detail.dispatchNumber || 'N/A',
        doeLabel,
        formatPrio,
        formatEco,
        formatS3C,
        (detail.tareWeight || 0).toFixed(2),
        (detail.grossWeight || 0).toFixed(2),
        (detail.netWeight || 0).toFixed(2),
      ];
    });
    
    console.log(`[PDFService] ${pdfType}: Table head:`, JSON.stringify(tableHeadData));
    console.log(`[PDFService] ${pdfType}: Table body (first item if any):`, details.length > 0 ? JSON.stringify(tableBodyData[0]) : "No details");

    const weightColWidth = (contentWidth - hubTextWidth - (formatColumnWidth * 3)) / 3;

    autoTable(doc, {
      head: tableHeadData,
      body: tableBodyData,
      startY: currentY,
      theme: 'plain', 
      styles: {
        fontSize: 8,
        cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 }, // Universal cell padding
        lineWidth: 0.1, 
        lineColor: [180,180,180], 
        textColor: [0,0,0], 
      },
      headStyles: {
        fillColor: lightYellowBg, 
        textColor: [0,0,0], 
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.1, 
        lineColor: [150,150,150], 
      },
      bodyStyles: { // Apply to all body cells
        fillColor: lightYellowBg, // Light yellow background for body cells
      },
      columnStyles: {
        0: { cellWidth: customerColWidth, halign: 'left' },   // Customer
        1: { cellWidth: dispatchNoColWidth, halign: 'center' }, // Dispatch No
        2: { cellWidth: doeColWidth, halign: 'center' },    // D-OE
        3: { cellWidth: formatColumnWidth, halign: 'center' }, // Format Prio
        4: { cellWidth: formatColumnWidth, halign: 'center' }, // Format Eco
        5: { cellWidth: formatColumnWidth, halign: 'center' }, // Format S3C
        6: { cellWidth: weightColWidth, halign: 'right' },  // Tare Weight
        7: { cellWidth: weightColWidth, halign: 'right' },  // Gross Weight
        8: { cellWidth: weightColWidth, halign: 'right' },  // Net Weight
      },
      margin: { left: pageMargin, right: pageMargin },
      didDrawPage: (dataArg: any) => { 
        // Redraw logo and header on new pages if table spans multiple pages
        if (dataArg.pageNumber > 1) { 
             addAsendiaStyleLogo(doc, pageMargin, pageMargin);
        }
      }
    });

    console.log(`[PDFService] ${pdfType}: Content (including table) added to PDF.`);
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
  const filename = `cmr-${shipment.id || 'shipment'}.pdf`;
  console.log(`[PDFService] ${pdfType} PDF: Full shipment data:`, JSON.stringify(shipment, null, 2));
  console.log(`[PDFService] ${pdfType}: generateCmrPdf CALLED. Attempting to generate: ${filename}`);

  try {
    console.log(`[PDFService] ${pdfType}: Creating new jsPDF instance...`);
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    console.log(`[PDFService] ${pdfType}: jsPDF instance created successfully.`);

    const dropdownMaps = await getDropdownOptionsMap(['carriers']);
    const carrierName = getLabelFromMap(dropdownMaps['carriers'], shipment.carrierId, shipment.carrierId);

    const pageMargin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - 2 * pageMargin;
    let currentY = pageMargin;

    // Helper to draw text box with better control
    const drawTextBox = (text: string | string[], x: number, y: number, width: number, height: number, options: any = {}) => {
      doc.rect(x, y, width, height); // Draw border
      const defaultOptions = { align: 'left', baseline: 'top', flags: {noBOM: true, autoencode: true} };
      const mergedOptions = {...defaultOptions, ...options};

      let textToPrint: string[] = [];
      if (Array.isArray(text)) {
        textToPrint = text.map(line => (typeof line === 'string' ? line : ''));
      } else {
        textToPrint = [typeof text === 'string' ? text : ''];
      }

      const lines: string[] = [];
      const originalFontSize = doc.getFontSize();
      const effectiveFontSize = options.fontSize || originalFontSize;
      doc.setFontSize(effectiveFontSize);

      textToPrint.forEach(line => {
          const currentLine = typeof line === 'string' ? line : '';
          const splitLines = doc.splitTextToSize(currentLine, width - 4); // 2mm padding on each side
          lines.push(...splitLines);
      });
      
      const originalFont = doc.getFont();
      if (options.fontStyle) doc.setFont(originalFont.fontName, options.fontStyle);
      
      const originalTextColorArray = doc.getTextColor(); // This is an array [r, g, b] or a single number
      if (options.textColor) {
        doc.setTextColor(options.textColor[0], options.textColor[1], options.textColor[2]);
      }

      const textYPos = y + 2 + (effectiveFontSize / 3.5); // Adjusted for better first line placement
      let textXPos = x + 2; // Default left alignment with padding

      if (mergedOptions.align === 'right') {
        textXPos = x + width - 2; // Right alignment with padding
      } else if (mergedOptions.align === 'center') {
        textXPos = x + width / 2; // Center alignment
      }
      
      doc.text(lines, textXPos, textYPos, mergedOptions);

      doc.setFontSize(originalFontSize);
      doc.setFont(originalFont.fontName, originalFont.fontStyle || 'normal');
      // Reset text color to what it was before this function call
      if (typeof originalTextColorArray === 'object' && originalTextColorArray !== null && 'r' in originalTextColorArray) { // For {r,g,b} object
        doc.setTextColor(originalTextColorArray.r, originalTextColorArray.g, originalTextColorArray.b);
      } else if (Array.isArray(originalTextColorArray)) { // For [r,g,b] array
         doc.setTextColor(originalTextColorArray[0], originalTextColorArray[1], originalTextColorArray[2]);
      } else { // For single number (grayscale)
         doc.setTextColor(originalTextColorArray);
      }
    };

    addAsendiaStyleLogo(doc, pageMargin, currentY);

    const crmLogoX = pageMargin + 35 + 2; // Spacing after Asendia logo
    const crmLogoRadius = 5;
    doc.setFillColor(200, 200, 200); // Light gray for CRM circle
    doc.circle(crmLogoX + crmLogoRadius, currentY + crmLogoRadius, crmLogoRadius, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0,0,0); // Black text for "CRM"
    doc.text("CRM", crmLogoX + crmLogoRadius, currentY + crmLogoRadius, { align: 'center', baseline: 'middle' });
    doc.setFont('helvetica', 'normal'); // Reset font style

    const titleX = crmLogoX + crmLogoRadius * 2 + 5; // Spacing after CRM logo
    doc.setFontSize(7);
    doc.text("LETTRE DE VOITURE INTERNATIONALE", titleX, currentY + 3);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text("INTERNATIONAL CONSIGNMENT NOTE", titleX, currentY + 8);
    doc.setFont('helvetica', 'normal'); // Reset font style
    currentY += 12; // Move Y down after header

    // Define column widths and X positions
    const col1Width = contentWidth * 0.5;
    const col2Width = contentWidth * 0.5;
    const col1X = pageMargin;
    const col2X = pageMargin + col1Width;

    // Box 1 & 2 & 3
    let boxHeight = 30;
    const senderText = `1 Sender (Name, Address, Country) Expéditeur (Nom, Adresse, Pays)\n\n${shipment.senderAddress || 'Asendia UK\nUnit 8-12 The Heathrow Estate\nSilver Jubilee way\nHounslow\nTW4 6NF'}`;
    drawTextBox(senderText, col1X, currentY, col1Width, boxHeight, {fontSize: 7});
    drawTextBox("2 Customs Reference/Status Ref douane/Statut\n\nN/A", col2X, currentY, col2Width, boxHeight / 2, {fontSize: 7});
    drawTextBox("3 Senders Agents Reference Ref expéditeur de l'agent\n\nN/A", col2X, currentY + boxHeight / 2, col2Width, boxHeight / 2, {fontSize: 7});
    currentY += boxHeight;

    // Box 4 & 5
    boxHeight = 30;
    const consigneeText = `4 Consignee, Final Delivery Point (Name, Address) Destinataire (Nom, Adresse, Pays)\n\n${shipment.consigneeAddress || 'LA POSTE ROISSY HUB\n7 Rue Du Haute de Laval\n93290 Tremblay-en-France\nFrance'}`;
    drawTextBox(consigneeText, col1X, currentY, col1Width, boxHeight, {fontSize: 7, fontStyle: 'bold'}); // Consignee bold as per sample
    const truckTrailer = `${shipment.truckRegistration || 'N/A'} / ${shipment.trailerRegistration || 'N/A'}`;
    const carrierText = `5 Carrier (Name, Address, Country) Transporteur (Nom, Adresse, Pays)\n\nCarrier Name: ${carrierName}\nTruck & Trailer: ${truckTrailer}`;
    drawTextBox(carrierText, col2X, currentY, col2Width, boxHeight, {fontSize: 7, textColor: [255,0,0], fontStyle: 'bold'}); // Red and bold
    currentY += boxHeight;

    // Box 6 & 7
    boxHeight = 20; // Adjusted height
    drawTextBox("6 Senders instructions for customs, etc... Instructions de l'expéditeur (optionel)\n\nN/A", col1X, currentY, col1Width, boxHeight, {fontSize: 7});
    drawTextBox("7 Successive Carrier Transporteurs successifs\n\nN/A", col2X, currentY, col2Width, boxHeight, {fontSize: 7});
    currentY += boxHeight;
    
    // Box 8
    boxHeight = 20; // Increased height for Box 8
    const dynamicTakingOverText = `${shipment.senderAddress || 'Asendia UK, Unit 5, The Hub, Solent Business Park, Fareham, PO15 7FH'}, UK ${formatDateForPdf(shipment.departureDate)}`;
    const takingOverGoodsTextLines = [
        `8 Place and date of taking over the goods (place, country, date)`,
        `Lieu et date de prise en charge des marchandises (lieu, pays, date)`,
        ``, // Empty line for spacing
        dynamicTakingOverText
    ];
    drawTextBox(takingOverGoodsTextLines, col1X, currentY, contentWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;


    // Box 9, 10, 11, 12 - Goods Details Header
    const goodsCol1Width = contentWidth * 0.4;
    const goodsCol2Width = contentWidth * 0.2;
    const goodsCol3Width = contentWidth * 0.2;
    const goodsCol4Width = contentWidth * 0.2;
    let goodsTableHeaderHeight = 10; // Height for this header row

    drawTextBox("9 Marks & Nos; No & Kind of Packages; Description of Goods\nMarques et Nos; Nb et nature des colis; Désignation des marchandises", col1X, currentY, goodsCol1Width, goodsTableHeaderHeight, {fontSize: 6});
    drawTextBox("10 No. of packages\n(statistical)", col1X + goodsCol1Width, currentY, goodsCol2Width, goodsTableHeaderHeight, {fontSize: 6});
    drawTextBox("11 Gross Weight (kg)\nPoids Brut (kg)", col1X + goodsCol1Width + goodsCol2Width, currentY, goodsCol3Width, goodsTableHeaderHeight, {fontSize: 6});
    drawTextBox("12 Volume (m³)\nCubage (m³)", col1X + goodsCol1Width + goodsCol2Width + goodsCol3Width, currentY, goodsCol4Width, goodsTableHeaderHeight, {fontSize: 6});
    currentY += goodsTableHeaderHeight;

    // Box 9, 10, 11, 12 - Goods Data
    const goodsDataHeight = 30; // Height for this data row
    let goodsDescTextLines = [
        `Pallets:        ${shipment.totalPallets || 0}`,
        `Sacks:          ${shipment.totalBags || 0}`, // Changed from Total Bags
        ``,
        `SEAL #1 Number:   ${shipment.sealNumber || 'N/A'}`,
        `SEAL #2 Number:   N/A`, // Placeholder as per sample
        ``,
        `Description of Goods: cross border eCommerce B2C parcels` // As per sample
    ];
    drawTextBox(goodsDescTextLines, col1X, currentY, goodsCol1Width, goodsDataHeight, {fontSize: 8, fontStyle: 'bold', textColor: [255,0,0]}); // Red and bold

    drawTextBox("", col1X + goodsCol1Width, currentY, goodsCol2Width, goodsDataHeight); // Box 10 data (empty in sample)

    // Box 11 Data - Gross Weight, Bag Weight, Total
    const grossWeightVal = shipment.totalGrossWeight || 0;
    const grossWeightOfBags = (shipment.totalBags || 0) * BAG_WEIGHT_MULTIPLIER; // Calculate gross weight of bags
    const totalCalculatedWeight = grossWeightVal + grossWeightOfBags; // As per new requirement

    console.log(`[PDFService] CMR: Box 11 - Data: grossWeightVal=${grossWeightVal.toFixed(2)}, grossWeightOfBags=${grossWeightOfBags.toFixed(2)}, totalCalculatedWeight=${totalCalculatedWeight.toFixed(2)}`);
    let weightTextLines = [
        `${grossWeightVal.toFixed(2)} Kgs`, // Gross weight of pallets/goods
        ``,
        `${grossWeightOfBags.toFixed(2)} Kgs`, // Gross Weight of Bags
        ``,
        ``,
        `TOTAL: ${totalCalculatedWeight.toFixed(2)} Kgs`
    ];
    drawTextBox(weightTextLines, col1X + goodsCol1Width + goodsCol2Width, currentY, goodsCol3Width, goodsDataHeight, {fontSize: 8, fontStyle: 'bold', textColor: [255,0,0], align: 'right'});

    drawTextBox("", col1X + goodsCol1Width + goodsCol2Width + goodsCol3Width, currentY, goodsCol4Width, goodsDataHeight); // Box 12 data (empty in sample)
    currentY += goodsDataHeight;

    // Box 13
    boxHeight = 7; // Single line height
    drawTextBox("13 Carriage Charges Prix de transport", col1X, currentY, contentWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    // Box 14 & 15
    const midPointXBox1415 = pageMargin + contentWidth * 0.6; // Adjusted split point
    const resWidth = midPointXBox1415 - pageMargin;
    const docAttachWidth = contentWidth - resWidth;
    boxHeight = 15;
    drawTextBox("14 Reservations Réserves", col1X, currentY, resWidth, boxHeight, {fontSize: 7});
    drawTextBox("15 Documents attached Documents Annexes (optional)", midPointXBox1415, currentY, docAttachWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    // Box 16
    boxHeight = 10;
    drawTextBox("16 Special agreements Conventions particulières (optional)", col1X, currentY, contentWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    // Box 17, 18, 19 - Signatures
    const sigBoxWidth = contentWidth / 3;
    boxHeight = 30; // Taller signature boxes

    // Box 17 - Goods Received
    const consigneeAddressFirstLine = (shipment.consigneeAddress || 'Consignee Address').split('\n')[0];
    const goodsReceivedText = `17 Goods Received/Marchandises Recues\n\n\n\nDate: ${formatDateForPdf(Timestamp.now())}\n${consigneeAddressFirstLine}`;
    drawTextBox(goodsReceivedText, col1X, currentY, sigBoxWidth, boxHeight, {fontSize: 7});

    // Box 18 - Carrier Signature
    drawTextBox("18 Signature and stamp of Carrier/Signature du Transporteur", col1X + sigBoxWidth, currentY, sigBoxWidth, boxHeight, {fontSize: 7});

    // Box 19 - Sender/Agent Signature
    drawTextBox("19 Place and date, Signature Lieu et date, Signature", col1X + sigBoxWidth * 2, currentY, sigBoxWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    // Bottom Date Lines
    currentY += 2; // Small gap
    doc.setFontSize(7);
    doc.text(`Date: ${formatDateForPdf(Timestamp.now())}`, pageMargin + 5, currentY + 5); // Under Box 17
    doc.text(`Date: ${formatDateForPdf(Timestamp.now())}`, pageMargin + sigBoxWidth + 5, currentY + 5); // Under Box 18
    doc.text(`Date: __ / __ / __`, pageMargin + sigBoxWidth * 2 + 5, currentY + 5); // Under Box 19


    console.log(`[PDFService] ${pdfType}: Content added to PDF.`);
    triggerDownload(doc, filename, pdfType);
    console.log(`[PDFService] ${pdfType}: triggerDownload completed for ${filename}.`);

  } catch (error) {
    const errorMsg = `Error in generateCmrPdf function for ${filename}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[PDFService] ${pdfType}: ${errorMsg}`, error);
    alert(`Error creating ${pdfType} PDF for ${shipment.id}: ${errorMsg}`);
  }
};

    