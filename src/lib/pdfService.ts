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
  try {
    const pdfDataUri = doc.output('datauristring');
    const link = document.createElement('a');
    link.href = pdfDataUri;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error(`Error in triggerDownload for ${filename}:`, error);
    alert(`An error occurred while trying to download ${filename}: ${error instanceof Error ? error.message : String(error)}`);
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

const getLabelFromMap = (map: Record<string, string> | undefined, value: string | undefined, defaultValue = 'N/A'): string => {
  if (!value) return defaultValue;
  if (!map) return value;
  return map[value] || value;
};

const addAsendiaStyleLogo = (doc: jsPDF, x: number, y: number) => {
  const logoWidth = 35;
  const logoHeight = 10;
  doc.setFillColor(0, 90, 106);
  doc.rect(x, y, logoWidth, logoHeight, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text("asendia", x + logoWidth / 2, y + logoHeight / 2, { 
    align: 'center', 
    baseline: 'middle'
  });
  doc.setTextColor(0, 0, 0);
};

const getShipmentDetails = async (shipmentId: string): Promise<ShipmentDetail[]> => {
  if (!shipmentId) return [];
  const detailsCollectionRef = collection(db, 'shipments', shipmentId, 'details');
  const q = query(detailsCollectionRef, orderBy('createdAt', 'asc'));
  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => detailFromFirestore(doc as QueryDocumentSnapshot<DocumentData>));
  } catch (error) {
    console.error(`Error fetching details for shipment ${shipmentId}:`, error);
    return [];
  }
};

