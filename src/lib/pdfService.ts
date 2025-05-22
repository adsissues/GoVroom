
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
      pdfDataUri.startsWith('data:application/pdf;') && // Check for the correct prefix
      pdfDataUri.includes(';base64,'); // Ensure it indicates Base64 encoding

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
    doc.setFont('helvetica', 'normal'); // Changed from bold to normal
    doc.setTextColor(255, 255, 255); // White text

    const textMetrics = doc.getTextDimensions(text, { fontSize: textFontSize });
    const textX = x + (logoWidth - textMetrics.w) / 2;
    const textY = y + (logoHeight / 2) + (textMetrics.h / 3.5); // Adjusted for better vertical centering

    doc.text(text, textX, textY, { baseline: 'middle', align: 'center' }); // Centered text

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
    const dropdownCollectionNames = [...new Set(['carriers', 'customers', 'services', 'doe', ...allFormatCollectionIds])];
    const dropdownMaps = await getDropdownOptionsMap(dropdownCollectionNames);
    console.log(`[PDFService] ${pdfType}: Fetched dropdown maps.`);

    const pageMargin = 10;
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

    currentY += 15; // Space after logo/title block

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
    const infoLabelHeight = 7;
    const infoValueHeight = 7;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    infoBlockLabels.forEach((label, index) => {
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
      doc.rect(pageMargin + (index * infoCellWidth), currentY, infoCellWidth, infoLabelHeight, 'FD'); // FD for Fill and Stroke
      doc.text(label, pageMargin + (index * infoCellWidth) + infoCellWidth / 2, currentY + infoLabelHeight / 2, { align: 'center', baseline: 'middle' });
    });
    currentY += infoLabelHeight;

    doc.setFont('helvetica', 'normal');
    infoBlockValues.forEach((value, index) => {
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
      doc.rect(pageMargin + (index * infoCellWidth), currentY, infoCellWidth, infoValueHeight, 'FD');
      doc.text(value, pageMargin + (index * infoCellWidth) + infoCellWidth / 2, currentY + infoValueHeight / 2, { align: 'center', baseline: 'middle' });
    });
    currentY += infoValueHeight + 5; // Space after info block

    // 3. Totals Block
    const totalsBlockLabels = ["Total Pallets", "Total Bags", "Total Net Weight", "Total Gross Weight"];
    const totalsBlockValues = [
      (shipment.totalPallets || 0).toString(),
      (shipment.totalBags || 0).toString(),
      `${(shipment.totalNetWeight || 0).toFixed(2)} kg`,
      `${(shipment.totalGrossWeight || 0).toFixed(2)} kg`
    ];
    const totalsCellWidth = contentWidth / totalsBlockLabels.length;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    totalsBlockLabels.forEach((label, index) => {
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
      doc.rect(pageMargin + (index * totalsCellWidth), currentY, totalsCellWidth, infoLabelHeight, 'FD');
      doc.text(label, pageMargin + (index * totalsCellWidth) + totalsCellWidth / 2, currentY + infoLabelHeight / 2, { align: 'center', baseline: 'middle' });
    });
    currentY += infoLabelHeight;

    doc.setFont('helvetica', 'normal');
    totalsBlockValues.forEach((value, index) => {
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
      doc.rect(pageMargin + (index * totalsCellWidth), currentY, totalsCellWidth, infoValueHeight, 'FD');
      doc.text(value, pageMargin + (index * totalsCellWidth) + totalsCellWidth / 2, currentY + infoValueHeight / 2, { align: 'center', baseline: 'middle' });
    });
    currentY += infoValueHeight + 5; // Space after totals block

    // 4. Service Type Header Block
    const serviceHeaderY = currentY;
    const hubText = "ROISSY HUB & Cellule S3C";
    const serviceBoxWidth = 20; // Width for Prio, Eco, S3C boxes
    const serviceBoxHeight = 7;
    const weightKgText = "Weight Kg";
    
    const hubTextWidth = doc.getStringUnitWidth(hubText) * 8 / doc.internal.scaleFactor; // Approx width of hubText
    const initialTextX = pageMargin + hubTextWidth + 5; // Start Prio box after hubText and some space

    doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
    doc.rect(pageMargin, serviceHeaderY, contentWidth, serviceBoxHeight, 'FD'); // Full width yellow bar for this row
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(hubText, pageMargin + 2, serviceHeaderY + serviceBoxHeight / 2, { baseline: 'middle' });

    // Prio Box
    doc.setFillColor(0, 0, 255); // Blue
    doc.rect(initialTextX, serviceHeaderY, serviceBoxWidth, serviceBoxHeight, 'FD');
    doc.setTextColor(255, 255, 255); // White text
    doc.text("Prio", initialTextX + serviceBoxWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });

    // Eco Box
    doc.setFillColor(255, 255, 0); // Yellow
    doc.rect(initialTextX + serviceBoxWidth, serviceHeaderY, serviceBoxWidth, serviceBoxHeight, 'FD');
    doc.setTextColor(0, 0, 0); // Black text
    doc.text("Eco", initialTextX + serviceBoxWidth + serviceBoxWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });

    // S3C Box
    doc.setFillColor(230, 159, 0); // Orange/Dark Yellow
    doc.rect(initialTextX + serviceBoxWidth * 2, serviceHeaderY, serviceBoxWidth, serviceBoxHeight, 'FD');
    doc.setTextColor(0, 0, 0); // Black text
    doc.text("S3C", initialTextX + serviceBoxWidth * 2 + serviceBoxWidth / 2, serviceHeaderY + serviceBoxHeight / 2, { align: 'center', baseline: 'middle' });

    doc.setTextColor(0, 0, 0); // Reset text color
    doc.text(weightKgText, initialTextX + serviceBoxWidth * 3 + 10, serviceHeaderY + serviceBoxHeight / 2, { baseline: 'middle' });
    
    currentY += serviceBoxHeight;

    // 5. Main Details Table
    const tableHead = [['Customer', 'Dispatch No', 'D-OE', 'Format', 'Format', 'Format', 'Tare Weight', 'Gross Weight', 'Net Weight']];
    // Sub-headers for format based on sample image (empty for the actual header row, implied by Prio/Eco/S3C boxes above)
    
    const tableBody = details.map(detail => {
      const customerLabel = getLabelFromMap(dropdownMaps['customers'], detail.customerId, detail.customerId);
      const doeLabel = getLabelFromMap(dropdownMaps['doe'], detail.doeId, detail.doeId || 'N/A');
      
      let formatPrio = '', formatEco = '', formatS3C = '';
      const serviceKey = detail.serviceId?.toLowerCase();
      const mappedFormatCollection = serviceKey ? SERVICE_FORMAT_MAPPING[serviceKey] : null;
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
        formatPrio,
        formatEco,
        formatS3C,
        (detail.tareWeight || 0).toFixed(2),
        (detail.grossWeight || 0).toFixed(2),
        (detail.netWeight || 0).toFixed(2),
      ];
    });

    autoTable(doc, {
      head: tableHead,
      body: tableBody,
      startY: currentY,
      theme: 'plain', // Plain theme to allow custom cell styling
      styles: {
        fontSize: 8,
        cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
        lineWidth: 0.1,
        lineColor: [180,180,180], // Light grey for cell borders
      },
      headStyles: {
        fillColor: lightYellowBg, // Light yellow for main header cells
        textColor: [0,0,0],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.1,
        lineColor: [150,150,150], // Slightly darker grey for header borders
      },
      didDrawCell: (data) => {
        // Apply light yellow background to all body cells
        if (data.section === 'body') {
          doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          doc.setTextColor(0,0,0); // Ensure text color is black for body cells
          // Redraw text because fillRect covers it
          doc.text(String(data.cell.raw) , data.cell.x + data.cell.padding('left'), data.cell.y + data.cell.height / 2, {
            baseline: 'middle',
            halign: data.cell.styles.halign
          });
        }
      },
      columnStyles: {
        0: { cellWidth: 30 }, // Customer
        1: { cellWidth: 20, halign: 'center' }, // Dispatch No
        2: { cellWidth: 15, halign: 'center' }, // D-OE
        3: { cellWidth: 18, halign: 'center' }, // Format Prio
        4: { cellWidth: 18, halign: 'center' }, // Format Eco
        5: { cellWidth: 18, halign: 'center' }, // Format S3C
        6: { cellWidth: 20, halign: 'right' }, // Tare
        7: { cellWidth: 20, halign: 'right' }, // Gross
        8: { cellWidth: 20, halign: 'right' }, // Net
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
      let effectiveFontSize = options.fontSize || originalFontSize;
      doc.setFontSize(effectiveFontSize);

      textToPrint.forEach(line => {
          const splitLines = doc.splitTextToSize(line, width - 4); // 2mm padding on each side
          lines.push(...splitLines);
      });
      
      const originalFont = doc.getFont();
      if (options.fontStyle) doc.setFont(originalFont.fontName, options.fontStyle);
      
      const originalTextColor = doc.getTextColor(); // Store original text color
      if (options.textColor) doc.setTextColor(options.textColor[0], options.textColor[1], options.textColor[2]);


      // Calculate Y offset for vertical alignment (simple top padding)
      const textYPos = y + 2 + (effectiveFontSize / 3.5); // 2mm top padding + font size adjustment
      let textXPos = x + 2; // 2mm left padding

      if (mergedOptions.align === 'right') {
        textXPos = x + width - 2; // 2mm right padding for right alignment
      } else if (mergedOptions.align === 'center') {
        textXPos = x + width / 2;
      }
      
      doc.text(lines, textXPos, textYPos, mergedOptions);

      doc.setFontSize(originalFontSize);
      doc.setFont(originalFont.fontName, originalFont.fontStyle);
      doc.setTextColor(originalTextColor); // Restore original text color
    };

    addAsendiaStyleLogo(doc, pageMargin, currentY);

    const crmLogoX = pageMargin + 35 + 2; // logoWidth is 35
    const crmLogoRadius = 5;
    doc.setFillColor(200, 200, 200); // Light grey
    doc.circle(crmLogoX + crmLogoRadius, currentY + crmLogoRadius, crmLogoRadius, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0,0,0);
    doc.text("CMR", crmLogoX + crmLogoRadius, currentY + crmLogoRadius, { align: 'center', baseline: 'middle' });
    doc.setFont('helvetica', 'normal');

    const titleX = crmLogoX + crmLogoRadius * 2 + 5;
    doc.setFontSize(7);
    doc.text("LETTRE DE VOITURE INTERNATIONALE", titleX, currentY + 3);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text("INTERNATIONAL CONSIGNMENT NOTE", titleX, currentY + 8);
    doc.setFont('helvetica', 'normal');
    currentY += 12; // Space after logo section

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

    boxHeight = 10; // Reduced from 20 to give more space for box 8
    drawTextBox("6 Senders instructions for customs, etc... Instructions de l'expéditeur (optionel)\n\nN/A", col1X, currentY, col1Width, boxHeight, {fontSize: 7});
    drawTextBox("7 Successive Carrier Transporteurs successifs\n\nN/A", col2X, currentY, col2Width, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    boxHeight = 20; // Increased box height for Box 8
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
        `Sacks:          ${shipment.totalBags || 0}`, // Changed from "Bags" to "Sacks"
        ``,
        `SEAL #1 Number:   ${shipment.sealNumber || 'N/A'}`,
        `SEAL #2 Number:   N/A`, // Assuming N/A as per sample
        ``,
        `Description of Goods: cross border eCommerce B2C parcels`
    ];
    drawTextBox(goodsDescTextLines, col1X, currentY, goodsCol1Width, goodsDataHeight, {fontSize: 8, fontStyle: 'bold', textColor: [255,0,0]});

    drawTextBox("", col1X + goodsCol1Width, currentY, goodsCol2Width, goodsDataHeight); // Box 10 data (empty)

    // Box 11 data
    const mainGrossWeight = shipment.totalGrossWeight || 0;
    const grossWeightOfBags = (shipment.totalBags || 0) * BAG_WEIGHT_MULTIPLIER;
    const totalWeightForBox11 = mainGrossWeight + grossWeightOfBags;

    console.log(`[PDFService] CMR: Box 11 Calculation - Main Gross: ${mainGrossWeight}, Bags: ${shipment.totalBags}, Bag Wt Multiplier: ${BAG_WEIGHT_MULTIPLIER}, Gross Wt of Bags: ${grossWeightOfBags}, Total for Box 11: ${totalWeightForBox11}`);

    let weightTextLines = [
        `${mainGrossWeight.toFixed(2)} Kgs`, // Pallet Gross Weight
        ``,
        `${grossWeightOfBags.toFixed(2)} Kgs`, // Sacks Gross Weight
        ``,
        ``,
        `TOTAL: ${totalWeightForBox11.toFixed(2)} Kgs`
    ];
    drawTextBox(weightTextLines, col1X + goodsCol1Width + goodsCol2Width, currentY, goodsCol3Width, goodsDataHeight, {fontSize: 8, fontStyle: 'bold', textColor: [255,0,0], align: 'right'});

    drawTextBox("", col1X + goodsCol1Width + goodsCol2Width + goodsCol3Width, currentY, goodsCol4Width, goodsDataHeight); // Box 12 data (empty)
    currentY += goodsDataHeight;

    boxHeight = 7;
    drawTextBox("13 Carriage Charges Prix de transport", col1X, currentY, contentWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    const midPointXBox1415 = pageMargin + contentWidth * 0.6; // Adjusted for sample
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

    const consigneeFirstLineForBox17 = (shipment.consigneeAddress || 'Consignee, Destination Country').split('\n')[0];
    const goodsReceivedText = `17 Goods Received/Marchandises Recues\n\n\n\nDate: ${formatDateForPdf(Timestamp.now())}\n${consigneeFirstLineForBox17}`;
    drawTextBox(goodsReceivedText, col1X, currentY, sigBoxWidth, boxHeight, {fontSize: 7});

    drawTextBox("18 Signature and stamp of Carrier/Signature du Transporteur", col1X + sigBoxWidth, currentY, sigBoxWidth, boxHeight, {fontSize: 7});
    drawTextBox("19 Place and date, Signature Lieu et date, Signature", col1X + sigBoxWidth * 2, currentY, sigBoxWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    // Dates below signature boxes
    currentY += 2; // Small gap
    doc.setFontSize(7);
    // For box 17, date is already inside the box. For box 18, it's typically stamp/signature. Box 19 is for sender/agent.
    // The sample seems to imply dates for box 18 (carrier) and box 19 (sender)
    // Let's assume the date for box 18 (Carrier) is departure date
    // And date for box 19 (Sender) is also departure date.
    // The actual CMR is signed at different stages.
    // doc.text(`Date: ${formatDateForPdf(Timestamp.now())}`, pageMargin + 5, currentY + 5); // Date for box 17, already in box
    doc.text(`Date: ${formatDateForPdf(shipment.departureDate)}`, pageMargin + sigBoxWidth + 5, currentY + 5); // Date for Carrier's signature (box 18)
    doc.text(`Date: ${formatDateForPdf(shipment.departureDate)}`, pageMargin + sigBoxWidth * 2 + 5, currentY + 5); // Date for Sender's signature (box 19)
    // The sample had "Date: __ / __ / __" for the last one which is often where the consignee signs upon final receipt.
    // The box 17 is "Goods Received" and already contains a date.

    console.log(`[PDFService] ${pdfType}: Content added to PDF.`);
    triggerDownload(doc, filename, pdfType);
    console.log(`[PDFService] ${pdfType}: triggerDownload completed for ${filename}.`);

  } catch (error) {
    const errorMsg = `Error in generateCmrPdf function for ${filename}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[PDFService] ${pdfType}: ${errorMsg}`, error);
    alert(`Error creating ${pdfType} PDF for ${shipment.id}: ${errorMsg}`);
  }
};

    