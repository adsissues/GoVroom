
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
    const textFontSize = 11;

    doc.setFillColor(0, 90, 106); // Dark Teal
    doc.rect(x, y, logoWidth, logoHeight, 'F');

    doc.setFontSize(textFontSize);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255); // White text

    const textMetrics = doc.getTextDimensions(text, { fontSize: textFontSize });
    const textX = x + (logoWidth - textMetrics.w) / 2;
    const textY = y + (logoHeight / 2) + (textMetrics.h / 3.5); 

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
  console.log(`[PDFService] ${pdfType} PDF: Full shipment data for ${shipment.id}:`, JSON.stringify(shipment, null, 2));
  console.log(`[PDFService] ${pdfType}: generatePreAlertPdf CALLED. Attempting to generate: ${filename}`);

  try {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    console.log(`[PDFService] ${pdfType}: jsPDF instance created.`);

    const details = await getShipmentDetails(shipment.id);
    console.log(`[PDFService] ${pdfType}: Fetched ${details.length} shipment details.`);

    const allFormatCollectionIds = Object.values(SERVICE_FORMAT_MAPPING).filter(Boolean) as string[];
    const dropdownCollectionNames = [...new Set(['carriers', 'subcarriers', 'customers', 'services', 'doe', ...allFormatCollectionIds])];
    const dropdownMaps = await getDropdownOptionsMap(dropdownCollectionNames);
    console.log(`[PDFService] ${pdfType}: Fetched dropdown maps.`);

    const pageMargin = 10; // Reduced margin slightly for more content width
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - 2 * pageMargin;
    let currentY = pageMargin;
    const lightYellowBg = [255, 253, 230]; // R, G, B for light yellow

    // 1. Header
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

    currentY += 15; 

    // 2. Shipment Information Block
    const infoBlockLabels = ["Transporteur", "Driver Name", "Truck Reg No", "Trailer Reg No", "Seal Number"];
    const infoBlockValues = [
      getLabelFromMap(dropdownMaps['carriers'], shipment.carrierId, shipment.carrierId),
      shipment.driverName || 'N/A',
      shipment.truckRegistration || 'N/A',
      shipment.trailerRegistration || 'N/A',
      shipment.sealNumber || 'N/A'
    ];
    const infoCellWidth = contentWidth / infoBlockLabels.length;
    const infoRowHeight = 7; // Combined height for label and value rows for consistency

    infoBlockLabels.forEach((label, index) => {
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
      doc.rect(pageMargin + (index * infoCellWidth), currentY, infoCellWidth, infoRowHeight, 'FD');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(label, pageMargin + (index * infoCellWidth) + infoCellWidth / 2, currentY + infoRowHeight / 2 - 1.5, { align: 'center', baseline: 'middle' }); // Adjusted for two lines
      doc.setFont('helvetica', 'normal');
      doc.text(infoBlockValues[index], pageMargin + (index * infoCellWidth) + infoCellWidth / 2, currentY + infoRowHeight / 2 + 1.5, { align: 'center', baseline: 'middle' });
    });
    currentY += infoRowHeight + 5;

    // 3. Totals Block
    const totalsBlockLabels = ["Total Pallets", "Total Bags", "Total Net Weight", "Total Gross Weight"];
    const totalsBlockValues = [
      (shipment.totalPallets || 0).toString(),
      (shipment.totalBags || 0).toString(),
      `${(shipment.totalNetWeight || 0).toFixed(2)} kg`,
      `${(shipment.totalGrossWeight || 0).toFixed(2)} kg`
    ];
    const totalsCellWidth = contentWidth / totalsBlockLabels.length;

    totalsBlockLabels.forEach((label, index) => {
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
      doc.rect(pageMargin + (index * totalsCellWidth), currentY, totalsCellWidth, infoRowHeight, 'FD');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(label, pageMargin + (index * totalsCellWidth) + totalsCellWidth / 2, currentY + infoRowHeight / 2 - 1.5, { align: 'center', baseline: 'middle' });
      doc.setFont('helvetica', 'normal');
      doc.text(totalsBlockValues[index], pageMargin + (index * totalsCellWidth) + totalsCellWidth / 2, currentY + infoRowHeight / 2 + 1.5, { align: 'center', baseline: 'middle' });
    });
    currentY += infoRowHeight + 5;

    // 4. Service Type Header Block
    const serviceHeaderY = currentY;
    const hubText = "ROISSY HUB & Cellule S3C";
    const serviceBoxHeight = 7;
    const weightKgText = "Weight Kg";
    
    const customerColWidth = 30; // from autoTable columnStyles
    const dispatchNoColWidth = 20;
    const doeColWidth = 15;
    const hubTextWidth = customerColWidth + dispatchNoColWidth + doeColWidth; // Width for "ROISSY HUB..." text

    const formatColumnWidth = 18; // from autoTable columnStyles, also new serviceBoxWidth

    doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
    doc.rect(pageMargin, serviceHeaderY, hubTextWidth, serviceBoxHeight, 'FD'); // Box for "ROISSY HUB..."
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(hubText, pageMargin + 2, serviceHeaderY + serviceBoxHeight / 2, { baseline: 'middle' });

    const initialPrioBoxX = pageMargin + hubTextWidth;

    // Prio Box
    doc.setFillColor(0, 0, 255); // Blue
    doc.rect(initialPrioBoxX, serviceHeaderY, formatColumnWidth, serviceBoxHeight, 'FD');
    doc.setTextColor(255, 255, 255); // White text
    doc.text("Prio", initialPrioBoxX + formatColumnWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });

    // Eco Box
    doc.setFillColor(255, 255, 0); // Yellow
    doc.rect(initialPrioBoxX + formatColumnWidth, serviceHeaderY, formatColumnWidth, serviceBoxHeight, 'FD');
    doc.setTextColor(0, 0, 0); // Black text
    doc.text("Eco", initialPrioBoxX + formatColumnWidth + formatColumnWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });

    // S3C Box
    doc.setFillColor(230, 159, 0); // Orange/Dark Yellow
    doc.rect(initialPrioBoxX + formatColumnWidth * 2, serviceHeaderY, formatColumnWidth, serviceBoxHeight, 'FD');
    doc.text("S3C", initialPrioBoxX + formatColumnWidth * 2 + formatColumnWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });
    
    // Weight Kg Text block (remainder of the contentWidth)
    const weightKgTextX = initialPrioBoxX + formatColumnWidth * 3;
    const weightKgTextBlockWidth = contentWidth - hubTextWidth - (formatColumnWidth * 3);
    doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
    doc.rect(weightKgTextX, serviceHeaderY, weightKgTextBlockWidth, serviceBoxHeight, 'FD');
    doc.setTextColor(0, 0, 0);
    doc.text(weightKgText, weightKgTextX + 5 , serviceHeaderY + serviceBoxHeight / 2, { baseline: 'middle' }); // Add some padding from left of this box
    
    currentY += serviceBoxHeight;

    // 5. Main Details Table
    const tableHead = [['Customer', 'Dispatch No', 'D-OE', 'Format', 'Format', 'Format', 'Tare Weight', 'Gross Weight', 'Net Weight']];
    
    const tableBody = details.map(detail => {
      const customerLabel = getLabelFromMap(dropdownMaps['customers'], detail.customerId, detail.customerId);
      const doeLabel = getLabelFromMap(dropdownMaps['doe'], detail.doeId, detail.doeId || 'N/A');
      
      let formatPrio = '', formatEco = '', formatS3C = '';
      const serviceKey = detail.serviceId?.toLowerCase();
      const mappedFormatCollection = serviceKey && SERVICE_FORMAT_MAPPING[serviceKey] ? SERVICE_FORMAT_MAPPING[serviceKey] : null;
      let formatLabel = detail.formatId || '';
      if (mappedFormatCollection && detail.formatId) {
          formatLabel = getLabelFromMap(dropdownMaps[mappedFormatCollection], detail.formatId, detail.formatId);
      }

      if (serviceKey === 'e' || serviceKey === 'prior' || serviceKey === 'priority') {
          formatPrio = formatLabel;
      } else if (serviceKey === 'c' || serviceKey === 'eco' || serviceKey === 'economy') {
          formatEco = formatLabel;
      } else if (serviceKey === 's' || serviceKey === 's3c') {
          formatS3C = formatLabel;
      }
      
      return [
        customerLabel,
        detail.dispatchNumber || 'N/A',
        doeLabel,
        formatPrio, // Prio Format Col
        formatEco,  // Eco Format Col
        formatS3C,  // S3C Format Col
        (detail.tareWeight || 0).toFixed(2),
        (detail.grossWeight || 0).toFixed(2),
        (detail.netWeight || 0).toFixed(2),
      ];
    });

    autoTable(doc, {
      head: tableHead,
      body: tableBody,
      startY: currentY,
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
        lineWidth: 0.1,
        lineColor: [180,180,180], 
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
      didDrawCell: (data) => {
        if (data.section === 'body') {
          doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          doc.setTextColor(0,0,0); 
          doc.text(String(data.cell.raw) , data.cell.x + data.cell.padding('left'), data.cell.y + data.cell.height / 2, {
            baseline: 'middle',
            halign: data.cell.styles.halign
          });
        }
      },
      columnStyles: {
        0: { cellWidth: customerColWidth }, // Customer
        1: { cellWidth: dispatchNoColWidth, halign: 'center' }, // Dispatch No
        2: { cellWidth: doeColWidth, halign: 'center' }, // D-OE
        3: { cellWidth: formatColumnWidth, halign: 'center' }, // Format Prio
        4: { cellWidth: formatColumnWidth, halign: 'center' }, // Format Eco
        5: { cellWidth: formatColumnWidth, halign: 'center' }, // Format S3C
        // Remaining width for Tare, Gross, Net
        6: { cellWidth: (contentWidth - hubTextWidth - (formatColumnWidth*3)) / 3 , halign: 'right' }, // Tare
        7: { cellWidth: (contentWidth - hubTextWidth - (formatColumnWidth*3)) / 3 , halign: 'right' }, // Gross
        8: { cellWidth: (contentWidth - hubTextWidth - (formatColumnWidth*3)) / 3 , halign: 'right' }, // Net
      },
      margin: { left: pageMargin, right: pageMargin },
      didDrawPage: (dataArg) => {
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


// --- DETAILED CMR PDF FUNCTION (Should match your standard CMR image) ---
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

    const drawTextBox = (text: string | string[], x: number, y: number, width: number, height: number, options: any = {}) => {
      doc.rect(x, y, width, height); // Draw border first
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
      let effectiveFontSize = options.fontSize || originalFontSize; // Use option's font size or current
      doc.setFontSize(effectiveFontSize);

      textToPrint.forEach(line => {
          // Ensure line is a string before passing to splitTextToSize
          const currentLine = typeof line === 'string' ? line : '';
          const splitLines = doc.splitTextToSize(currentLine, width - 4); // 2mm padding on each side
          lines.push(...splitLines);
      });
      
      const originalFont = doc.getFont();
      if (options.fontStyle) doc.setFont(originalFont.fontName, options.fontStyle);
      
      const originalTextColor = doc.getTextColor(); 
      if (options.textColor) doc.setTextColor(options.textColor[0], options.textColor[1], options.textColor[2]);


      // Calculate Y offset for vertical alignment (simple top padding)
      const textYPos = y + 2 + (effectiveFontSize / 3.5); 
      let textXPos = x + 2; 

      if (mergedOptions.align === 'right') {
        textXPos = x + width - 2; 
      } else if (mergedOptions.align === 'center') {
        textXPos = x + width / 2;
      }
      
      doc.text(lines, textXPos, textYPos, mergedOptions);

      doc.setFontSize(originalFontSize);
      doc.setFont(originalFont.fontName, originalFont.fontStyle);
      doc.setTextColor(originalTextColor); 
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

    boxHeight = 20; // Increased from 10 to give more space for Box 8
    drawTextBox("6 Senders instructions for customs, etc... Instructions de l'expéditeur (optionel)\n\nN/A", col1X, currentY, col1Width, boxHeight, {fontSize: 7});
    drawTextBox("7 Successive Carrier Transporteurs successifs\n\nN/A", col2X, currentY, col2Width, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    boxHeight = 20; 
    const dynamicTakingOverText = `${shipment.senderAddress || 'Asendia UK, Unit 5, The Hub, Solent Business Park, Fareham, PO15 7FH'}, UK ${formatDateForPdf(shipment.departureDate)}`;
    const takingOverGoodsTextLines = [
        `8 Place and date of taking over the goods (place, country, date)`,
        `Lieu et date de prise en charge des marchandises (lieu, pays, date)`,
        ``, // Empty line for spacing
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

    const consigneeFirstLineForBox17 = (shipment.consigneeAddress || 'Consignee Address').split('\n')[0];
    const goodsReceivedText = `17 Goods Received/Marchandises Recues\n\n\n\nDate: ${formatDateForPdf(Timestamp.now())}\n${consigneeFirstLineForBox17}`;
    drawTextBox(goodsReceivedText, col1X, currentY, sigBoxWidth, boxHeight, {fontSize: 7});

    drawTextBox("18 Signature and stamp of Carrier/Signature du Transporteur", col1X + sigBoxWidth, currentY, sigBoxWidth, boxHeight, {fontSize: 7});
    drawTextBox("19 Place and date, Signature Lieu et date, Signature", col1X + sigBoxWidth * 2, currentY, sigBoxWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    currentY += 2; 
    doc.setFontSize(7);
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

    