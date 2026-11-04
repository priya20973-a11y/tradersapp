/**
 * components/sales/quote/quote-pdf-generator.ts
 *
 * Professional client-side A4 PDF generator for Quotations using jsPDF.
 * Displays company logo uploaded in Profile settings, GST (%),
 * Taxable Amount, Subtotal, and Final Total.
 */

import { jsPDF } from "jspdf";
import { formatCurrency, numberToIndianWords } from "@/lib/invoice-utils";
import { formatDate, type CustomerRecord, type QuoteDocument } from "./quote-types";

export interface CompanyProfileInfo {
  logo?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
}

// In-memory cache for profile information
let cachedProfileInfo: CompanyProfileInfo | null = null;

export async function fetchCompanyProfile(): Promise<CompanyProfileInfo> {
  if (cachedProfileInfo) return cachedProfileInfo;
  if (typeof window === "undefined") return {};

  try {
    const res = await fetch("/api/profile");
    if (!res.ok) return {};
    const data = await res.json();
    const p = data?.profile;
    if (!p) return {};

    const profile: CompanyProfileInfo = {
      logo: p.logo || undefined,
      companyName: p.organizationName || p.tradeName || undefined,
      email: p.email || undefined,
      phone: p.phone || undefined,
      address: [p.address, p.city, p.state, p.pincode].filter(Boolean).join(", ") || undefined,
      gstin: p.gstin || undefined,
    };
    cachedProfileInfo = profile;
    return profile;
  } catch {
    return {};
  }
}

interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
  format: string;
}

async function prepareImage(src?: string): Promise<PreparedImage | null> {
  if (!src || typeof window === "undefined") return null;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width || 100;
          const h = img.naturalHeight || img.height || 100;

          if (
            src.startsWith("data:image/png") ||
            src.startsWith("data:image/jpeg") ||
            src.startsWith("data:image/jpg")
          ) {
            const format =
              src.startsWith("data:image/jpeg") || src.startsWith("data:image/jpg")
                ? "JPEG"
                : "PNG";
            resolve({ dataUrl: src, width: w, height: h, format });
            return;
          }

          // If svg, webp or external URL, draw to canvas to export standard PNG
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL("image/png");
          resolve({ dataUrl, width: w, height: h, format: "PNG" });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    } catch {
      resolve(null);
    }
  });
}

