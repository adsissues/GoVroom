import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface BarcodeData {
  doe: string;
  dispatchNumber: string;
  grossWeight: number;
}

/**
 * Parses a barcode string to extract DOE, Dispatch Number, and Gross Weight.
 * Handles both hyphenated and non-hyphenated barcode formats based on specific rules.
 *
 * @param barcode The barcode string to parse.
 * @returns An object containing doe, dispatchNumber, and grossWeight if parsing is successful, otherwise null.
 */
export function parseBarcode(barcode: string): BarcodeData | null {
  if (!barcode || barcode.length === 0) {
    console.warn("parseBarcode: Barcode string is empty.");
    return null;
  }

  let doe: string;
  let dispatchNumber: string;
  let grossWeight: number;

  if (barcode.includes('-')) {
    // --- Handle hyphenated barcode format ---
    const segments = barcode.split('-');

    // Ensure enough segments exist for the required fields
    if (segments.length < 9) {
      console.warn(`parseBarcode: Hyphenated barcode "${barcode}" has too few segments (${segments.length}). Expected at least 9.`);
      return null;
    }

    // DOE: last 2 letters of the 3rd segment
    const doeSegment = segments[2];
    if (doeSegment.length < 2) {
      console.warn(`parseBarcode: DOE segment "${doeSegment}" in hyphenated barcode "${barcode}" is too short.`);
      return null;
    }
    doe = doeSegment.slice(-2);

    // Dispatch Number: 5th segment, dropping leading zeros
    const dispatchSegment = segments[4];
    const parsedDispatch = parseInt(dispatchSegment, 10);
    if (isNaN(parsedDispatch)) {
      console.warn(`parseBarcode: Could not parse dispatch number from segment "${dispatchSegment}" in hyphenated barcode "${barcode}".`);
      return null;
    }
    dispatchNumber = parsedDispatch.toString(); // Convert back to string to drop leading zeros

    // Gross Weight: 9th segment, divided by 10
    const grossWeightSegment = segments[8];
    const parsedGrossWeight = parseInt(grossWeightSegment, 10);
    if (isNaN(parsedGrossWeight)) {
      console.warn(`parseBarcode: Could not parse gross weight from segment "${grossWeightSegment}" in hyphenated barcode "${barcode}".`);
      return null;
    }
    grossWeight = parsedGrossWeight / 10;

  } else {
    // --- Handle non-hyphenated barcode format (using last 15 characters) ---
    if (barcode.length < 15) {
      console.warn(`parseBarcode: Non-hyphenated barcode "${barcode}" is too short (${barcode.length}). Expected at least 15 characters.`);
      return null;
    }

    const last15Chars = barcode.slice(-15);

    // DOE: first 2 characters of these 15
    doe = last15Chars.substring(0, 2);

    // Dispatch Number: characters 3-5, dropping leading zeros
    const dispatchSegment = last15Chars.substring(2, 5);
    const parsedDispatch = parseInt(dispatchSegment, 10);
    if (isNaN(parsedDispatch)) {
      console.warn(`parseBarcode: Could not parse dispatch number from "${dispatchSegment}" in non-hyphenated barcode "${barcode}".`);
      return null;
    }
    dispatchNumber = parsedDispatch.toString();

    // Gross Weight: last 3 digits, divided by 10
    const grossWeightSegment = last15Chars.substring(last15Chars.length - 3);
    const parsedGrossWeight = parseInt(grossWeightSegment, 10);
    if (isNaN(parsedGrossWeight)) {
      console.warn(`parseBarcode: Could not parse gross weight from "${grossWeightSegment}" in non-hyphenated barcode "${barcode}".`);
      return null;
    }
    grossWeight = parsedGrossWeight / 10;
  }

  return { doe, dispatchNumber, grossWeight };
}
