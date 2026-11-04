/**
 * components/purchases/bill-pdf-generator.ts
 *
 * Professional client-side A4 PDF generator for Purchase Bills using jsPDF.
 * Displays company logo uploaded in Profile settings, vendor details,
 * line items, GST breakdown, subtotal, and balance due.
 */

import { jsPDF } from "jspdf";
import type { BillDetail } from "./bill-detail-view";

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
  format: "PNG" | "JPEG";
}

export interface CompanyProfileInfo {
  logo?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
}

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
      companyName: p.organizationName || p.tradeName || "My Organization",
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

export async function prepareImage(src?: string): Promise<PreparedImage | null> {
  if (!src) return null;
  if (typeof window === "undefined") {
    if (src.startsWith("data:image/")) {
      const format =
        src.startsWith("data:image/jpeg") || src.startsWith("data:image/jpg")
          ? "JPEG"
          : "PNG";
      return { dataUrl: src, width: 200, height: 100, format };
    }
    return null;
  }

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

export async function generateBillPdf(
  bill: BillDetail,
  logoOrCompany?: string | PreparedImage | CompanyProfileInfo | null,
): Promise<jsPDF> {
  let profile: CompanyProfileInfo = {};
  let preparedLogo: PreparedImage | null = null;

  if (logoOrCompany && typeof logoOrCompany === "object" && "dataUrl" in logoOrCompany) {
    preparedLogo = logoOrCompany as PreparedImage;
    profile = await fetchCompanyProfile();
  } else if (
    logoOrCompany &&
    typeof logoOrCompany === "object" &&
    ("companyName" in logoOrCompany || "logo" in logoOrCompany)
  ) {
    profile = logoOrCompany as CompanyProfileInfo;
    if (profile.logo) {
      preparedLogo = await prepareImage(profile.logo);
    }
  } else {
    profile = await fetchCompanyProfile();
    const logoSrc = (typeof logoOrCompany === "string" ? logoOrCompany : null) || profile.logo;
    if (logoSrc) {
      preparedLogo = await prepareImage(logoSrc);
    }
  }

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

  // Blue Accent Color for Bills (#2563eb)
  const r = 37;
  const g = 99;
  const b = 235;

  const companyName = profile.companyName || "Bharat Traders & Commodities Ltd.";
  const companyEmail = profile.email || "accounts@ledgerflow.io";
  const companyPhone = profile.phone || "+91 98765 43210";
  const companyAddress = profile.address || "Plot 42, Sector 18, APMC Market, Navi Mumbai - 400703";
  const companyGstin = profile.gstin || "";

  // 1. Header Banner Line
  doc.setFillColor(r, g, b);
  doc.rect(margin, y, contentWidth, 3, "F");
  y += 8;

  const statusColor =
    bill.status === "Paid"
      ? [16, 185, 129]
      : bill.status === "Partially Paid"
      ? [245, 158, 11]
      : bill.status === "Overdue"
      ? [244, 63, 94]
      : [100, 116, 139];

  const contactText = [
    companyPhone ? `Phone: ${companyPhone}` : "",
    companyEmail ? `Email: ${companyEmail}` : "",
    companyGstin ? `GSTIN: ${companyGstin}` : "",
  ]
    .filter(Boolean)
    .join("  |  ");

  if (preparedLogo) {
    // Sizing and Aspect Ratio preservation
    const maxLogoW = 38;
    const maxLogoH = 16;
    const aspect = (preparedLogo.width || 1) / (preparedLogo.height || 1);

    let logoW = maxLogoW;
    let logoH = maxLogoW / aspect;
    if (logoH > maxLogoH) {
      logoH = maxLogoH;
      logoW = maxLogoH * aspect;
    }

    try {
      doc.addImage(preparedLogo.dataUrl, preparedLogo.format, margin, y, logoW, logoH);
    } catch (err) {
      console.warn("Failed to render logo to Bill PDF:", err);
    }

    const textStartX = margin + logoW + 4;
    const maxTextWidth = pageWidth - margin - 75 - textStartX;

    // Company Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(companyName, textStartX, y + 4, { maxWidth: maxTextWidth });

    // "PURCHASE BILL" header on right
    doc.setFontSize(16);
    doc.setTextColor(r, g, b);
    doc.text("PURCHASE BILL", pageWidth - margin, y + 4, { align: "right" });

    // Subtitle / Company address
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(companyAddress, textStartX, y + 8.5, { maxWidth: maxTextWidth });

    // Bill Number on right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Bill #: ${bill.billNumber}`, pageWidth - margin, y + 8.5, { align: "right" });

    // Contacts
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(contactText, textStartX, y + 13, { maxWidth: maxTextWidth });

    // Status Badge on right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.text(`Status: ${bill.status.toUpperCase()}`, pageWidth - margin, y + 13, { align: "right" });

    y += Math.max(logoH + 3, 17.5);
  } else {
    // Header layout when no logo uploaded (clean fallback)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text(companyName, margin, y);

    // "PURCHASE BILL" header on right
    doc.setFontSize(16);
    doc.setTextColor(r, g, b);
    doc.text("PURCHASE BILL", pageWidth - margin, y, { align: "right" });
    y += 5;

    // Subtitle / Company address
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(companyAddress, margin, y);

    // Bill Number on right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Bill #: ${bill.billNumber}`, pageWidth - margin, y, { align: "right" });
    y += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(contactText, margin, y);

    // Status Badge on right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.text(`Status: ${bill.status.toUpperCase()}`, pageWidth - margin, y, { align: "right" });
    y += 8;
  }

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // 2. Vendor & Bill Details Grid
  const colWidth = contentWidth / 2;

  // Left: Vendor Information
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(r, g, b);
  doc.text("VENDOR INFORMATION", margin, y);

  // Right: Bill Details
  doc.text("BILL DETAILS", margin + colWidth, y);
  y += 4.5;

  // Left Content (Vendor Name)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(bill.vendorName || "Vendor", margin, y);

  // Right Content (Bill Date)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Bill Date:", margin + colWidth, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(
    bill.billDate ? new Date(bill.billDate).toLocaleDateString("en-IN") : "-",
    pageWidth - margin,
    y,
    { align: "right" },
  );
  y += 4.5;

  // Accounts Payable on left
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Accounts Payable: ${bill.accountsPayable || "Default"}`, margin, y);

  // Due Date on right
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Due Date:", margin + colWidth, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(
    bill.dueDate ? new Date(bill.dueDate).toLocaleDateString("en-IN") : "-",
    pageWidth - margin,
    y,
    { align: "right" },
  );
  y += 4.5;

  // Payment Terms on right
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Payment Terms:", margin + colWidth, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(bill.paymentTerms || "Due on Receipt", pageWidth - margin, y, { align: "right" });
  y += 4.5;

  // Order / PO Number on right
  if (bill.orderNumber) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Order / PO #:", margin + colWidth, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(bill.orderNumber, pageWidth - margin, y, { align: "right" });
    y += 4.5;
  }

  if (bill.subject) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Subject: ${bill.subject}`, margin, y, { maxWidth: colWidth - 4 });
  }

  y += 4;

  // 3. Line Items Table Header
  const tableY = y;
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, tableY, contentWidth, 7, "F");
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, tableY + 7, pageWidth - margin, tableY + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  const colSno = margin + 2;
  const colItem = margin + 12;
  const colAccount = margin + 80;
  const colQty = margin + 115;
  const colRate = margin + 138;
  const colAmt = pageWidth - margin - 2;

  doc.text("#", colSno, tableY + 4.8);
  doc.text("ITEM DETAILS", colItem, tableY + 4.8);
  doc.text("ACCOUNT", colAccount, tableY + 4.8);
  doc.text("QTY", colQty, tableY + 4.8, { align: "right" });
  doc.text("RATE", colRate, tableY + 4.8, { align: "right" });
  doc.text("AMOUNT (₹)", colAmt, tableY + 4.8, { align: "right" });

  y = tableY + 11;

  // 4. Line Items Rows
  const items = bill.items || [];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  items.forEach((item, index) => {
    doc.setTextColor(100, 116, 139);
    doc.text(String(index + 1), colSno, y);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(item.name || "Item", colItem, y);

    let descOffset = 0;
    if (item.description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const splitDesc = doc.splitTextToSize(item.description, 60);
      doc.text(splitDesc, colItem, y + 3.5);
      descOffset = splitDesc.length * 3.2;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);

    // Account
    doc.text(item.account || "Expenses", colAccount, y);

    // Qty
    doc.text(String(item.quantity || 1), colQty, y, { align: "right" });

    // Rate
    doc.text(Number(item.rate || 0).toFixed(2), colRate, y, { align: "right" });

    // Amount
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(Number(item.amount || 0).toFixed(2), colAmt, y, { align: "right" });

    y += Math.max(descOffset + 5.5, 6.5);

    // Divider between items
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(margin, y - 1.5, pageWidth - margin, y - 1.5);
  });

  y += 4;

  // 5. Calculations Breakdown
  const summaryBoxWidth = 85;
  const summaryBoxX = pageWidth - margin - summaryBoxWidth;

  // Left: Notes / Terms
  const notesWidth = contentWidth - summaryBoxWidth - 8;
  let notesY = y;

  if (bill.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("CUSTOMER NOTES / MEMO", margin, notesY);
    notesY += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const splitNotes = doc.splitTextToSize(bill.notes, notesWidth);
    doc.text(splitNotes, margin, notesY);
    notesY += splitNotes.length * 3.2 + 4;
  }

  if (bill.termsAndConditions) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("TERMS & CONDITIONS", margin, notesY);
    notesY += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const splitTerms = doc.splitTextToSize(bill.termsAndConditions, notesWidth);
    doc.text(splitTerms, margin, notesY);
    notesY += splitTerms.length * 3.2 + 4;
  }

  // Right: Summary Table Box
  let calcY = y;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(summaryBoxX, calcY - 2, summaryBoxWidth, 54, 2, 2, "F");
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(summaryBoxX, calcY - 2, summaryBoxWidth, 54, 2, 2, "D");

  const rowH = 4.8;
  calcY += 3;

  const renderCalcRow = (label: string, value: string, isBold: boolean = false, isRose: boolean = false) => {
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(isRose ? 225 : 71, isRose ? 29 : 85, isRose ? 72 : 105);
    doc.text(label, summaryBoxX + 4, calcY);
    doc.setTextColor(isRose ? 225 : 30, isRose ? 29 : 41, isRose ? 72 : 59);
    doc.text(value, pageWidth - margin - 4, calcY, { align: "right" });
    calcY += rowH;
  };

  renderCalcRow("Sub Total:", `₹${Number(bill.subTotal || 0).toFixed(2)}`);

  if (bill.discountAmount > 0) {
    const discLabel = `Discount ${bill.discountType === "percent" ? `(${bill.discount}%)` : ""}:`;
    renderCalcRow(discLabel, `-₹${Number(bill.discountAmount).toFixed(2)}`, false, true);
  }

  if (bill.cgst > 0) {
    renderCalcRow(`CGST (${bill.taxRate / 2}%):`, `+₹${Number(bill.cgst).toFixed(2)}`);
  }
  if (bill.sgst > 0) {
    renderCalcRow(`SGST (${bill.taxRate / 2}%):`, `+₹${Number(bill.sgst).toFixed(2)}`);
  }
  if (bill.igst > 0) {
    renderCalcRow(`IGST (${bill.taxRate}%):`, `+₹${Number(bill.igst).toFixed(2)}`);
  }

  if (bill.adjustment !== 0) {
    const adjSign = bill.adjustment > 0 ? "+" : "-";
    renderCalcRow("Adjustment:", `${adjSign}₹${Math.abs(bill.adjustment).toFixed(2)}`);
  }

  // Divider inside summary box
  doc.setDrawColor(203, 213, 225);
  doc.line(summaryBoxX + 3, calcY - 1, pageWidth - margin - 3, calcY - 1);
  calcY += 2;

  // Total
  renderCalcRow("Total Bill Amount:", `₹${Number(bill.total || 0).toFixed(2)}`, true);

  if (bill.amountPaid > 0) {
    renderCalcRow("Amount Paid:", `-₹${Number(bill.amountPaid).toFixed(2)}`, false, true);
  }

  // Balance Due
  renderCalcRow("Balance Due:", `₹${Number(bill.balanceDue || 0).toFixed(2)}`, true);

  // Footer
  const footerY = pageHeight - 12;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Generated via LedgerFlow ERP System", margin, footerY);
  doc.text(`Page 1 of 1`, pageWidth - margin, footerY, { align: "right" });

  return doc;
}

