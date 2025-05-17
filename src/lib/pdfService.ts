
"use client";

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Shipment, ShipmentDetail, DropdownItem } from '@/lib/types';
import { db } from '@/lib/firebase/config';
import {
    collection,
    getDocs,
    query,
    orderBy,
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
      pdfDataUriLength > 100 && // Ensure it's a reasonably long string
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
  return map[value] || value; // Return the value if not found in map
};

const addAsendiaStyleLogo = (doc: jsPDF, x: number, y: number) => {
    const logoWidth = 35; // mm
    const logoHeight = 10; // mm
    const text = "asendia";
    const textFontSize = 9;

    doc.setFillColor(0, 90, 106); // Dark Teal
    doc.rect(x, y, logoWidth, logoHeight, 'F');

    doc.setFontSize(textFontSize);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255); // White text

    const textX = x + logoWidth / 2;
    const textY = y + logoHeight / 2;

    doc.text(text, textX, textY, { align: 'center', baseline: 'middle' });
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

    if (currentY > doc.internal.pageSize.getHeight() - 50) { // Check if space for table header
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
        fillColor: [22, 78, 99], // Dark blueish-cyan
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      tableLineColor: [180, 180, 180],
      tableLineWidth: 0.1,
      didDrawPage: (data: any) => { // Add logo to subsequent pages if table spans multiple pages
        if (data.pageNumber > 1 || (data.pageNumber === 1 && data.cursor?.y && data.cursor.y < 40)) { // Heuristic for first page if table starts high
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

    const dropdownMaps = await getDropdownOptionsMap(['carriers']); // Fetch carrier map

    const pageMargin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - 2 * pageMargin;
    let currentY = pageMargin;

    // --- Helper to draw text in a box, with potential wrapping ---
    const drawTextBox = (text: string | string[], x: number, y: number, width: number, height: number, options: any = {}) => {
      doc.rect(x, y, width, height);
      const defaultOptions = { align: 'left', baseline: 'top', flags: {noBOM: true, autoencode: true} };
      const mergedOptions = {...defaultOptions, ...options};
      
      let textToPrint = Array.isArray(text) ? text : [text];
      
      if (options.fontSize) doc.setFontSize(options.fontSize);
      if (options.fontStyle) doc.setFont(doc.getFont().fontName, options.fontStyle);
      if (options.textColor) doc.setTextColor(options.textColor[0], options.textColor[1], options.textColor[2]);

      // Simple manual wrapping for multiple lines
      const lines = [];
      textToPrint.forEach(line => {
          const splitLines = doc.splitTextToSize(line, width - 4); // 2mm padding each side
          lines.push(...splitLines);
      });

      doc.text(lines, x + 2, y + 2, mergedOptions); // 2mm padding

      // Reset to default after drawing
      doc.setFontSize(10);
      doc.setFont(doc.getFont().fontName, 'normal');
      doc.setTextColor(0,0,0);
    };

    // --- Header Section ---
    addAsendiaStyleLogo(doc, pageMargin, currentY);
    
    // CRM Logo (Simulated)
    const crmLogoX = pageMargin + 35 + 2; // Next to Asendia logo
    const crmLogoRadius = 5;
    doc.setFillColor(200, 200, 200); // Light gray
    doc.circle(crmLogoX + crmLogoRadius, currentY + crmLogoRadius, crmLogoRadius, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("CRM", crmLogoX + crmLogoRadius, currentY + crmLogoRadius, { align: 'center', baseline: 'middle' });
    doc.setFont('helvetica', 'normal');

    const titleX = crmLogoX + crmLogoRadius * 2 + 5;
    doc.setFontSize(7);
    doc.text("LETTRE DE VOITURE INTERNATIONALE", titleX, currentY + 3);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text("INTERNATIONAL CONSIGNMENT NOTE", titleX, currentY + 8);
    doc.setFont('helvetica', 'normal');
    currentY += 12; // End of header part

    // --- Grid Layout ---
    const col1Width = contentWidth * 0.5;
    const col2Width = contentWidth * 0.5;
    const col1X = pageMargin;
    const col2X = pageMargin + col1Width;

    // Line 1: Sender / Customs Ref
    let boxHeight = 30;
    drawTextBox(`1 Sender (Name, Address, Country) Expéditeur (Nom, Adresse, Pays)\n\n${shipment.senderAddress || 'Asendia UK\nUnit 8-12 The Heathrow Estate\nSilver Jubilee way\nHounslow\nTW4 6NF'}`, col1X, currentY, col1Width, boxHeight, {fontSize: 7});
    drawTextBox("2 Customs Reference/Status Ref douane/Statut\n\nN/A", col2X, currentY, col2Width, boxHeight / 2, {fontSize: 7});
    drawTextBox("3 Senders Agents Reference Ref expéditeur de l'agent\n\nN/A", col2X, currentY + boxHeight / 2, col2Width, boxHeight / 2, {fontSize: 7});
    currentY += boxHeight;

    // Line 2: Consignee / Carrier
    boxHeight = 30;
    drawTextBox(`4 Consignee, Final Delivery Point (Name, Address) Destinataire (Nom, Adresse, Pays)\n\n${shipment.consigneeAddress || 'LA POSTE ROISSY HUB\n7 Rue Du Haute de Laval\n93290 Tremblay-en-France\nFrance'}`, col1X, currentY, col1Width, boxHeight, {fontSize: 7, fontStyle: 'bold'});
    const carrierName = getLabelFromMap(dropdownMaps['carriers'], shipment.carrierId, shipment.carrierId);
    const truckTrailer = `${shipment.truckRegistration || 'NDB442'}/${shipment.trailerRegistration || 'NN406'}`;
    drawTextBox(`5 Carrier (Name, Address, Country) Transporteur (Nom, Adresse, Pays)\n\nCarrier Name: ${carrierName}\nTruck & Trailer: ${truckTrailer}`, col2X, currentY, col2Width, boxHeight, {fontSize: 7, textColor: [255,0,0], fontStyle: 'bold'});
    currentY += boxHeight;
    
    // Line 3: Senders instructions for customs etc / Successive Carrier
    boxHeight = 20;
    drawTextBox("6 Senders instructions for customs, etc... Instructions de l'expéditeur (optionel)\n\nN/A", col1X, currentY, col1Width, boxHeight, {fontSize: 7});
    drawTextBox("7 Successive Carrier Transporteurs successifs\n\nN/A", col2X, currentY, col2Width, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    // Line 4: Place and date of taking over the goods...
    boxHeight = 10;
    const takingOverGoodsText = `8 Place and date of taking over the goods (place, country, date)\nLieu et date de prise en charge des marchandises (lieu, pays, date)\n\n${(shipment.senderAddress || 'Asendia UK').split('\n')[0]}, UK ${formatDateForPdf(shipment.departureDate)}`;
    drawTextBox(takingOverGoodsText, col1X, currentY, contentWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    // Line 5: Goods Table Header (Complex, simplified for now)
    const goodsDetailsYStart = currentY;
    const goodsCol1Width = contentWidth * 0.4;
    const goodsCol2Width = contentWidth * 0.2;
    const goodsCol3Width = contentWidth * 0.2;
    const goodsCol4Width = contentWidth * 0.2;

    drawTextBox("9 Marks & Nos; No & Kind of Packages; Description of Goods\nMarques et Nos; Nb et nature des colis; Désignation des marchandises", col1X, currentY, goodsCol1Width, 10, {fontSize: 6});
    drawTextBox("10 No. of packages\n(statistical)", col1X + goodsCol1Width, currentY, goodsCol2Width, 10, {fontSize: 6});
    drawTextBox("11 Gross Weight (kg)\nPoids Brut (kg)", col1X + goodsCol1Width + goodsCol2Width, currentY, goodsCol3Width, 10, {fontSize: 6});
    drawTextBox("12 Volume (m³)\nCubage (m³)", col1X + goodsCol1Width + goodsCol2Width + goodsCol3Width, currentY, goodsCol4Width, 10, {fontSize: 6});
    currentY += 10;

    // Goods Table Data
    const goodsDataHeight = 30;
    // Column 1 Data
    let dataText = `Pallets:        ${shipment.totalPallets || 0}\n`;
    dataText +=    `Sacks:          ${shipment.totalBags || 0}\n\n`;
    dataText +=    `SEAL #1 Number:   ${shipment.sealNumber || 'N/A'}\n`;
    dataText +=    `SEAL #2 Number:   N/A\n\n`;
    dataText +=    `Description of Goods: cross border eCommerce B2C parcels`;
    drawTextBox(dataText, col1X, currentY, goodsCol1Width, goodsDataHeight, {fontSize: 8, fontStyle: 'bold', textColor: [255,0,0]});
    
    // Column 2 Data (No. of packages) - Sample is blank
    drawTextBox("", col1X + goodsCol1Width, currentY, goodsCol2Width, goodsDataHeight);

    // Column 3 Data (Weights)
    let weightText = `${(shipment.totalGrossWeight || 0).toFixed(2)} Kgs\n\n`; // Gross
    weightText +=    `${(shipment.totalTareWeight || 0).toFixed(2)} Kgs\n\n\n`; // Tare (approximating "55.00 Kgs" from sample)
    weightText +=    `TOTAL: ${((shipment.totalGrossWeight || 0) + (shipment.totalTareWeight || 0)).toFixed(2)} Kgs`;
    drawTextBox(weightText, col1X + goodsCol1Width + goodsCol2Width, currentY, goodsCol3Width, goodsDataHeight, {fontSize: 8, fontStyle: 'bold', textColor: [255,0,0], align: 'right'});
    
    // Column 4 Data (Volume) - Sample is blank
    drawTextBox("", col1X + goodsCol1Width + goodsCol2Width + goodsCol3Width, currentY, goodsCol4Width, goodsDataHeight);
    currentY += goodsDataHeight;

    // Line 6: Carriage Charges
    boxHeight = 7;
    drawTextBox("13 Carriage Charges Prix de transport", col1X, currentY, contentWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    // Line 7: Reservations / Documents attached
    const midPointX = pageMargin + contentWidth * 0.6; // Adjusted split
    const resWidth = midPointX - pageMargin;
    const docAttachWidth = contentWidth - resWidth;
    boxHeight = 15;
    drawTextBox("14 Reservations Réserves", col1X, currentY, resWidth, boxHeight, {fontSize: 7});
    drawTextBox("15 Documents attached Documents Annexes (optional)", midPointX, currentY, docAttachWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;
    
    // Line 8: Special agreements
    boxHeight = 10;
    drawTextBox("16 Special agreements Conventions particulières (optional)", col1X, currentY, contentWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    // Line 9: Goods Received / Signature Boxes
    const sigBoxWidth = contentWidth / 3;
    boxHeight = 30; // Height for signature boxes
    drawTextBox("17 Goods Received/Marchandises Recues\n\n\n\nDate: " + formatDateForPdf(shipment.arrivalDate) + "\nAsendia UK, Hounslow", col1X, currentY, sigBoxWidth, boxHeight, {fontSize: 7});
    drawTextBox("18 Signature and stamp of Carrier/Signature du Transporteur", col1X + sigBoxWidth, currentY, sigBoxWidth, boxHeight, {fontSize: 7});
    drawTextBox("19 Place and date, Signature Lieu et date, Signature", col1X + sigBoxWidth * 2, currentY, sigBoxWidth, boxHeight, {fontSize: 7});
    currentY += boxHeight;

    // Final Date Line
    currentY += 2;
    doc.setFontSize(7);
    doc.text(`Date: ${formatDateForPdf(shipment.departureDate)}`, pageMargin + 5, currentY + 5);
    doc.text(`Date: ${formatDateForPdf(shipment.departureDate)}`, pageMargin + sigBoxWidth + 5, currentY + 5);
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

    