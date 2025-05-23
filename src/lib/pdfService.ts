
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
import { format as formatDateFns } from 'date-fns';

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
      pdfDataUri.startsWith('data:application/pdf;') &&
      pdfDataUri.includes(';base64,');

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
    return formatDateFns(timestamp.toDate(), 'dd/MM/yyyy');
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
    const textFontSize = 12; // Increased font size

    doc.setFillColor(0, 90, 106); // Dark Teal
    doc.rect(x, y, logoWidth, logoHeight, 'F');

    doc.setFontSize(textFontSize);
    doc.setFont('helvetica', 'normal'); // Using normal weight as per visual preference
    doc.setTextColor(255, 255, 255); // White text

    const textMetrics = doc.getTextDimensions(text, { fontSize: textFontSize });
    
    // Calculate X for horizontal centering
    const textX = x + (logoWidth - textMetrics.w) / 2;
    // Calculate Y for vertical centering (adjusting for baseline)
    const textY = y + (logoHeight / 2) + (textMetrics.h / 3.5); // Common adjustment for jsPDF text

    doc.text(text, textX, textY, { baseline: 'middle', align: 'left' }); // Use align: 'left' with calculated textX

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

  const now = new Date();
  const formattedDateForFilename = formatDateFns(now, "dd-MM-yy");
  const formattedTimeForFilename = formatDateFns(now, "HHmmss");
  const sealNumberForFilename = shipment.sealNumber || "NoSeal";
  const filename = `Pre-Alert, ${sealNumberForFilename}, ${formattedDateForFilename}, ${formattedTimeForFilename}.pdf`;

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

    const pageMargin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - 2 * pageMargin;
    let currentY = pageMargin;
    const lightYellowBg = [255, 253, 230]; 
    const cellPadding = 1.5; 
    const infoRowHeight = 10; // Adjusted for two lines
    const infoBlockLabelFontSize = 6.5;
    const infoBlockValueFontSize = 8;


    // Header: Logo, Title, Dates
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
    
    currentY += 10 + 8; // Space after logo/main title block (10 for logo height, 8 for spacing)

    // Shipment Information Block
    const infoBlockDetails = [
      { label: "Transporteur", value: getLabelFromMap(dropdownMaps['carriers'], shipment.carrierId, shipment.carrierId) },
      { label: "Driver Name", value: shipment.driverName || 'N/A' },
      { label: "Truck Reg No", value: shipment.truckRegistration || 'N/A' },
      { label: "Trailer Reg No", value: shipment.trailerRegistration || 'N/A' },
      { label: "Seal Number", value: shipment.sealNumber || 'N/A' }
    ];
    const numInfoCells = infoBlockDetails.length;
    const infoCellWidth = contentWidth / numInfoCells;

    infoBlockDetails.forEach((item, index) => {
      const cellX = pageMargin + (index * infoCellWidth);
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
      doc.rect(cellX, currentY, infoCellWidth, infoRowHeight, 'FD'); // Fill and draw border
      
      doc.setFontSize(infoBlockLabelFontSize);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0,0,0); // Black text
      const labelY = currentY + cellPadding + 1; // Position label slightly from top
      doc.text(item.label, cellX + infoCellWidth / 2, labelY, { align: 'center', baseline: 'top', maxWidth: infoCellWidth - (2 * cellPadding) });
      
      doc.setFontSize(infoBlockValueFontSize);
      doc.setFont('helvetica', 'bold'); // Bold for value
      const valueY = labelY + infoBlockLabelFontSize * 0.35 + 1.5; // Position value below label
      doc.text(item.value, cellX + infoCellWidth / 2, valueY, { align: 'center', baseline: 'top', maxWidth: infoCellWidth - (2 * cellPadding) });
    });
    currentY += infoRowHeight + 5; // Space after info block

    // Totals Block
    const totalsBlockDetails = [
      { label: "Total Pallets", value: (shipment.totalPallets || 0).toString() },
      { label: "Total Bags", value: (shipment.totalBags || 0).toString() },
      { label: "Total Net Weight", value: `${(shipment.totalNetWeight || 0).toFixed(2)} kg` },
      { label: "Total Gross Weight", value: `${(shipment.totalGrossWeight || 0).toFixed(2)} kg` }
    ];
    const numTotalCells = totalsBlockDetails.length;
    const totalsCellWidth = contentWidth / numTotalCells;

    totalsBlockDetails.forEach((item, index) => {
      const cellX = pageMargin + (index * totalsCellWidth);
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
      doc.rect(cellX, currentY, totalsCellWidth, infoRowHeight, 'FD');
      
      doc.setFontSize(infoBlockLabelFontSize);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0,0,0);
      const labelY = currentY + cellPadding + 1;
      doc.text(item.label, cellX + totalsCellWidth / 2, labelY, { align: 'center', baseline: 'top', maxWidth: totalsCellWidth - (2 * cellPadding) });
      
      doc.setFontSize(infoBlockValueFontSize);
      doc.setFont('helvetica', 'bold');
      const valueY = labelY + infoBlockLabelFontSize * 0.35 + 1.5;
      doc.text(item.value, cellX + totalsCellWidth / 2, valueY, { align: 'center', baseline: 'top', maxWidth: totalsCellWidth - (2 * cellPadding) });
    });
    currentY += infoRowHeight + 5; // Space after totals block

    // --- Service Type Header Block ---
    const serviceHeaderY = currentY;
    const serviceBoxHeight = 7; // Height for the colored boxes and text
    
    // Define column widths based on autoTable for precise alignment
    const customerColWidth = 30; 
    const dispatchNoColWidth = 20; 
    const doeColWidth = 15;      
    const formatColumnWidth = 18; 
    
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
    doc.setTextColor(0,0,0); 
    doc.text("S3C", initialS3CBoxX + formatColumnWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });

    const weightKgTextX = initialS3CBoxX + formatColumnWidth;
    const weightKgTextBlockWidth = contentWidth - hubTextWidth - (formatColumnWidth * 3);
    const weightKgText = "Weight Kg";
    doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
    doc.rect(weightKgTextX, serviceHeaderY, weightKgTextBlockWidth, serviceBoxHeight, 'FD');
    doc.setTextColor(0,0,0);
    doc.text(weightKgText, weightKgTextX + weightKgTextBlockWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });
    currentY += serviceBoxHeight; // Move Y down after drawing this header row

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
      theme: 'plain', 
      styles: {
        fontSize: 8,
        cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 }, 
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
      bodyStyles: { 
        fillColor: lightYellowBg,
        halign: 'center', 
      },
      columnStyles: {
        0: { cellWidth: customerColWidth, halign: 'left' },  // Customer
        1: { cellWidth: dispatchNoColWidth, halign: 'center' }, // Dispatch No
        2: { cellWidth: doeColWidth, halign: 'center' },    // D-OE
        3: { cellWidth: formatColumnWidth, halign: 'center' }, // Format Prio
        4: { cellWidth: formatColumnWidth, halign: 'center' }, // Format Eco
        5: { cellWidth: formatColumnWidth, halign: 'center' }, // Format S3C
        6: { cellWidth: weightColWidth, halign: 'right' },  // Tare Weight
        7: { cellWidth: weightColWidth, halign: 'right' }, // Gross Weight
        8: { cellWidth: weightColWidth, halign: 'right' },  // Net Weight
      },
      margin: { left: pageMargin, right: pageMargin },
      didDrawPage: (data: any) => { 
        if (data.pageNumber > 1) { 
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
  
  const now = new Date();
  const formattedDateForFilename = formatDateFns(now, "dd-MM-yy");
  const formattedTimeForFilename = formatDateFns(now, "HHmmss");
  const sealNumberForFilename = shipment.sealNumber || "NoSeal";
  const filename = `CMR, ${sealNumberForFilename}, ${formattedDateForFilename}, ${formattedTimeForFilename}.pdf`;

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

    const drawTextBox = (text: string | string[], x: number, y: number, width: number, height: number, options: any = {}) => {
      doc.rect(x, y, width, height);
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
      if (options.fontSize) doc.setFontSize(options.fontSize);

      textToPrint.forEach(line => {
          const currentLine = typeof line === 'string' ? line : ''; 
          const splitLines = doc.splitTextToSize(currentLine, width - 4); 
          lines.push(...splitLines);
      });
      
      const originalFont = doc.getFont(); 
      if (options.fontStyle) doc.setFont(originalFont.fontName, options.fontStyle); 
      
      const originalTextColorArray = doc.getTextColor();
      let tempTextColor: string | number | number[] = originalTextColorArray; // Store it to restore

      if (options.textColor) {
        if (Array.isArray(options.textColor) && options.textColor.length === 3) {
          doc.setTextColor(options.textColor[0], options.textColor[1], options.textColor[2]);
        } else if (typeof options.textColor === 'string' || typeof options.textColor === 'number') {
          doc.setTextColor(options.textColor);
        }
      }

      const textYOffset = options.fontSize ? options.fontSize / 3.5 : 3;
      let textX = x + 2;

      if (mergedOptions.align === 'right') {
        textX = x + width - 2;
      } else if (mergedOptions.align === 'center') {
        textX = x + width / 2;
      }

      doc.text(lines, textX, y + 2 + textYOffset, mergedOptions);

      doc.setFontSize(originalFontSize);
      doc.setFont(originalFont.fontName, originalFont.fontStyle || 'normal');
      
      if (typeof tempTextColor === 'string' || typeof tempTextColor === 'number') {
        doc.setTextColor(tempTextColor);
      } else if (Array.isArray(tempTextColor) && tempTextColor.length === 3) {
        doc.setTextColor(tempTextColor[0], tempTextColor[1], tempTextColor[2]);
      } else {
        doc.setTextColor(0,0,0); // Fallback to black
      }
    };

    addAsendiaStyleLogo(doc, pageMargin, currentY);

    const crmLogoX = pageMargin + 35 + 2;
    const crmLogoRadius = 5;
    doc.setFillColor(200, 200, 200);
    doc.circle(crmLogoX + crmLogoRadius, currentY + crmLogoRadius, crmLogoRadius, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0,0,0);
    doc.text("CRM", crmLogoX + crmLogoRadius, currentY + crmLogoRadius, { align: 'center', baseline: 'middle' });
    doc.setFont('helvetica', 'normal');

    const titleX = crmLogoX + crmLogoRadius * 2 + 5;
    doc.setFontSize(7);
    doc.text("LETTRE DE VOITURE INTERNATIONALE", titleX, currentY + 3);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text("INTERNATIONAL CONSIGNMENT NOTE", titleX, currentY + 8);
    doc.setFont('helvetica', 'normal');
    currentY += 12;

    const col1Width = contentWidth * 0.5;
    const col2Width = contentWidth * 0.5;
    const col1X = pageMargin;
    const col2X = pageMargin + col1Width;

    let boxHeight = 30;
    const senderText = `1 Sender (Name, Address, Country) Expéditeur (Nom, Adresse, Pays)\n\n${shipment.senderAddress || 'Asendia UK\nUnit 8-12 The Heathrow Estate\nSilver Jubilee way\nHounslow\nTW4 6NF'}`;
    drawTextBox(senderText, col1X, currentY, col1Width, boxHeight, {fontSize: 7});
    drawTextBox("2 Customs Reference/Status Ref douane/Statut\n\nN/A", col2X, currentY, col2Width, boxHeight / 2, {fontSize: 7});
    drawTextBox("3 Senders Agents Reference Ref expéditeur de l'agent\n\nN/A", col2X, currentY + boxHeight / 2, col2Width, boxHeight / 2, {fontSize: 7});
    currentY += boxHeight;

    boxHeight = 30;
    const consigneeText = `4 Consignee, Final Delivery Point (Name, Address) Destinataire (Nom, Adresse, Pays)\n\n${shipment.consigneeAddress || 'LA POSTE ROISSY HUB\n7 Rue Du Haute de Laval\n93290 Tremblay-en-France\nFrance'}`;
    drawTextBox(consigneeText, col1X, currentY, col1Width, boxHeight, {fontSize: 7, fontStyle: 'bold'});
    const truckTrailer = `${shipment.truckRegistration || 'N/A'} / ${shipment.trailerRegistration || 'N/A'}`;
    const carrierText = `5 Carrier (Name, Address, Country) Transporteur (Nom, Adresse, Pays)\n\nCarrier Name: ${carrierName}\nTruck & Trailer: ${truckTrailer}`;
    drawTextBox(carrierText, col2X, currentY, col2Width, boxHeight, {fontSize: 7, textColor: [255,0,0], fontStyle: 'bold'});
    currentY += boxHeight;

    boxHeight = 20;
    drawTextBox("6 Senders instructions for customs, etc... Instructions de l'expéditeur (optionel)\n\nN/A", col1X, currentY, col1Width, boxHeight, {fontSize: 7});
    drawTextBox("7 Successive Carrier Transporteurs successifs\n\nN/A", col2X, currentY, col2Width, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    boxHeight = 20;
    const dynamicTakingOverText = `${shipment.senderAddress || 'Asendia UK, Unit 5, The Hub, Solent Business Park, Fareham, PO15 7FH'}, UK ${formatDateForPdf(shipment.departureDate)}`;
    const takingOverGoodsTextLines = [
        `8 Place and date of taking over the goods (place, country, date)`,
        `Lieu et date de prise en charge des marchandises (lieu, pays, date)`,
        ``,
        dynamicTakingOverText
    ];
    drawTextBox(takingOverGoodsTextLines, col1X, currentY, contentWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

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

    const goodsDataHeight = 30;
    let goodsDescTextLines = [
        `Pallets:        ${shipment.totalPallets || 0}`,
        `Sacks:          ${shipment.totalBags || 0}`,
        ``,
        `SEAL #1 Number:   ${shipment.sealNumber || 'N/A'}`,
        `SEAL #2 Number:   N/A`,
        ``,
        `Description of Goods: cross border eCommerce B2C parcels`
    ];
    drawTextBox(goodsDescTextLines, col1X, currentY, goodsCol1Width, goodsDataHeight, {fontSize: 8, fontStyle: 'bold', textColor: [255,0,0]});

    drawTextBox("", col1X + goodsCol1Width, currentY, goodsCol2Width, goodsDataHeight);

    const grossWeightVal = shipment.totalGrossWeight || 0;
    const grossWeightOfBags = (shipment.totalBags || 0) * BAG_WEIGHT_MULTIPLIER;
    const totalCalculatedWeight = grossWeightVal + grossWeightOfBags;

    console.log(`[PDFService] CMR: Box 11 - Data: grossWeightVal=${grossWeightVal}, grossWeightOfBags=${grossWeightOfBags}, totalCalculatedWeight=${totalCalculatedWeight}`);
    let weightTextLines = [
        `${grossWeightVal.toFixed(2)} Kgs`,
        ``,
        `${grossWeightOfBags.toFixed(2)} Kgs`,
        ``,
        ``,
        `TOTAL: ${totalCalculatedWeight.toFixed(2)} Kgs`
    ];
    drawTextBox(weightTextLines, col1X + goodsCol1Width + goodsCol2Width, currentY, goodsCol3Width, goodsDataHeight, {fontSize: 8, fontStyle: 'bold', textColor: [255,0,0], align: 'right'});
    console.log(`[PDFService] CMR: Drew Box 11 with: ${JSON.stringify(weightTextLines)}`);

    drawTextBox("", col1X + goodsCol1Width + goodsCol2Width + goodsCol3Width, currentY, goodsCol4Width, goodsDataHeight);
    currentY += goodsDataHeight;

    boxHeight = 7;
    drawTextBox("13 Carriage Charges Prix de transport", col1X, currentY, contentWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    const midPointXBox1415 = pageMargin + contentWidth * 0.6;
    const resWidth = midPointXBox1415 - pageMargin;
    const docAttachWidth = contentWidth - resWidth;
    boxHeight = 15;
    drawTextBox("14 Reservations Réserves", col1X, currentY, resWidth, boxHeight, {fontSize: 7});
    drawTextBox("15 Documents attached Documents Annexes (optional)", midPointXBox1415, currentY, docAttachWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    boxHeight = 10;
    drawTextBox("16 Special agreements Conventions particulières (optional)", col1X, currentY, contentWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    const sigBoxWidth = contentWidth / 3;
    boxHeight = 30;

    const consigneeFirstLine = (shipment.consigneeAddress || 'Consignee, Destination Country').split('\n')[0];
    const goodsReceivedText = `17 Goods Received/Marchandises Recues\n\n\n\nDate: ${formatDateForPdf(Timestamp.now())}\n${consigneeFirstLine}`;
    drawTextBox(goodsReceivedText, col1X, currentY, sigBoxWidth, boxHeight, {fontSize: 7});

    drawTextBox("18 Signature and stamp of Carrier/Signature du Transporteur", col1X + sigBoxWidth, currentY, sigBoxWidth, boxHeight, {fontSize: 7});
    drawTextBox("19 Place and date, Signature Lieu et date, Signature", col1X + sigBoxWidth * 2, currentY, sigBoxWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    currentY += 2;
    doc.setFontSize(7);
    doc.text(`Date: ${formatDateForPdf(Timestamp.now())}`, pageMargin + 5, currentY + 5);
    doc.text(`Date: ${formatDateForPdf(Timestamp.now())}`, pageMargin + sigBoxWidth + 5, currentY + 5);
    doc.text(`Date: __ / __ / __`, pageMargin + sigBoxWidth * 2 + 5, currentY + 5);


    console.log(`[PDFService] ${pdfType}: Content added to PDF.`);
    triggerDownload(doc, filename, pdfType);
    console.log(`[PDFService] ${pdfType}: triggerDownload completed for ${filename}.`);

  } catch (error) {
    const errorMsg = `Error in generateCmrPdf function for ${filename}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[PDFService] ${pdfType}: ${errorMsg}`, error);
    alert(`Error creating ${pdfType} PDF for ${shipment.id}: ${errorMsg}`);
  }
};
