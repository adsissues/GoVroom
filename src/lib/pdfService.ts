
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

// Shared helper functions
const triggerDownload = (doc: jsPDF, filename: string): void => {
  try {
    const pdfDataUri = doc.output('datauristring');
    const link = document.createElement('a');
    link.href = pdfDataUri;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Download error:', error);
    alert(`Download failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const formatDateForPdf = (timestamp?: Timestamp): string => {
  if (!timestamp) return 'N/A';
  try {
    return formatDateFns(timestamp.toDate(), 'dd/MM/yyyy');
  } catch {
    return 'Invalid Date';
  }
};

const getLabelFromMap = (map: Record<string, string> | undefined, value: string | undefined): string => {
  if (!value || !map) return value || 'N/A';
  return map[value] || value;
};

const addAsendiaLogo = (doc: jsPDF, x: number, y: number): void => {
  const width = 35;
  const height = 10;
  doc.setFillColor(0, 90, 106);
  doc.rect(x, y, width, height, 'F');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('asendia', x + width/2, y + height/2, { align: 'center', baseline: 'middle' });
  doc.setTextColor(0, 0, 0);
};

const getShipmentDetails = async (shipmentId: string): Promise<ShipmentDetail[]> => {
  if (!shipmentId) return [];
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'shipments', shipmentId, 'details'),
        orderBy('createdAt', 'asc')
      )
    );
    return snapshot.docs.map(doc => detailFromFirestore(doc as QueryDocumentSnapshot<DocumentData>));
  } catch (error) {
    console.error('Error fetching details:', error);
    return [];
  }
};


// Pre-Alert PDF Generator
export const generatePreAlertPdf = async (shipment: Shipment): Promise<void> => {
  const now = new Date();
  const filename = `Pre-Alert, ${shipment.sealNumber || 'NoSeal'}, ${formatDateFns(now, 'dd-MM-yy')}, ${formatDateFns(now, 'HHmmss')}.pdf`;

  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const details = await getShipmentDetails(shipment.id);
    const dropdownMaps = await getDropdownOptionsMap(['carriers', 'customers', 'doe']);

    // Page setup
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - 2 * margin;
    let yPos = margin;
    const highlightColor = [255, 253, 230];

    // First page header
    addAsendiaLogo(doc, margin, yPos);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('SHIPMENT REPORT / ASENDIA UK', pageWidth/2, yPos + 5, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date de départ: ${formatDateForPdf(shipment.departureDate)}`, pageWidth - margin - 40, yPos + 3);
    doc.text(`Date d'arrivée: ${formatDateForPdf(shipment.arrivalDate)}`, pageWidth - margin - 40, yPos + 7);
    yPos += 18;

    // Generate table data
    const headers = ['Customer', 'Dispatch No', 'D-OE', 'Format', 'Format', 'Format', 'Tare Weight', 'Gross Weight', 'Net Weight'];
    const bodyData = details.map(detail => {
      const serviceKey = detail.serviceId?.toLowerCase();
      const formats = {
        prio: (serviceKey === 'e' || serviceKey === 'prior' || serviceKey === 'priority') ? detail.formatId || '' : '',
        eco: (serviceKey === 'c' || serviceKey === 'eco' || serviceKey === 'economy') ? detail.formatId || '' : '',
        s3c: (serviceKey === 's' || serviceKey === 's3c') ? detail.formatId || '' : ''
      };

      return [
        getLabelFromMap(dropdownMaps.customers, detail.customerId),
        detail.dispatchNumber || 'N/A',
        getLabelFromMap(dropdownMaps.doe, detail.doeId),
        formats.prio,
        formats.eco,
        formats.s3c,
        (detail.tareWeight || 0).toFixed(2),
        (detail.grossWeight || 0).toFixed(2),
        (detail.netWeight || 0).toFixed(2)
      ];
    });

    // Generate table
    autoTable(doc, {
      head: [headers],
      body: bodyData,
      startY: yPos,
      theme: 'grid',
      showHead: 'everyPage',
      headStyles: {
        fillColor: highlightColor,
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fillColor: highlightColor,
        halign: 'center'
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          doc.setFontSize(8);
          doc.text(`Page ${data.pageNumber}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 5);
        }
      }
    });

    triggerDownload(doc, filename);
  } catch (error) {
    console.error('Pre-Alert PDF error:', error);
    alert(`Pre-Alert generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// CMR PDF Generator
export const generateCmrPdf = async (shipment: Shipment): Promise<void> => {
  const now = new Date();
  const filename = `CMR, ${shipment.sealNumber || 'NoSeal'}, ${formatDateFns(now, 'dd-MM-yy')}, ${formatDateFns(now, 'HHmmss')}.pdf`;

  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const dropdownMaps = await getDropdownOptionsMap(['carriers']);
    const carrierName = getLabelFromMap(dropdownMaps.carriers, shipment.carrierId);

    // Page setup
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - 2 * margin;
    let yPos = margin;

    // Header with logo
    addAsendiaLogo(doc, margin, yPos);

    // CRM title
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text("INTERNATIONAL CONSIGNMENT NOTE", margin + 45, yPos + 8);
    yPos += 15;

    // Two-column layout
    const colWidth = contentWidth / 2;
    const leftCol = margin;
    const rightCol = margin + colWidth;

    // Sender information
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`1 Sender (Name, Address, Country)\n${shipment.senderAddress || 'Asendia UK\nUnit 8-12 The Heathrow Estate'}`, leftCol + 2, yPos + 5);
    doc.rect(leftCol, yPos, colWidth, 30);

    // Carrier information
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 0, 0);
    const carrierText = `5 Carrier (Name, Address, Country)\n${carrierName}\nTruck: ${shipment.truckRegistration || 'N/A'}\nTrailer: ${shipment.trailerRegistration || 'N/A'}`;
    doc.text(carrierText, rightCol + 2, yPos + 5);
    doc.setTextColor(0, 0, 0);
    doc.rect(rightCol, yPos, colWidth, 30);
    yPos += 30;

    // Goods description
    doc.setFontSize(8);
    doc.text(`9 Description of Goods\nCross border eCommerce B2C parcels\nPallets: ${shipment.totalPallets || 0}\nBags: ${shipment.totalBags || 0}\nSeal: ${shipment.sealNumber || 'N/A'}`, leftCol + 2, yPos + 5);
    doc.rect(leftCol, yPos, colWidth, 30);

    // Weight information
    const grossWeight = (shipment.totalGrossWeight || 0) + ((shipment.totalBags || 0) * BAG_WEIGHT_MULTIPLIER);
    doc.text(`11 Gross Weight\n${grossWeight.toFixed(2)} kg`, rightCol + 2, yPos + 5);
    doc.rect(rightCol, yPos, colWidth, 30);
    yPos += 30;

    // Signatures
    doc.text(`17 Received by:\n\nDate: ${formatDateForPdf(Timestamp.now())}`, leftCol + 2, yPos + 5);
    doc.rect(leftCol, yPos, colWidth, 30);

    doc.text(`18 Carrier signature:`, rightCol + 2, yPos + 5);
    doc.rect(rightCol, yPos, colWidth, 30);

    triggerDownload(doc, filename);
  } catch (error) {
    console.error('CMR PDF error:', error);
    alert(`CMR generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};
