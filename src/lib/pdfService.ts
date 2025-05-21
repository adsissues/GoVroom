
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
    Timestamp,
} from 'firebase/firestore';
import { detailFromFirestore } from '@/lib/firebase/shipmentsService'; // Assuming this handles Timestamp conversion correctly
import { getDropdownOptionsMap } from '@/lib/firebase/dropdownService';
import { SERVICE_FORMAT_MAPPING, BAG_WEIGHT_MULTIPLIER } from '@/lib/constants';
import { format } from 'date-fns';

// Helper function to trigger download
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
      pdfDataUriLength > 100 && // Check for a reasonable length
      pdfDataUri.includes(';base64,') && // Check for base64 encoding marker
      pdfDataUri.startsWith('data:application/pdf;'); // Check for PDF mime type

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
  if (!map) return value; // Fallback to value if map is undefined
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

    doc.text(text, textX, textY, { baseline: 'middle', align: 'left'});

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

// Helper to determine service category for placing formatId in the correct column
const getServiceCategory = (serviceId: string | undefined, dropdownMaps: Record<string, Record<string, string>>): "Prio" | "Eco" | "S3C" | "Other" => {
    if (!serviceId) return "Other";
    const serviceIdLower = serviceId.toLowerCase();
    
    // Check if serviceId itself is a key or if its label implies the category
    const serviceLabel = dropdownMaps['services']?.[serviceId]?.toLowerCase() || serviceIdLower;

    if (SERVICE_FORMAT_MAPPING[serviceIdLower] === 'formats_prior' || serviceLabel.includes('prior')) return "Prio";
    if (SERVICE_FORMAT_MAPPING[serviceIdLower] === 'formats_eco' || serviceLabel.includes('eco')) return "Eco";
    if (SERVICE_FORMAT_MAPPING[serviceIdLower] === 'formats_s3c' || serviceLabel.includes('s3c')) return "S3C";
    
    return "Other";
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
    const contentWidth = pageWidth - 2 * pageMargin;
    let currentY = pageMargin;
    const lightYellowBg = [255, 248, 220]; 
    const cellHeight = 7; 
    const valueRowHeight = 7;
    const smallFontSize = 7;
    const headerFontSize = 8;
    const titleFontSize = 10;

    addAsendiaStyleLogo(doc, pageMargin, currentY);

    doc.setFontSize(titleFontSize);
    doc.setFont('helvetica', 'bold');
    const reportTitle = "SHIPMENT REPORT / ASENDIA UK";
    const titleWidth = doc.getStringUnitWidth(reportTitle) * titleFontSize / doc.internal.scaleFactor;
    doc.text(reportTitle, (pageWidth - titleWidth) / 2, currentY + 7);

    doc.setFontSize(smallFontSize);
    doc.setFont('helvetica', 'normal');
    const dateTextX = pageWidth - pageMargin - 50; 
    doc.text(`Date de départ: ${formatDateForPdf(shipment.departureDate)}`, dateTextX, currentY + 5, { align: 'left' });
    doc.text(`Date d'arrivée: ${formatDateForPdf(shipment.arrivalDate)}`, dateTextX, currentY + 5 + 4, { align: 'left' });
    currentY += 15; 

    const shipmentInfoHeaders = ["Transporteur", "Driver Name", "Truck Reg No", "Trailer Reg No", "Seal Number"];
    const shipmentInfoValues = [
      getLabelFromMap(dropdownMaps['carriers'], shipment.carrierId, shipment.carrierId),
      shipment.driverName || 'N/A',
      shipment.truckRegistration || 'N/A',
      shipment.trailerRegistration || 'N/A',
      shipment.sealNumber || 'N/A'
    ];
    const colWidthShipmentInfo = contentWidth / shipmentInfoHeaders.length;

    doc.setFontSize(headerFontSize);
    doc.setFont('helvetica', 'bold');
    shipmentInfoHeaders.forEach((header, index) => {
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
      doc.rect(pageMargin + index * colWidthShipmentInfo, currentY, colWidthShipmentInfo, cellHeight, 'FD');
      doc.text(header, pageMargin + index * colWidthShipmentInfo + colWidthShipmentInfo / 2, currentY + cellHeight / 2 + 1, { align: 'center', baseline: 'middle' });
    });
    currentY += cellHeight;

    doc.setFontSize(smallFontSize);
    doc.setFont('helvetica', 'normal');
    shipmentInfoValues.forEach((value, index) => {
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]); // Ensure value row has background
      doc.rect(pageMargin + index * colWidthShipmentInfo, currentY, colWidthShipmentInfo, valueRowHeight, 'FD'); // Draw rect for value row
      doc.text(value, pageMargin + index * colWidthShipmentInfo + 2, currentY + valueRowHeight / 2 + 1, { baseline: 'middle' });
    });
    currentY += valueRowHeight + 3; 

    const totalsHeaders = ["Total Pallets", "Total Bags", "Total Net Weight", "Total Gross Weight"];
    const totalsValues = [
      (shipment.totalPallets || 0).toString(),
      (shipment.totalBags || 0).toString(),
      `${(shipment.totalNetWeight || 0).toFixed(2)} kg`,
      `${(shipment.totalGrossWeight || 0).toFixed(2)} kg`
    ];
    const colWidthTotals = contentWidth / totalsHeaders.length;

    doc.setFontSize(headerFontSize);
    doc.setFont('helvetica', 'bold');
    totalsHeaders.forEach((header, index) => {
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
      doc.rect(pageMargin + index * colWidthTotals, currentY, colWidthTotals, cellHeight, 'FD');
      doc.text(header, pageMargin + index * colWidthTotals + colWidthTotals / 2, currentY + cellHeight / 2 + 1, { align: 'center', baseline: 'middle' });
    });
    currentY += cellHeight;

    doc.setFontSize(smallFontSize);
    doc.setFont('helvetica', 'normal');
    totalsValues.forEach((value, index) => {
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]); // Ensure value row has background
      doc.rect(pageMargin + index * colWidthTotals, currentY, colWidthTotals, valueRowHeight, 'FD'); // Draw rect for value row
      doc.text(value, pageMargin + index * colWidthTotals + 2, currentY + valueRowHeight / 2 + 1, { baseline: 'middle' });
    });
    currentY += valueRowHeight + 3; 

    doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
    doc.rect(pageMargin, currentY, contentWidth, cellHeight, 'FD');
    doc.setFontSize(headerFontSize);
    doc.setFont('helvetica', 'bold');
    doc.text("ROISSY HUB & Cellule S3C", pageMargin + 2, currentY + cellHeight / 2 + 1, { baseline: 'middle' });
    
    const serviceBoxWidth = 15; 
    const serviceBoxSpacing = 1;
    let serviceBoxX = pageMargin + contentWidth * 0.40; 

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');

    doc.setFillColor(0, 0, 200); 
    doc.rect(serviceBoxX, currentY + 0.5, serviceBoxWidth, cellHeight -1 , 'FD');
    doc.setTextColor(255, 255, 255); 
    doc.text("Prio", serviceBoxX + serviceBoxWidth / 2, currentY + cellHeight / 2 + 0.5, { align: 'center', baseline: 'middle' });
    serviceBoxX += serviceBoxWidth + serviceBoxSpacing;

    doc.setFillColor(255, 255, 0); 
    doc.rect(serviceBoxX, currentY + 0.5, serviceBoxWidth, cellHeight - 1, 'FD');
    doc.setTextColor(0, 0, 0); 
    doc.text("Eco", serviceBoxX + serviceBoxWidth / 2, currentY + cellHeight / 2 + 0.5, { align: 'center', baseline: 'middle' });
    serviceBoxX += serviceBoxWidth + serviceBoxSpacing;
    
    doc.setFillColor(230, 180, 70); 
    doc.rect(serviceBoxX, currentY + 0.5, serviceBoxWidth, cellHeight - 1, 'FD');
    doc.setTextColor(0, 0, 0); 
    doc.text("S3C", serviceBoxX + serviceBoxWidth / 2, currentY + cellHeight / 2 + 0.5, { align: 'center', baseline: 'middle' });
    
    const weightKgTextX = serviceBoxX + serviceBoxWidth + serviceBoxSpacing + 5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0,0,0);
    doc.text("Weight Kg", weightKgTextX , currentY + cellHeight / 2 + 1, { baseline: 'middle' });
    currentY += cellHeight;

    const tableHead = [['Customer', 'Dispatch No', 'D-OE', 'Format', 'Format', 'Format', 'Tare Weight', 'Gross Weight', 'Net Weight']];
    
    const tableBody = details.map(detail => {
      const serviceCategory = getServiceCategory(detail.serviceId, dropdownMaps);
      const formatCollectionId = SERVICE_FORMAT_MAPPING[detail.serviceId?.toLowerCase() || ''] || null;
      const formatValue = formatCollectionId ? getLabelFromMap(dropdownMaps[formatCollectionId], detail.formatId, detail.formatId) : (detail.formatId || 'N/A');

      return [
        getLabelFromMap(dropdownMaps['customers'], detail.customerId, detail.customerId),
        detail.dispatchNumber || 'N/A',
        getLabelFromMap(dropdownMaps['doe'], detail.doeId, detail.doeId || 'N/A'),
        serviceCategory === "Prio" ? formatValue : '',
        serviceCategory === "Eco" ? formatValue : '',
        serviceCategory === "S3C" ? formatValue : '',
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
        fontSize: smallFontSize -1, // Slightly smaller for table body
        cellPadding: 1,
        lineColor: [0,0,0], 
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: lightYellowBg, 
        textColor: [0,0,0], 
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        lineColor: [0,0,0],
        lineWidth: 0.1,
        fontSize: headerFontSize -1, // Slightly smaller for header
      },
      bodyStyles: {
        fillColor: lightYellowBg, 
        lineColor: [0,0,0],
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 35 }, 
        1: { halign: 'center', cellWidth: 20 }, 
        2: { halign: 'center', cellWidth: 15 }, 
        3: { halign: 'center', cellWidth: 20 }, 
        4: { halign: 'center', cellWidth: 20 }, 
        5: { halign: 'center', cellWidth: 20 }, 
        6: { halign: 'right', cellWidth: 20 }, 
        7: { halign: 'right', cellWidth: 20 }, 
        8: { halign: 'right', cellWidth: 20 }, 
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

    // 1. Add Logo
    addAsendiaStyleLogo(doc, pageMargin, currentY);
    currentY += 5; // Move below logo for next elements

    // 2. Add Title "CMR Document - Placeholder"
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const title = "CMR Document - Placeholder";
    // Position title to the right of where the logo ends
    const titleX = pageMargin + 35 + 5; // logoWidth (35mm) + some space (5mm)
    doc.text(title, titleX, currentY); // Align with the vertical position of the logo's bottom or slightly below its center
    currentY += 15; // Space after title

    // 3. Add Shipment ID and other placeholder text, aligned left below logo area
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Shipment ID: ${shipment.id || 'N/A'}`, pageMargin, currentY);
    currentY += 7;
    doc.text("This is a placeholder for the CMR document content.", pageMargin, currentY);
    currentY += 7;
    doc.text("Detailed layout and data mapping will be implemented later.", pageMargin, currentY);

    console.log(`[PDFService] ${pdfType}: Simplified content added to PDF.`);
    triggerDownload(doc, filename, pdfType);
    console.log(`[PDFService] ${pdfType}: triggerDownload completed for ${filename}.`);

  } catch (error) {
    const errorMsg = `Error in generateCmrPdf function for ${filename}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[PDFService] ${pdfType}: ${errorMsg}`, error);
    alert(`Error creating ${pdfType} PDF for ${shipment.id}: ${errorMsg}`);
  }
};

    