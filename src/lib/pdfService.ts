
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
      pdfDataUri.startsWith('data:application/pdf;') && // Check for the general PDF mime type start
      pdfDataUri.includes(';base64,'); // Ensure base64 encoding is indicated

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

const getLabelFromMap = (map: Record<string, string> | undefined, value: string | undefined | null, defaultValueIfNotFoundOrValueMissing = 'N/A'): string => {
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
    const textY = y + (logoHeight / 2) + (textMetrics.h / 3.5); // Adjusted for better vertical centering

    doc.text(text, textX, textY, { baseline: 'middle', align: 'center' }); // Use align: 'center'

    doc.setTextColor(0, 0, 0); // Reset text color
};


const getShipmentDetails = async (shipmentId: string): Promise<ShipmentDetail[]> => {
  console.log(`[PDFService] getShipmentDetails CALLED for shipmentId: ${shipmentId}`);
  if (!shipmentId) {
    console.warn("[PDFService] getShipmentDetails: shipmentId is empty or undefined.");
    return [];
  }
  const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');
  const q = query(detailsCollectionRef, orderBy('createdAt', 'asc')); // Added orderBy import
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

    const pageMargin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    // const pageHeight = doc.internal.pageSize.getHeight(); // Not used explicitly yet
    const contentWidth = pageWidth - 2 * pageMargin;
    let currentY = pageMargin;

    // Helper to draw styled box with centered text
    const drawStyledBox = (text: string, x: number, y: number, width: number, height: number, options: {
      fillColor?: [number, number, number],
      textColor?: [number, number, number],
      fontStyle?: string,
      fontSize?: number,
      halign?: 'left' | 'center' | 'right',
      border?: boolean
    } = {}) => {
      const { fillColor, textColor = [0,0,0], fontStyle = 'normal', fontSize = 8, halign = 'center', border = true } = options;
      
      if (fillColor) {
        doc.setFillColor(...fillColor);
        doc.rect(x, y, width, height, 'F');
      }
      if (border) {
        doc.setDrawColor(150, 150, 150); // Light gray border
        doc.rect(x, y, width, height, 'S');
      }

      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      doc.setTextColor(...textColor);
      
      const textX = halign === 'center' ? x + width / 2 : (halign === 'right' ? x + width - 2 : x + 2); // -2 for right align padding
      doc.text(text, textX, y + height / 2, { align: halign, baseline: 'middle' });
    };

    // --- Header ---
    addAsendiaStyleLogo(doc, pageMargin, currentY);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("SHIPMENT REPORT / ASENDIA UK", pageWidth / 2, currentY + 7, { align: 'center' });
    currentY += 5; 

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const dateDepartureText = `Date de départ: ${formatDateForPdf(shipment.departureDate)}`;
    const dateArrivalText = `Date d'arrivée: ${formatDateForPdf(shipment.arrivalDate)}`;
    const dateTextWidth = Math.max(doc.getTextWidth(dateDepartureText), doc.getTextWidth(dateArrivalText));
    doc.text(dateDepartureText, pageWidth - pageMargin - dateTextWidth, currentY - 2); // Adjust Y to align better
    doc.text(dateArrivalText, pageWidth - pageMargin - dateTextWidth, currentY + 3); // Adjust Y
    currentY += 15;


    // --- Shipment Information Block ---
    const lightYellowBg: [number, number, number] = [255, 248, 220];
    const infoBlockLabels = ["Transporteur", "Driver Name", "Truck Reg No", "Trailer Reg No", "Seal Number"];
    const infoBlockValues = [
      getLabelFromMap(dropdownMaps['carriers'], shipment.carrierId, shipment.carrierId),
      shipment.driverName || 'N/A',
      shipment.truckRegistration || 'N/A',
      shipment.trailerRegistration || 'N/A',
      shipment.sealNumber || 'N/A'
    ];
    const infoColCount = infoBlockLabels.length;
    const infoColWidth = contentWidth / infoColCount;
    const infoRowHeight = 7;

    infoBlockLabels.forEach((label, index) => {
      drawStyledBox(label, pageMargin + index * infoColWidth, currentY, infoColWidth, infoRowHeight, { fillColor: lightYellowBg, fontStyle: 'bold', fontSize: 7, border: true });
    });
    currentY += infoRowHeight;
    infoBlockValues.forEach((value, index) => {
      drawStyledBox(value, pageMargin + index * infoColWidth, currentY, infoColWidth, infoRowHeight, { fillColor: lightYellowBg, fontSize: 7, halign: 'left', border: true });
    });
    currentY += infoRowHeight + 5;

    // --- Totals Block ---
    const totalsBlockLabels = ["Total Pallets", "Total Bags", "Total Net Weight", "Total Gross Weight"];
    const totalsBlockValues = [
      (shipment.totalPallets || 0).toString(),
      (shipment.totalBags || 0).toString(),
      `${(shipment.totalNetWeight || 0).toFixed(2)} kg`,
      `${(shipment.totalGrossWeight || 0).toFixed(2)} kg`
    ];
    const totalsColCount = totalsBlockLabels.length;
    const totalsColWidth = contentWidth / totalsColCount;

    totalsBlockLabels.forEach((label, index) => {
      drawStyledBox(label, pageMargin + index * totalsColWidth, currentY, totalsColWidth, infoRowHeight, { fillColor: lightYellowBg, fontStyle: 'bold', fontSize: 7, border: true });
    });
    currentY += infoRowHeight;
    totalsBlockValues.forEach((value, index) => {
      drawStyledBox(value, pageMargin + index * totalsColWidth, currentY, totalsColWidth, infoRowHeight, { fillColor: lightYellowBg, fontSize: 7, halign: 'left', border: true });
    });
    currentY += infoRowHeight + 5;

    // --- Service Type Header Block ---
    const serviceHubText = "ROISSY HUB & Cellule S3C";
    const serviceBoxHeight = 7;
    const serviceBoxY = currentY;
    const firstColWidthForServiceHub = contentWidth * 0.30;
    const serviceTypeBoxWidth = contentWidth * 0.15; // For Prio, Eco, S3C boxes
    const weightKgBoxWidth = contentWidth - firstColWidthForServiceHub - (3 * serviceTypeBoxWidth);

    drawStyledBox(serviceHubText, pageMargin, serviceBoxY, firstColWidthForServiceHub, serviceBoxHeight, {fillColor: lightYellowBg, fontStyle: 'bold', fontSize: 7, halign: 'left'});
    
    let currentXForServiceTypes = pageMargin + firstColWidthForServiceHub;
    drawStyledBox("Prio", currentXForServiceTypes, serviceBoxY, serviceTypeBoxWidth, serviceBoxHeight, {fillColor: [0,0,255], textColor: [255,255,255], fontStyle: 'bold', fontSize: 7});
    currentXForServiceTypes += serviceTypeBoxWidth;
    drawStyledBox("Eco", currentXForServiceTypes, serviceBoxY, serviceTypeBoxWidth, serviceBoxHeight, {fillColor: [255,255,0], textColor: [0,0,0], fontStyle: 'bold', fontSize: 7});
    currentXForServiceTypes += serviceTypeBoxWidth;
    drawStyledBox("S3C", currentXForServiceTypes, serviceBoxY, serviceTypeBoxWidth, serviceBoxHeight, {fillColor: [255,190,0], textColor: [0,0,0], fontStyle: 'bold', fontSize: 7});
    currentXForServiceTypes += serviceTypeBoxWidth;
    drawStyledBox("Weight Kg", currentXForServiceTypes, serviceBoxY, weightKgBoxWidth, serviceBoxHeight, {fillColor: lightYellowBg, fontStyle: 'bold', fontSize: 7});
    currentY += serviceBoxHeight;


    // --- Main Details Table ---
    const tableHead = [["Customer", "Dispatch No", "D-OE", "Format", "Format", "Format", "Tare Weight", "Gross Weight", "Net Weight"]];
    const tableBody = details.map(detail => {
      const customerLabel = getLabelFromMap(dropdownMaps['customers'], detail.customerId, detail.customerId);
      const dispatchNo = detail.dispatchNumber || 'N/A';
      const doeLabel = getLabelFromMap(dropdownMaps['doe'], detail.doeId, detail.doeId); // Using detail.doeId as fallback
      
      const serviceKey = detail.serviceId?.toLowerCase();
      let formatPrio = '', formatEco = '', formatS3C = '';

      const formatCollectionId = serviceKey && SERVICE_FORMAT_MAPPING[serviceKey] ? SERVICE_FORMAT_MAPPING[serviceKey] : null;
      let formatDisplayValue = detail.formatId || '';
      if (formatCollectionId && detail.formatId) {
          formatDisplayValue = getLabelFromMap(dropdownMaps[formatCollectionId], detail.formatId, detail.formatId);
      } else if (detail.formatId === '') {
          formatDisplayValue = ''; // Ensure empty string if no format
      }

      if (serviceKey === 'e' || serviceKey === 'prior' || serviceKey === 'priority') {
        formatPrio = formatDisplayValue;
      } else if (serviceKey === 'c' || serviceKey === 'eco' || serviceKey === 'economy') {
        formatEco = formatDisplayValue;
      } else if (serviceKey === 's' || serviceKey === 's3c') {
        formatS3C = formatDisplayValue;
      }

      return [
        customerLabel,
        dispatchNo,
        doeLabel,
        formatPrio,
        formatEco,
        formatS3C,
        (detail.tareWeight || 0).toFixed(2),
        (detail.grossWeight || 0).toFixed(2),
        (detail.netWeight || 0).toFixed(2)
      ];
    });

    const cellStyles = {
        fillColor: lightYellowBg, 
        textColor: [0,0,0], 
        fontSize: 7,
        cellPadding: 1.5,
        halign: 'left',
        valign: 'middle',
        lineColor: [150,150,150],
        lineWidth: 0.1
    };

    autoTable(doc, { // Changed from (doc as any).autoTable
      head: tableHead,
      body: tableBody,
      startY: currentY,
      theme: 'plain',
      styles: cellStyles,
      headStyles: {
        fillColor: lightYellowBg,
        textColor: [0,0,0],
        fontStyle: 'bold',
        halign: 'center',
        lineWidth: 0.1,
        lineColor: [150,150,150]
      },
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


// --- Simple Placeholder CMR PDF ---
export const generateCmrPdf = async (shipment: Shipment): Promise<void> => {
  const pdfType = "CMR";
  const filename = `cmr-${shipment.id || 'shipment'}.pdf`;
  console.log(`[PDFService] ${pdfType} PDF: Full shipment data:`, JSON.stringify(shipment, null, 2));
  console.log(`[PDFService] ${pdfType}: generateCmrPdf CALLED. Attempting to generate: ${filename}`);

  try {
    console.log(`[PDFService] ${pdfType}: Creating new jsPDF instance...`);
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    console.log(`[PDFService] ${pdfType}: jsPDF instance created successfully.`);

    const pageMargin = 15;
    let currentY = pageMargin;

    console.log(`[PDFService] ${pdfType}: Adding Asendia Style Logo...`);
    addAsendiaStyleLogo(doc, pageMargin, currentY);
    
    const logoHeight = 10; // from addAsendiaStyleLogo
    const logoWidth = 35;  // from addAsendiaStyleLogo
    let titleX = pageMargin + logoWidth + 5; 
    let titleY = currentY + logoHeight / 2; 

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    console.log(`[PDFService] ${pdfType}: Adding title...`);
    doc.text("CMR Document - Placeholder", titleX, titleY, { baseline: 'middle' });

    currentY += logoHeight + 10; // Space below logo and title area

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    console.log(`[PDFService] ${pdfType}: Adding Shipment ID...`);
    doc.text(`Shipment ID: ${shipment.id || 'N/A'}`, pageMargin, currentY);
    currentY += 7;

    console.log(`[PDFService] ${pdfType}: Adding placeholder line 1...`);
    doc.text("This is a placeholder for the CMR document.", pageMargin, currentY);
    currentY += 7;
    console.log(`[PDFService] ${pdfType}: Adding placeholder line 2...`);
    doc.text("Actual CMR layout will be implemented later.", pageMargin, currentY);
    
    console.log(`[PDFService] ${pdfType}: Content added to PDF.`);
    triggerDownload(doc, filename, pdfType);
    console.log(`[PDFService] ${pdfType}: triggerDownload completed for ${filename}.`);

  } catch (error) {
    const errorMsg = `Error in generateCmrPdf function for ${filename}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[PDFService] ${pdfType}: ${errorMsg}`, error);
    alert(`Error creating ${pdfType} PDF for ${shipment.id}: ${errorMsg}`);
  }
};