export async function generateQuotePdf(
  quote: QuoteDocument,
  customer?: CustomerRecord,
  companyProfile?: CompanyProfileInfo,
): Promise<jsPDF> {
  const profile = companyProfile || (await fetchCompanyProfile());
  const logoSrc = profile.logo;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  // Primary Accent Color (Clean navy/blue)
  const r = 37;
  const g = 99;
  const b = 235;

  const companyName = profile.companyName || "Bharat Traders & Commodities Ltd.";
  const companyEmail = profile.email || "sales@ledgerflow.io";
  const companyPhone = profile.phone || "+91 98765 43210";
  const companyAddress = profile.address || "Plot 42, APMC Market Yard, Navi Mumbai - 400705";
  const companyGstin = profile.gstin || "";

  // 1. Header Banner Line
  doc.setFillColor(r, g, b);
  doc.rect(margin, y, contentWidth, 3, "F");
  y += 8;

  // Process logo if uploaded in Profile
  const preparedLogo = await prepareImage(logoSrc);

  if (preparedLogo) {
    // Sizing and Aspect Ratio preservation
    const maxLogoW = 42;
    const maxLogoH = 18;
    const aspect = preparedLogo.width / preparedLogo.height;

    let logoW = maxLogoW;
    let logoH = maxLogoW / aspect;
    if (logoH > maxLogoH) {
      logoH = maxLogoH;
      logoW = maxLogoH * aspect;
    }

    try {
      doc.addImage(preparedLogo.dataUrl, preparedLogo.format, margin, y, logoW, logoH);
    } catch (err) {
      console.warn("Failed to render logo to Quote PDF:", err);
    }

    // Company info beside the logo
    const textStartX = margin + logoW + 5;
    const maxTextWidth = pageWidth - margin - 78 - textStartX;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(companyName, textStartX, y + 4.5, { maxWidth: maxTextWidth });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(companyAddress, textStartX, y + 9, { maxWidth: maxTextWidth });

    const contactParts = [companyEmail, companyPhone, companyGstin ? `GSTIN: ${companyGstin}` : ""].filter(Boolean);
    doc.text(contactParts.join(" · "), textStartX, y + 13.5, { maxWidth: maxTextWidth });

    // Right-aligned Quotation Title & Quote Info
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(r, g, b);
    doc.text("QUOTATION", pageWidth - margin, y + 4.5, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`Quote #: ${quote.number}`, pageWidth - margin, y + 9.5, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Date: ${formatDate(quote.issueDate)}`, pageWidth - margin, y + 14, { align: "right" });

    let rightY = y + 18.5;
    if (quote.expiryDate || quote.dueDate) {
      doc.text(`Valid Until: ${formatDate(quote.expiryDate || quote.dueDate)}`, pageWidth - margin, rightY, { align: "right" });
      rightY += 4.5;
    }
    if (quote.referenceNumber) {
      doc.text(`Ref #: ${quote.referenceNumber}`, pageWidth - margin, rightY, { align: "right" });
      rightY += 4.5;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const statusColor: [number, number, number] =
      quote.status === "Accepted" || quote.status === "Converted"
        ? [16, 185, 129]
        : quote.status === "Sent"
        ? [37, 99, 235]
        : [100, 116, 139];
    doc.setTextColor(...statusColor);
    doc.text(`Status: ${quote.status.toUpperCase()}`, pageWidth - margin, rightY, { align: "right" });

    y = Math.max(y + logoH + 3, rightY + 3);
  } else {
    // UNCHANGED LAYOUT WHEN NO LOGO IS UPLOADED
    // Company Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(companyName, margin, y);

    // "QUOTATION" header on right
    doc.setFontSize(18);
    doc.setTextColor(r, g, b);
    doc.text("QUOTATION", pageWidth - margin, y, { align: "right" });
    y += 5.5;

    // Company Details (Left) & Quote Info (Right)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(companyAddress, margin, y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`Quote #: ${quote.number}`, pageWidth - margin, y, { align: "right" });
    y += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const contactParts = [companyEmail, companyPhone, companyGstin ? `GSTIN: ${companyGstin}` : ""].filter(Boolean);
    doc.text(contactParts.join(" · "), margin, y);

    doc.text(`Date: ${formatDate(quote.issueDate)}`, pageWidth - margin, y, { align: "right" });
    y += 4.5;

    if (quote.expiryDate || quote.dueDate) {
      doc.text(`Valid Until: ${formatDate(quote.expiryDate || quote.dueDate)}`, pageWidth - margin, y, { align: "right" });
      y += 4.5;
    }

    if (quote.referenceNumber) {
      doc.text(`Ref #: ${quote.referenceNumber}`, pageWidth - margin, y, { align: "right" });
      y += 4.5;
    }

    // Status badge
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const statusColor: [number, number, number] =
      quote.status === "Accepted" || quote.status === "Converted"
        ? [16, 185, 129]
        : quote.status === "Sent"
        ? [37, 99, 235]
        : [100, 116, 139];
    doc.setTextColor(...statusColor);
    doc.text(`Status: ${quote.status.toUpperCase()}`, pageWidth - margin, y, { align: "right" });

    y += 5;
  }

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // 2. Client Details (Quotation For)
  const customerName = customer?.name || "Customer / Client";
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("QUOTATION PREPARED FOR:", margin + 4, y + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(customerName, margin + 4, y + 10.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const clientContact = [customer?.email, customer?.phone].filter(Boolean).join(" · ");
  if (clientContact) {
    doc.text(clientContact, margin + 4, y + 15.5);
  }

  if (quote.subject) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Subject: ${quote.subject}`, margin + 4, y + (clientContact ? 19.5 : 16));
  }

  y += 27;

  // 3. Line Items Table
  const colIndex = margin;
  const colName = margin + 10;
  const colQty = margin + 105;
  const colRate = margin + 135;
  const colAmount = pageWidth - margin;

  // Table Header
  doc.setFillColor(r, g, b);
  doc.rect(margin, y, contentWidth, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("#", colIndex + 2, y + 4.8);
  doc.text("ITEM & DESCRIPTION", colName, y + 4.8);
  doc.text("QTY", colQty, y + 4.8, { align: "right" });
  doc.text("RATE (INR)", colRate, y + 4.8, { align: "right" });
  doc.text("AMOUNT (INR)", colAmount - 2, y + 4.8, { align: "right" });
  y += 8;

  // Table Body
  const items = quote.items || [];
  if (items.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text("General Commercial Estimate (No itemized line items)", margin + 4, y + 4);
    y += 10;
  } else {
    items.forEach((item, index) => {
      // Row alternating background
      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 1, contentWidth, item.description ? 10.5 : 7, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);

      doc.text(String(index + 1), colIndex + 2, y + 3.5);
      doc.setFont("helvetica", "bold");
      doc.text(item.name || "Item", colName, y + 3.5);

      doc.setFont("helvetica", "normal");
      doc.text(String(item.quantity || 1), colQty, y + 3.5, { align: "right" });
      doc.text(formatCurrency(item.rate), colRate, y + 3.5, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(item.amount), colAmount - 2, y + 3.5, { align: "right" });

      if (item.description) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(item.description, colName, y + 7.5);
        y += 10.5;
      } else {
        y += 7;
      }

      // Border line under item
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(margin, y - 1, pageWidth - margin, y - 1);
    });
  }

  y += 4;

  // 4. Financial Summary Breakdown (Right Aligned)
  const summaryWidth = 95;
  const summaryX = pageWidth - margin - summaryWidth;

  const addSummaryRow = (label: string, value: string, isBold = false, isHighlighted = false) => {
    if (isHighlighted) {
      doc.setFillColor(239, 246, 255); // blue-50
      doc.roundedRect(summaryX - 2, y - 3.8, summaryWidth + 2, 7, 1.5, 1.5, "F");
    }
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(isBold ? 9.5 : 8.5);
    doc.setTextColor(
      isHighlighted ? r : isBold ? 15 : 71,
      isHighlighted ? g : isBold ? 23 : 85,
      isHighlighted ? b : isBold ? 42 : 105,
    );
    doc.text(label, summaryX, y);
    doc.text(value, pageWidth - margin, y, { align: "right" });
    y += 5.2;
  };

  const subTotal = Number(quote.subTotal || quote.total || 0);
  const discount = Number(quote.discount || 0);
  const taxableAmount = Math.max(0, subTotal - discount);

  // Extract GST rate (defaults to 18 if not specified)
  const gstRateVal =
    quote.taxRate !== undefined && quote.taxRate !== null
      ? quote.taxRate
      : quote.taxName
      ? parseFloat(quote.taxName.replace(/[^0-9.]/g, "")) || 18
      : 18;

  const gstAmount = Math.abs(Number(quote.taxAmount || 0));

  addSummaryRow("Subtotal", formatCurrency(subTotal));

  if (discount > 0) {
    addSummaryRow("Discount", `-${formatCurrency(discount)}`);
    addSummaryRow("Applicable Taxable Amount", formatCurrency(taxableAmount));
  }

  // Display GST (%)
  if (
    quote.taxType === "GST" ||
    (!quote.taxType && gstAmount > 0) ||
    (quote.tdsTcsType && gstAmount > 0)
  ) {
    addSummaryRow(`GST (${gstRateVal}%)`, `+${formatCurrency(gstAmount)}`);
  }

  // Display TDS / TCS
  const isTds = quote.tdsTcsType === "TDS" || quote.taxType === "TDS";
  const isTcs = quote.tdsTcsType === "TCS" || quote.taxType === "TCS";
  const directRate = quote.tdsTcsRate ?? quote.taxRate ?? 0;
  const directAmount = Math.abs(
    Number(
      quote.tdsTcsAmount !== undefined
        ? quote.tdsTcsAmount
        : isTds || isTcs
        ? quote.taxAmount || 0
        : 0
    )
  );
  const directName = quote.tdsTcsName || (isTds || isTcs ? quote.taxName : "");

  if (isTds && (directAmount > 0 || directRate > 0)) {
    const label = directName
      ? `TDS - ${directName} [${directRate}%]`
      : `TDS (${directRate}%)`;
    addSummaryRow(label, `-${formatCurrency(directAmount)}`);
  } else if (isTcs && (directAmount > 0 || directRate > 0)) {
    const label = directName
      ? `TCS - ${directName} [${directRate}%]`
      : `TCS (${directRate}%)`;
    addSummaryRow(label, `+${formatCurrency(directAmount)}`);
  }

  if (Number(quote.adjustment || 0) !== 0) {
    const adj = Number(quote.adjustment);
    addSummaryRow("Adjustment", `${adj > 0 ? "+" : ""}${formatCurrency(adj)}`);
  }

  // Divider
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.5);
  doc.line(summaryX - 2, y - 1, pageWidth - margin, y - 1);
  y += 2;

  // Grand Total
  addSummaryRow("Total Quote Value", formatCurrency(quote.total), true, true);
  y += 2;

  // Amount in words
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Amount in words: ${numberToIndianWords(quote.total)}`,
    summaryX - 2,
    y + 2,
  );

  y += 12;

  // 5. Notes & Terms Section
  if (quote.customerNotes || quote.termsAndConditions) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = margin;
    }

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentWidth, 30, 2, 2, "F");

    let noteY = y + 5;
    if (quote.customerNotes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text("CUSTOMER NOTES:", margin + 4, noteY);
      noteY += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(quote.customerNotes, margin + 4, noteY, { maxWidth: contentWidth - 8 });
      noteY += 8;
    }

    if (quote.termsAndConditions) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text("TERMS & CONDITIONS:", margin + 4, noteY);
      noteY += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(quote.termsAndConditions, margin + 4, noteY, { maxWidth: contentWidth - 8 });
    }
  }

  // 6. Footer Banner
  const footerY = pageHeight - margin;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("This is a computer generated commercial quotation / estimate.", margin, footerY);
  doc.text("Powered by LedgerFlow ERP", pageWidth - margin, footerY, { align: "right" });

  return doc;
}
