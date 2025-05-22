
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

    // Updated validation to be more flexible with media type parameters like 'filename='
    const isValidBase64PdfDataUri =
      pdfDataUriType === 'string' &&
      pdfDataUriLength > 100 && // Arbitrary length check, ensure it's not trivially small
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
  if (!map) return value; // Return the value itself if no map is found
  return map[value] || value; // Return value if not found in map
};

const addAsendiaStyleLogo = (doc: jsPDF, x: number, y: number) => {
    const logoWidth = 35; // mm
    const logoHeight = 10; // mm
    const text = "asendia";
    const textFontSize = 12; // Increased font size

    doc.setFillColor(0, 90, 106); // Dark Teal
    doc.rect(x, y, logoWidth, logoHeight, 'F');

    doc.setFontSize(textFontSize);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255); // White text

    // For horizontal centering with 'align: center' option
    const textX = x + logoWidth / 2;
    // For vertical centering with 'baseline: middle' option
    const textY = y + logoHeight / 2;

    doc.text(text, textX, textY, { baseline: 'middle', align: 'center' });

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

    const pageMargin = 10; // Reduced margin
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - 2 * pageMargin;
    let currentY = pageMargin;
    const lightYellowBg = [255, 253, 230]; // RGB for light yellow
    const infoRowHeight = 7; // Height for info block rows
    const cellPadding = 2; // General padding for text within cells

    // Header
    addAsendiaStyleLogo(doc, pageMargin, currentY);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("SHIPMENT REPORT / ASENDIA UK", pageWidth / 2, currentY + 5, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const departureDateText = `Date de départ: ${formatDateForPdf(shipment.departureDate)}`;
    const arrivalDateText = `Date d'arrivée: ${formatDateForPdf(shipment.arrivalDate)}`;
    const dateTextWidth = Math.max(doc.getStringUnitWidth(departureDateText) * doc.getFontSize() / doc.internal.scaleFactor, doc.getStringUnitWidth(arrivalDateText) * doc.getFontSize() / doc.internal.scaleFactor);
    doc.text(departureDateText, pageWidth - pageMargin - dateTextWidth, currentY + 3);
    doc.text(arrivalDateText, pageWidth - pageMargin - dateTextWidth, currentY + 7);

    currentY += 10 + 5; // Move Y down after header (logo height + small gap)

    // Shipment Information Block (5 columns)
    const infoBlockLabels = ["Transporteur", "Driver Name", "Truck Reg No", "Trailer Reg No", "Seal Number"];
    const infoBlockValues = [
      getLabelFromMap(dropdownMaps['carriers'], shipment.carrierId, shipment.carrierId),
      shipment.driverName || 'N/A',
      shipment.truckRegistration || 'N/A',
      shipment.trailerRegistration || 'N/A',
      shipment.sealNumber || 'N/A'
    ];
    const infoCellWidth = contentWidth / infoBlockLabels.length;

    infoBlockLabels.forEach((label, index) => {
      const cellX = pageMargin + (index * infoCellWidth);
      // Label part (top half of the cell)
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
      doc.rect(cellX, currentY, infoCellWidth, infoRowHeight, 'FD'); // Draw cell
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(label, cellX + infoCellWidth / 2, currentY + cellPadding + 1, { align: 'center', baseline: 'top' }); // Adjusted Y for top alignment

      // Value part (bottom half of the cell)
      doc.setFont('helvetica', 'normal');
      doc.text(infoBlockValues[index], cellX + infoCellWidth / 2, currentY + infoRowHeight - cellPadding, { align: 'center', baseline: 'bottom' }); // Adjusted Y for bottom alignment
    });
    currentY += infoRowHeight + 5; // Move Y down

    // Totals Block (4 columns)
    const totalsBlockLabels = ["Total Pallets", "Total Bags", "Total Net Weight", "Total Gross Weight"];
    const totalsBlockValues = [
      (shipment.totalPallets || 0).toString(),
      (shipment.totalBags || 0).toString(),
      `${(shipment.totalNetWeight || 0).toFixed(2)} kg`,
      `${(shipment.totalGrossWeight || 0).toFixed(2)} kg`
    ];
    const totalsCellWidth = contentWidth / totalsBlockLabels.length;

    totalsBlockLabels.forEach((label, index) => {
      const cellX = pageMargin + (index * totalsCellWidth);
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
      doc.rect(cellX, currentY, totalsCellWidth, infoRowHeight, 'FD');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(label, cellX + totalsCellWidth / 2, currentY + cellPadding + 1, { align: 'center', baseline: 'top' });
      doc.setFont('helvetica', 'normal');
      doc.text(totalsBlockValues[index], cellX + totalsCellWidth / 2, currentY + infoRowHeight - cellPadding, { align: 'center', baseline: 'bottom' });
    });
    currentY += infoRowHeight + 5;

    // Service Type Header Block
    const serviceHeaderY = currentY;
    const serviceBoxHeight = 7; // Height of the colored boxes and the "ROISSY HUB" box

    // Define column widths based on autoTable for alignment
    const customerColWidth = 30; // As per autoTable columnStyles
    const dispatchNoColWidth = 20;
    const doeColWidth = 15;
    const formatColumnWidth = 18; // For Prio, Eco, S3C headers to match table

    const hubTextWidth = customerColWidth + dispatchNoColWidth + doeColWidth; // Width for "ROISSY HUB"
    const hubText = "ROISSY HUB & Cellule S3C";
    doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
    doc.rect(pageMargin, serviceHeaderY, hubTextWidth, serviceBoxHeight, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0,0,0);
    doc.text(hubText, pageMargin + hubTextWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });

    const initialPrioBoxX = pageMargin + hubTextWidth;
    doc.setFillColor(0, 0, 255); // Blue for Prio
    doc.rect(initialPrioBoxX, serviceHeaderY, formatColumnWidth, serviceBoxHeight, 'FD');
    doc.setTextColor(255, 255, 255); // White text
    doc.text("Prio", initialPrioBoxX + formatColumnWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });

    doc.setFillColor(255, 255, 0); // Yellow for Eco
    doc.rect(initialPrioBoxX + formatColumnWidth, serviceHeaderY, formatColumnWidth, serviceBoxHeight, 'FD');
    doc.setTextColor(0, 0, 0); // Black text
    doc.text("Eco", initialPrioBoxX + formatColumnWidth * 1 + formatColumnWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });

    doc.setFillColor(230, 159, 0); // Dark Yellow/Orange for S3C
    doc.rect(initialPrioBoxX + formatColumnWidth * 2, serviceHeaderY, formatColumnWidth, serviceBoxHeight, 'FD');
    doc.setTextColor(0, 0, 0); // Black text
    doc.text("S3C", initialPrioBoxX + formatColumnWidth * 2 + formatColumnWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });

    // "Weight Kg" text to the right
    const weightKgTextX = initialPrioBoxX + formatColumnWidth * 3;
    const weightKgTextBlockWidth = contentWidth - hubTextWidth - (formatColumnWidth * 3); // Remaining width
    const weightKgText = "Weight Kg";
    doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
    doc.rect(weightKgTextX, serviceHeaderY, weightKgTextBlockWidth, serviceBoxHeight, 'FD');
    doc.setTextColor(0, 0, 0);
    doc.text(weightKgText, weightKgTextX + weightKgTextBlockWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });

    currentY += serviceBoxHeight; // Move Y for the table start

    // Main Details Table
    const tableHeadData = [['Customer', 'Dispatch No', 'D-OE', 'Format', 'Format', 'Format', 'Tare Weight', 'Gross Weight', 'Net Weight']];
    const tableBodyData = details.map(detail => {
      const customerLabel = getLabelFromMap(dropdownMaps['customers'], detail.customerId, detail.customerId);
      const doeLabel = getLabelFromMap(dropdownMaps['doe'], detail.doeId, detail.doeId || 'N/A');

      let formatPrio = '', formatEco = '', formatS3C = '';
      const serviceKey = detail.serviceId?.toLowerCase();
      const mappedFormatCollection = serviceKey && SERVICE_FORMAT_MAPPING[serviceKey] ? SERVICE_FORMAT_MAPPING[serviceKey] : null;
      let formatLabel = detail.formatId || '';
      if (mappedFormatCollection && detail.formatId) {
          formatLabel = getLabelFromMap(dropdownMaps[mappedFormatCollection], detail.formatId, detail.formatId);
      }

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
      theme: 'plain', // Using 'plain' and defining all lines for consistency
      styles: {
        fontSize: 8,
        cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
        lineWidth: 0.1, // Thin lines for all cells
        lineColor: [180,180,180], // Gray lines
        textColor: [0,0,0], // Black text for body
      },
      headStyles: {
        fillColor: lightYellowBg, // Light yellow for header background
        textColor: [0,0,0], // Black text for header
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.1, // Ensure header cells also have lines
        lineColor: [150,150,150], // Slightly darker gray for header lines
      },
      bodyStyles: {
        fillColor: lightYellowBg, // Light yellow for body background
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
      didDrawPage: (dataArg: any) => { // Renamed data to dataArg to avoid conflict
        if (dataArg.pageNumber > 1) { // Use dataArg
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

    // Helper function to draw text within a box, with basic word wrapping
    const drawTextBox = (text: string | string[], x: number, y: number, width: number, height: number, options: any = {}) => {
      doc.rect(x, y, width, height); // Draw the box outline
      const defaultOptions = { align: 'left', baseline: 'top', flags: {noBOM: true, autoencode: true} };
      const mergedOptions = {...defaultOptions, ...options};

      // Ensure text is an array of strings
      let textToPrint: string[] = [];
      if (Array.isArray(text)) {
        textToPrint = text.map(line => (typeof line === 'string' ? line : ''));
      } else {
        textToPrint = [typeof text === 'string' ? text : ''];
      }

      const lines: string[] = [];
      const originalFontSize = doc.getFontSize();
      const effectiveFontSize = options.fontSize || originalFontSize; // Use option's font size or current
      doc.setFontSize(effectiveFontSize);

      textToPrint.forEach(line => {
          const currentLine = typeof line === 'string' ? line : ''; // Ensure it's a string
          const splitLines = doc.splitTextToSize(currentLine, width - 4); // 2mm padding on each side
          lines.push(...splitLines);
      });
      
      const originalFont = doc.getFont();
      if (options.fontStyle) doc.setFont(originalFont.fontName, options.fontStyle);
      
      const originalTextColor = doc.getTextColor(); // Save current text color
      if (options.textColor) doc.setTextColor(options.textColor[0], options.textColor[1], options.textColor[2]);

      // Calculate Y position for text
      const textYPos = y + 2 + (effectiveFontSize / 3.5); // Adjust textY for padding and baseline
      let textXPos = x + 2; // Adjust textX for padding

      if (mergedOptions.align === 'right') {
        textXPos = x + width - 2; // Adjust for right alignment
      } else if (mergedOptions.align === 'center') {
        textXPos = x + width / 2; // Center alignment
      }
      
      doc.text(lines, textXPos, textYPos, mergedOptions);

      // Restore original font settings
      doc.setFontSize(originalFontSize);
      doc.setFont(originalFont.fontName, originalFont.fontStyle || 'normal'); // Restore font style
      doc.setTextColor(originalTextColor); // Restore original text color
    };

    // 1. Header
    addAsendiaStyleLogo(doc, pageMargin, currentY);

    // CRM Logo
    const crmLogoX = pageMargin + 35 + 2; // Position next to Asendia logo
    const crmLogoRadius = 5;
    doc.setFillColor(200, 200, 200); // Light gray for CRM circle
    doc.circle(crmLogoX + crmLogoRadius, currentY + crmLogoRadius, crmLogoRadius, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0,0,0); // Black text for CRM
    doc.text("CRM", crmLogoX + crmLogoRadius, currentY + crmLogoRadius, { align: 'center', baseline: 'middle' });
    doc.setFont('helvetica', 'normal'); // Reset font

    // Titles
    const titleX = crmLogoX + crmLogoRadius * 2 + 5;
    doc.setFontSize(7);
    doc.text("LETTRE DE VOITURE INTERNATIONALE", titleX, currentY + 3);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text("INTERNATIONAL CONSIGNMENT NOTE", titleX, currentY + 8);
    doc.setFont('helvetica', 'normal'); // Reset font
    currentY += 12; // Move down after header

    // 2. Grid Boxes
    const col1Width = contentWidth * 0.5;
    const col2Width = contentWidth * 0.5;
    const col1X = pageMargin;
    const col2X = pageMargin + col1Width;

    // Box 1, 2, 3
    let boxHeight = 30;
    const senderText = `1 Sender (Name, Address, Country) Expéditeur (Nom, Adresse, Pays)\n\n${shipment.senderAddress || 'Asendia UK\nUnit 8-12 The Heathrow Estate\nSilver Jubilee way\nHounslow\nTW4 6NF'}`;
    drawTextBox(senderText, col1X, currentY, col1Width, boxHeight, {fontSize: 7});
    drawTextBox("2 Customs Reference/Status Ref douane/Statut\n\nN/A", col2X, currentY, col2Width, boxHeight / 2, {fontSize: 7});
    drawTextBox("3 Senders Agents Reference Ref expéditeur de l'agent\n\nN/A", col2X, currentY + boxHeight / 2, col2Width, boxHeight / 2, {fontSize: 7});
    currentY += boxHeight;

    // Box 4, 5
    boxHeight = 30;
    const consigneeText = `4 Consignee, Final Delivery Point (Name, Address) Destinataire (Nom, Adresse, Pays)\n\n${shipment.consigneeAddress || 'LA POSTE ROISSY HUB\n7 Rue Du Haute de Laval\n93290 Tremblay-en-France\nFrance'}`;
    drawTextBox(consigneeText, col1X, currentY, col1Width, boxHeight, {fontSize: 7, fontStyle: 'bold'});
    const truckTrailer = `${shipment.truckRegistration || 'N/A'} / ${shipment.trailerRegistration || 'N/A'}`;
    const carrierText = `5 Carrier (Name, Address, Country) Transporteur (Nom, Adresse, Pays)\n\nCarrier Name: ${carrierName}\nTruck & Trailer: ${truckTrailer}`;
    drawTextBox(carrierText, col2X, currentY, col2Width, boxHeight, {fontSize: 7, textColor: [255,0,0], fontStyle: 'bold'});
    currentY += boxHeight;

    // Box 6, 7
    boxHeight = 20; // Adjusted height
    drawTextBox("6 Senders instructions for customs, etc... Instructions de l'expéditeur (optionel)\n\nN/A", col1X, currentY, col1Width, boxHeight, {fontSize: 7});
    drawTextBox("7 Successive Carrier Transporteurs successifs\n\nN/A", col2X, currentY, col2Width, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    // Box 8
    boxHeight = 20; // Adjusted height
    const dynamicTakingOverText = `${shipment.senderAddress || 'Asendia UK, Unit 5, The Hub, Solent Business Park, Fareham, PO15 7FH'}, UK ${formatDateForPdf(shipment.departureDate)}`;
    const takingOverGoodsTextLines = [
        `8 Place and date of taking over the goods (place, country, date)`,
        `Lieu et date de prise en charge des marchandises (lieu, pays, date)`,
        ``, // Empty line for spacing
        dynamicTakingOverText
    ];
    drawTextBox(takingOverGoodsTextLines, col1X, currentY, contentWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;


    // Box 9, 10, 11, 12 - Headers
    const goodsCol1Width = contentWidth * 0.4;
    const goodsCol2Width = contentWidth * 0.2;
    const goodsCol3Width = contentWidth * 0.2;
    const goodsCol4Width = contentWidth * 0.2;
    let goodsTableHeaderHeight = 10;

    drawTextBox("9 Marks & Nos; No & Kind of Packages; Description of Goods\nMarques et Nos; Nb et nature des colis; Désignation des marchandises", col1X, currentY, goodsCol1Width, goodsTableHeaderHeight, {fontSize: 6});
    drawTextBox("10 No. of packages\n(statistical)", col1X + goodsCol1Width, currentY, goodsCol2Width, goodsTableHeaderHeight, {fontSize: 6});
    drawTextBox("11 Gross Weight (kg)\nPoids Brut (kg)", col1X + goodsCol1Width + goodsCol2Width, currentY, goodsCol3Width, goodsTableHeaderHeight, {fontSize: 6});
    drawTextBox("12 Volume (m³)\nCubage (m³)", col1X + goodsCol1Width + goodsCol2Width + goodsCol3Width, currentY, goodsCol4Width, goodsTableHeaderHeight, {fontSize: 6});
    currentY += goodsTableHeaderHeight;

    // Box 9, 10, 11, 12 - Data
    const goodsDataHeight = 30;
    let goodsDescTextLines = [
        `Pallets:        ${shipment.totalPallets || 0}`,
        `Sacks:          ${shipment.totalBags || 0}`, // Using totalBags from shipment
        ``,
        `SEAL #1 Number:   ${shipment.sealNumber || 'N/A'}`,
        `SEAL #2 Number:   N/A`, // Assuming no second seal number
        ``,
        `Description of Goods: cross border eCommerce B2C parcels`
    ];
    drawTextBox(goodsDescTextLines, col1X, currentY, goodsCol1Width, goodsDataHeight, {fontSize: 8, fontStyle: 'bold', textColor: [255,0,0]});

    drawTextBox("", col1X + goodsCol1Width, currentY, goodsCol2Width, goodsDataHeight); // Empty box 10 data

    // For Box 11
    const grossWeightVal = shipment.totalGrossWeight || 0;
    const grossWeightOfBags = (shipment.totalBags || 0) * BAG_WEIGHT_MULTIPLIER;
    const totalCalculatedWeight = grossWeightVal + grossWeightOfBags; // Sum of pallet gross and empty bag weight

    console.log(`[PDFService] CMR: Box 11 - Data: grossWeightVal=${grossWeightVal.toFixed(2)}, grossWeightOfBags=${grossWeightOfBags.toFixed(2)}, totalCalculatedWeight=${totalCalculatedWeight.toFixed(2)}`);
    let weightTextLines = [
        `${grossWeightVal.toFixed(2)} Kgs`, // Gross Weight of the Pallets
        ``,
        `${grossWeightOfBags.toFixed(2)} Kgs`, // Gross Weight of the Bags
        ``,
        ``,
        `TOTAL: ${totalCalculatedWeight.toFixed(2)} Kgs`
    ];
    drawTextBox(weightTextLines, col1X + goodsCol1Width + goodsCol2Width, currentY, goodsCol3Width, goodsDataHeight, {fontSize: 8, fontStyle: 'bold', textColor: [255,0,0], align: 'right'});

    drawTextBox("", col1X + goodsCol1Width + goodsCol2Width + goodsCol3Width, currentY, goodsCol4Width, goodsDataHeight); // Empty box 12 data
    currentY += goodsDataHeight;


    // Box 13
    boxHeight = 7;
    drawTextBox("13 Carriage Charges Prix de transport", col1X, currentY, contentWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    // Box 14, 15
    const midPointXBox1415 = pageMargin + contentWidth * 0.6; // Example split point
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
    boxHeight = 30;

    const consigneeAddressFirstLine = (shipment.consigneeAddress || 'Consignee Address').split('\n')[0];
    const goodsReceivedText = `17 Goods Received/Marchandises Recues\n\n\n\nDate: ${formatDateForPdf(Timestamp.now())}\n${consigneeAddressFirstLine}`;
    drawTextBox(goodsReceivedText, col1X, currentY, sigBoxWidth, boxHeight, {fontSize: 7});

    drawTextBox("18 Signature and stamp of Carrier/Signature du Transporteur", col1X + sigBoxWidth, currentY, sigBoxWidth, boxHeight, {fontSize: 7});
    drawTextBox("19 Place and date, Signature Lieu et date, Signature", col1X + sigBoxWidth * 2, currentY, sigBoxWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    // Dates below signature boxes
    currentY += 2; // Small gap
    doc.setFontSize(7);
    doc.text(`Date: ${formatDateForPdf(Timestamp.now())}`, pageMargin + 5, currentY + 5); // Under box 17
    doc.text(`Date: ${formatDateForPdf(Timestamp.now())}`, pageMargin + sigBoxWidth + 5, currentY + 5); // Under box 18
    doc.text(`Date: __ / __ / __`, pageMargin + sigBoxWidth * 2 + 5, currentY + 5); // Under box 19


    console.log(`[PDFService] ${pdfType}: Content added to PDF.`);
    triggerDownload(doc, filename, pdfType);
    console.log(`[PDFService] ${pdfType}: triggerDownload completed for ${filename}.`);

  } catch (error) {
    const errorMsg = `Error in generateCmrPdf function for ${filename}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[PDFService] ${pdfType}: ${errorMsg}`, error);
    alert(`Error creating ${pdfType} PDF for ${shipment.id}: ${errorMsg}`);
  }
};

    