export const generatePreAlertPdf = async (shipment: Shipment): Promise<void> => {
  const pdfType = "Pre-Alert";
  const now = new Date();
  const filename = `Pre-Alert, ${shipment.sealNumber || "NoSeal"}, ${formatDateFns(now, "dd-MM-yy")}, ${formatDateFns(now, "HHmmss")}.pdf`;

  try {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const details = await getShipmentDetails(shipment.id);
    const dropdownMaps = await getDropdownOptionsMap(['carriers', 'customers', 'doe']);

    // Page setup
    const pageMargin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - 2 * pageMargin;
    let currentY = pageMargin;
    const lightYellowBg = [255, 253, 230];

    // Header with logo and dates
    addAsendiaStyleLogo(doc, pageMargin, currentY);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("SHIPMENT REPORT / ASENDIA UK", pageWidth / 2, currentY + 5, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date de départ: ${formatDateForPdf(shipment.departureDate)}`, pageWidth - pageMargin - 40, currentY + 3);
    doc.text(`Date d'arrivée: ${formatDateForPdf(shipment.arrivalDate)}`, pageWidth - pageMargin - 40, currentY + 7);
    currentY += 18;

    // Shipment info block
    const infoCells = [
      { label: "Transporteur", value: getLabelFromMap(dropdownMaps['carriers'], shipment.carrierId) },
      { label: "Driver Name", value: shipment.driverName || 'N/A' },
      { label: "Truck Reg No", value: shipment.truckRegistration || 'N/A' },
      { label: "Trailer Reg No", value: shipment.trailerRegistration || 'N/A' },
      { label: "Seal Number", value: shipment.sealNumber || 'N/A' }
    ];
    
    const cellWidth = contentWidth / infoCells.length;
    infoCells.forEach((item, index) => {
      const cellX = pageMargin + (index * cellWidth);
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
      doc.rect(cellX, currentY, cellWidth, 10, 'FD');
      doc.setFontSize(6.5);
      doc.text(item.label, cellX + cellWidth / 2, currentY + 2, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(item.value, cellX + cellWidth / 2, currentY + 6, { align: 'center' });
    });
    currentY += 15;

    // Totals block
    const totalCells = [
      { label: "Total Pallets", value: (shipment.totalPallets || 0).toString() },
      { label: "Total Bags", value: (shipment.totalBags || 0).toString() },
      { label: "Total Net Weight", value: `${(shipment.totalNetWeight || 0).toFixed(2)} kg` },
      { label: "Total Gross Weight", value: `${(shipment.totalGrossWeight || 0).toFixed(2)} kg` }
    ];
    
    totalCells.forEach((item, index) => {
      const cellX = pageMargin + (index * cellWidth);
      doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
      doc.rect(cellX, currentY, cellWidth, 10, 'FD');
      doc.setFontSize(6.5);
      doc.text(item.label, cellX + cellWidth / 2, currentY + 2, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(item.value, cellX + cellWidth / 2, currentY + 6, { align: 'center' });
    });
    currentY += 15;

    // Table setup
    const customerColWidth = 30;
    const dispatchNoColWidth = 20;
    const doeColWidth = 15;
    const formatColWidth = 18;
    const weightColWidth = (contentWidth - customerColWidth - dispatchNoColWidth - doeColWidth - (formatColWidth * 3)) / 3;

    // Table header
    doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
    doc.rect(pageMargin, currentY, customerColWidth + dispatchNoColWidth + doeColWidth, 7, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("ROISSY HUB & Cellule S3C", pageMargin + (customerColWidth + dispatchNoColWidth + doeColWidth) / 2, currentY + 4, { align: 'center' });

    // Service type boxes
    const serviceBoxes = [
      { x: pageMargin + customerColWidth + dispatchNoColWidth + doeColWidth, color: [0, 0, 255], text: "Prio", textColor: [255, 255, 255] },
      { x: pageMargin + customerColWidth + dispatchNoColWidth + doeColWidth + formatColWidth, color: [255, 255, 0], text: "Eco", textColor: [0, 0, 0] },
      { x: pageMargin + customerColWidth + dispatchNoColWidth + doeColWidth + (formatColWidth * 2), color: [230, 159, 0], text: "S3C", textColor: [0, 0, 0] }
    ];

    serviceBoxes.forEach(box => {
      doc.setFillColor(box.color[0], box.color[1], box.color[2]);
      doc.rect(box.x, currentY, formatColWidth, 7, 'FD');
      doc.setTextColor(box.textColor[0], box.textColor[1], box.textColor[2]);
      doc.text(box.text, box.x + formatColWidth / 2, currentY + 4, { align: 'center' });
    });

    // Weight header
    doc.setFillColor(lightYellowBg[0], lightYellowBg[1], lightYellowBg[2]);
    doc.rect(pageMargin + customerColWidth + dispatchNoColWidth + doeColWidth + (formatColWidth * 3), currentY, 
             weightColWidth * 3, 7, 'FD');
    doc.setTextColor(0, 0, 0);
    doc.text("Weight Kg", pageMargin + customerColWidth + dispatchNoColWidth + doeColWidth + (formatColWidth * 3) + (weightColWidth * 1.5), 
             currentY + 4, { align: 'center' });
    currentY += 7;

    // Main table data
    const tableHeadData = [['Customer', 'Dispatch No', 'D-OE', 'Format', 'Format', 'Format', 'Tare Weight', 'Gross Weight', 'Net Weight']];
    const tableBodyData = details.map(detail => {
      const serviceKey = detail.serviceId?.toLowerCase();
      let formatPrio = '', formatEco = '', formatS3C = '';
      
      if (serviceKey === 'e' || serviceKey === 'prior' || serviceKey === 'priority') formatPrio = detail.formatId || '';
      else if (serviceKey === 'c' || serviceKey === 'eco' || serviceKey === 'economy') formatEco = detail.formatId || '';
      else if (serviceKey === 's' || serviceKey === 's3c') formatS3C = detail.formatId || '';

      return [
        getLabelFromMap(dropdownMaps['customers'], detail.customerId),
        detail.dispatchNumber || 'N/A',
        getLabelFromMap(dropdownMaps['doe'], detail.doeId),
        formatPrio,
        formatEco,
        formatS3C,
        (detail.tareWeight || 0).toFixed(2),
        (detail.grossWeight || 0).toFixed(2),
        (detail.netWeight || 0).toFixed(2),
      ];
    });

    // Generate table
    autoTable(doc, {
      head: tableHeadData,
      body: tableBodyData,
      startY: currentY,
      theme: 'grid',
      showHead: 'everyPage',
      headStyles: {
        fillColor: lightYellowBg,
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fillColor: lightYellowBg,
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: customerColWidth, halign: 'left' },
        1: { cellWidth: dispatchNoColWidth },
        2: { cellWidth: doeColWidth },
        3: { cellWidth: formatColWidth },
        4: { cellWidth: formatColWidth },
        5: { cellWidth: formatColWidth },
        6: { cellWidth: weightColWidth, halign: 'right' },
        7: { cellWidth: weightColWidth, halign: 'right' },
        8: { cellWidth: weightColWidth, halign: 'right' }
      },
      margin: { left: pageMargin, right: pageMargin },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          addAsendiaStyleLogo(doc, pageMargin, pageMargin);
        }
        doc.setFontSize(8);
        doc.text(`Page ${data.pageNumber}`, pageWidth - pageMargin, doc.internal.pageSize.getHeight() - 5);
      }
    });

    triggerDownload(doc, filename, pdfType);
  } catch (error) {
    console.error(`Error generating Pre-Alert PDF: ${error}`);
    alert(`Error creating Pre-Alert PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const generateCmrPdf = async (shipment: Shipment): Promise<void> => {
  const pdfType = "CMR";
  const now = new Date();
  const filename = `CMR, ${shipment.sealNumber || "NoSeal"}, ${formatDateFns(now, "dd-MM-yy")}, ${formatDateFns(now, "HHmmss")}.pdf`;

  try {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const dropdownMaps = await getDropdownOptionsMap(['carriers']);
    const carrierName = getLabelFromMap(dropdownMaps['carriers'], shipment.carrierId);

    const pageMargin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - 2 * pageMargin;
    let currentY = pageMargin;

    // Header with logo
    addAsendiaStyleLogo(doc, pageMargin, currentY);

    // CRM logo
    const crmLogoX = pageMargin + 35 + 2;
    const crmLogoRadius = 5;
    doc.setFillColor(200, 200, 200);
    doc.circle(crmLogoX + crmLogoRadius, currentY + crmLogoRadius, crmLogoRadius, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("CRM", crmLogoX + crmLogoRadius, currentY + crmLogoRadius, { align: 'center', baseline: 'middle' });

    // Title
    const titleX = crmLogoX + crmLogoRadius * 2 + 5;
    doc.setFontSize(7);
    doc.text("LETTRE DE VOITURE INTERNATIONALE", titleX, currentY + 3);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text("INTERNATIONAL CONSIGNMENT NOTE", titleX, currentY + 8);
    currentY += 12;

    // Two-column layout
    const col1Width = contentWidth * 0.5;
    const col2Width = contentWidth * 0.5;
    const col1X = pageMargin;
    const col2X = pageMargin + col1Width;

    // Box 1: Sender
    let boxHeight = 30;
    const senderText = `1 Sender (Name, Address, Country) Expéditeur (Nom, Adresse, Pays)\n\n${shipment.senderAddress || 'Asendia UK\nUnit 8-12 The Heathrow Estate\nSilver Jubilee way\nHounslow\nTW4 6NF'}`;
    doc.rect(col1X, currentY, col1Width, boxHeight);
    doc.setFontSize(7);
    doc.text(senderText, col1X + 2, currentY + 4, { maxWidth: col1Width - 4 });

    // Box 2: Customs Reference
    doc.rect(col2X, currentY, col2Width, boxHeight / 2);
    doc.text("2 Customs Reference/Status Ref douane/Statut\n\nN/A", col2X + 2, currentY + 4, { maxWidth: col2Width - 4 });

    // Box 3: Senders Agents Reference
    doc.rect(col2X, currentY + boxHeight / 2, col2Width, boxHeight / 2);
    doc.text("3 Senders Agents Reference Ref expéditeur de l'agent\n\nN/A", col2X + 2, currentY + boxHeight / 2 + 4, { maxWidth: col2Width - 4 });
    currentY += boxHeight;

    // Box 4: Consignee
    boxHeight = 30;
    const consigneeText = `4 Consignee, Final Delivery Point (Name, Address) Destinataire (Nom, Adresse, Pays)\n\n${shipment.consigneeAddress || 'LA POSTE ROISSY HUB\n7 Rue Du Haute de Laval\n93290 Tremblay-en-France\nFrance'}`;
    doc.rect(col1X, currentY, col1Width, boxHeight);
    doc.setFont('helvetica', 'bold');
    doc.text(consigneeText, col1X + 2, currentY + 4, { maxWidth: col1Width - 4 });

    // Box 5: Carrier
    const truckTrailer = `${shipment.truckRegistration || 'N/A'} / ${shipment.trailerRegistration || 'N/A'}`;
    const carrierText = `5 Carrier (Name, Address, Country) Transporteur (Nom, Adresse, Pays)\n\nCarrier Name: ${carrierName}\nTruck & Trailer: ${truckTrailer}`;
    doc.rect(col2X, currentY, col2Width, boxHeight);
    doc.setTextColor(255, 0, 0);
    doc.text(carrierText, col2X + 2, currentY + 4, { maxWidth: col2Width - 4 });
    doc.setTextColor(0, 0, 0);
    currentY += boxHeight;

    // Box 6: Senders instructions
    boxHeight = 20;
    doc.rect(col1X, currentY, col1Width, boxHeight);
    doc.setFont('helvetica', 'normal');
    doc.text("6 Senders instructions for customs, etc... Instructions de l'expéditeur (optionel)\n\nN/A", col1X + 2, currentY + 4, { maxWidth: col1Width - 4 });

    // Box 7: Successive Carrier
    doc.rect(col2X, currentY, col2Width, boxHeight);
    doc.text("7 Successive Carrier Transporteurs successifs\n\nN/A", col2X + 2, currentY + 4, { maxWidth: col2Width - 4 });
    currentY += boxHeight;

    // Box 8: Place and date of taking over the goods
    boxHeight = 20;
    const dynamicTakingOverText = `${shipment.senderAddress || 'Asendia UK, Unit 5, The Hub, Solent Business Park, Fareham, PO15 7FH'}, UK ${formatDateForPdf(shipment.departureDate)}`;
    const takingOverGoodsTextLines = [
      `8 Place and date of taking over the goods (place, country, date)`,
      `Lieu et date de prise en charge des marchandises (lieu, pays, date)`,
      ``,
      dynamicTakingOverText
    ];
    doc.rect(col1X, currentY, contentWidth, boxHeight);
    doc.text(takingOverGoodsTextLines, col1X + 2, currentY + 4, { maxWidth: contentWidth - 4 });
    currentY += boxHeight;

    // Goods table header
    const goodsCol1Width = contentWidth * 0.4;
    const goodsCol2Width = contentWidth * 0.2;
    const goodsCol3Width = contentWidth * 0.2;
    const goodsCol4Width = contentWidth * 0.2;
    let goodsTableHeaderHeight = 10;

    doc.rect(col1X, currentY, goodsCol1Width, goodsTableHeaderHeight);
    doc.text("9 Marks & Nos; No & Kind of Packages; Description of Goods\nMarques et Nos; Nb et nature des colis; Désignation des marchandises", col1X + 2, currentY + 2, { maxWidth: goodsCol1Width - 4, fontSize: 6 });

    doc.rect(col1X + goodsCol1Width, currentY, goodsCol2Width, goodsTableHeaderHeight);
    doc.text("10 No. of packages\n(statistical)", col1X + goodsCol1Width + 2, currentY + 2, { maxWidth: goodsCol2Width - 4, fontSize: 6 });

    doc.rect(col1X + goodsCol1Width + goodsCol2Width, currentY, goodsCol3Width, goodsTableHeaderHeight);
    doc.text("11 Gross Weight (kg)\nPoids Brut (kg)", col1X + goodsCol1Width + goodsCol2Width + 2, currentY + 2, { maxWidth: goodsCol3Width - 4, fontSize: 6 });

    doc.rect(col1X + goodsCol1Width + goodsCol2Width + goodsCol3Width, currentY, goodsCol4Width, goodsTableHeaderHeight);
    doc.text("12 Volume (m³)\nCubage (m³)", col1X + goodsCol1Width + goodsCol2Width + goodsCol3Width + 2, currentY + 2, { maxWidth: goodsCol4Width - 4, fontSize: 6 });
    currentY += goodsTableHeaderHeight;

    // Goods data
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
    doc.rect(col1X, currentY, goodsCol1Width, goodsDataHeight);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 0, 0);
    doc.text(goodsDescTextLines, col1X + 2, currentY + 4, { maxWidth: goodsCol1Width - 4 });
    doc.setTextColor(0, 0, 0);

    doc.rect(col1X + goodsCol1Width, currentY, goodsCol2Width, goodsDataHeight);

    const grossWeightVal = shipment.totalGrossWeight || 0;
    const grossWeightOfBags = (shipment.totalBags || 0) * BAG_WEIGHT_MULTIPLIER;
    const totalCalculatedWeight = grossWeightVal + grossWeightOfBags;

    let weightTextLines = [
      `${grossWeightVal.toFixed(2)} Kgs`,
      ``,
      `${grossWeightOfBags.toFixed(2)} Kgs`,
      ``,
      ``,
      `TOTAL: ${totalCalculatedWeight.toFixed(2)} Kgs`
    ];
    doc.rect(col1X + goodsCol1Width + goodsCol2Width, currentY, goodsCol3Width, goodsDataHeight);
    doc.text(weightTextLines, col1X + goodsCol1Width + goodsCol2Width + 2, currentY + 4, { maxWidth: goodsCol3Width - 4, align: 'right' });

    doc.rect(col1X + goodsCol1Width + goodsCol2Width + goodsCol3Width, currentY, goodsCol4Width, goodsDataHeight);
    currentY += goodsDataHeight;

    // Box 13: Carriage Charges
    boxHeight = 7;
    doc.rect(col1X, currentY, contentWidth, boxHeight);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text("13 Carriage Charges Prix de transport", col1X + 2, currentY + 4);
    currentY += boxHeight;

    // Boxes 14 & 15
    const midPointXBox1415 = pageMargin + contentWidth * 0.6;
    const resWidth = midPointXBox1415 - pageMargin;
    const docAttachWidth = contentWidth - resWidth;
    boxHeight = 15;
    doc.rect(col1X, currentY, resWidth, boxHeight);
    doc.text("14 Reservations Réserves", col1X + 2, currentY + 4, { maxWidth: resWidth - 4, fontSize: 7 });

    doc.rect(midPointXBox1415, currentY, docAttachWidth, boxHeight);
    doc.text("15 Documents attached Documents Annexes (optional)", midPointXBox1415 + 2, currentY + 4, { maxWidth: docAttachWidth - 4, fontSize: 7 });
    currentY += boxHeight;

    // Box 16: Special agreements
    boxHeight = 10;
    doc.rect(col1X, currentY, contentWidth, boxHeight);
    doc.text("16 Special agreements Conventions particulières (optional)", col1X + 2, currentY + 4, { maxWidth: contentWidth - 4, fontSize: 7 });
    currentY += boxHeight;

    // Signature boxes
    const sigBoxWidth = contentWidth / 3;
    boxHeight = 30;

    const consigneeFirstLine = (shipment.consigneeAddress || 'Consignee, Destination Country').split('\n')[0];
    const goodsReceivedText = `17 Goods Received/Marchandises Recues\n\n\n\nDate: ${formatDateForPdf(Timestamp.now())}\n${consigneeFirstLine}`;
    doc.rect(col1X, currentY, sigBoxWidth, boxHeight);
    doc.text(goodsReceivedText, col1X + 2, currentY + 4, { maxWidth: sigBoxWidth - 4, fontSize: 7 });

    doc.rect(col1X + sigBoxWidth, currentY, sigBoxWidth, boxHeight);
    doc.text("18 Signature and stamp of Carrier/Signature du Transporteur", col1X + sigBoxWidth + 2, currentY + 4, { maxWidth: sigBoxWidth - 4, fontSize: 7 });

    doc.rect(col1X + sigBoxWidth * 2, currentY, sigBoxWidth, boxHeight);
    doc.text("19 Place and date, Signature Lieu et date, Signature", col1X + sigBoxWidth * 2 + 2, currentY + 4, { maxWidth: sigBoxWidth - 4, fontSize: 7 });
    currentY += boxHeight;

    // Date stamps
    currentY += 2;
    doc.setFontSize(7);
    doc.text(`Date: ${formatDateForPdf(Timestamp.now())}`, col1X + 5, currentY + 5);
    doc.text(`Date: ${formatDateForPdf(Timestamp.now())}`, col1X + sigBoxWidth + 5, currentY + 5);
    doc.text(`Date: __ / __ / __`, col1X + sigBoxWidth * 2 + 5, currentY + 5);

    triggerDownload(doc, filename, pdfType);
  } catch (error) {
    console.error(`Error generating CMR PDF: ${error}`);
    alert(`Error creating CMR PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
};