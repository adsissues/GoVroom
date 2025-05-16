
"use client"; // For client-side PDF generation and download

import jsPDF from 'jspdf';
import type { Shipment, ShipmentStatus } from '@/lib/types'; // Assuming ShipmentStatus is also in types
import { format } from 'date-fns'; // For date formatting

// Helper to format Timestamp to readable date string or return 'N/A'
const formatPdfTimestamp = (timestamp: any): string => { // Use any for flexibility with Firebase Timestamp
  if (!timestamp) return 'N/A';
  try {
    // Firebase Timestamps have a toDate() method
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "PPP"); // Example: Sep 24, 2023
  } catch (error) {
    console.error("[PDFService] Error formatting timestamp for PDF:", error);
    return 'Invalid Date';
  }
};


export const generatePreAlertPdf = (shipment: Shipment): void => {
  console.log("[PDFService] generatePreAlertPdf called with shipment:", JSON.stringify(shipment));
  try {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Pre-Alert Document", 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Shipment ID: ${shipment.id}`, 20, 40);
    doc.text(`Carrier: ${shipment.carrierId || 'N/A'}`, 20, 50); // Placeholder, ideally use label
    doc.text(`Driver Name: ${shipment.driverName || 'N/A'}`, 20, 60);
    doc.text(`Departure Date: ${formatPdfTimestamp(shipment.departureDate)}`, 20, 70);
    doc.text(`Arrival Date: ${formatPdfTimestamp(shipment.arrivalDate)}`, 20, 80);
    doc.text(`Status: ${shipment.status}`, 20, 90);
    doc.text(`Seal Number: ${shipment.sealNumber || 'N/A'}`, 20, 100);

    // Add more details as needed, for example, items if available
    // doc.text("Items:", 20, 120);
    // shipment.details?.forEach((item, index) => {
    //   doc.text(`- Item ${index + 1}: ${item.description}`, 25, 130 + (index * 10));
    // });

    console.log("[PDFService] Pre-Alert PDF: About to call doc.save()");
    doc.save(`pre-alert-${shipment.id}.pdf`);
    console.log("[PDFService] Pre-Alert PDF: doc.save() called.");
  } catch (error) {
    console.error("[PDFService] Error in generatePreAlertPdf:", error);
    // Optionally, display a toast message to the user about the PDF generation failure
    // toast({ variant: "destructive", title: "Pre-Alert PDF Failed", description: error.message });
  }
};

export const generateCmrPdf = (shipment: Shipment): void => {
  console.log("[PDFService] generateCmrPdf called with shipment:", JSON.stringify(shipment));
  try {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("CMR Document", 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text("1. Sender (Name, address, country)", 20, 40);
    doc.text(shipment.senderAddress || "N/A", 25, 47, { maxWidth: 170 });

    doc.text("2. Consignee (Name, address, country)", 20, 70);
    doc.text(shipment.consigneeAddress || "N/A", 25, 77, { maxWidth: 170 });

    doc.text(`3. Place of delivery of goods (Place, country)`, 20, 100);
    doc.text(`(As per consignee address)`, 25, 107);


    doc.text(`Truck Registration: ${shipment.truckRegistration || 'N/A'}`, 20, 120);
    doc.text(`Trailer Registration: ${shipment.trailerRegistration || 'N/A'}`, 20, 130);
    doc.text(`Seal Number: ${shipment.sealNumber || 'N/A'}`, 20, 140);

    doc.text(`Description of Goods: General Goods (As per manifest)`, 20, 160);
    doc.text(`Total Gross Weight (kg): ${shipment.totalGrossWeight?.toFixed(3) || 'N/A'}`, 20, 170);
    doc.text(`Total Pallets: ${shipment.totalPallets || 'N/A'}`, 20, 180);
    doc.text(`Total Bags: ${shipment.totalBags || 'N/A'}`, 20, 190);


    // Placeholder for signatures and stamps
    doc.text("Carrier's Signature / Stamp:", 20, 220);
    doc.text("Sender's Signature / Stamp:", 110, 220);

    console.log("[PDFService] CMR PDF: About to call doc.save()");
    doc.save(`cmr-${shipment.id}.pdf`);
    console.log("[PDFService] CMR PDF: doc.save() called.");
  } catch (error) {
    console.error("[PDFService] Error in generateCmrPdf:", error);
    // Optionally, display a toast message to the user about the PDF generation failure
    // toast({ variant: "destructive", title: "CMR PDF Failed", description: error.message });
  }
};

