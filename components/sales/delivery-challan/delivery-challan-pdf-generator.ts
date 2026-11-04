/**
 * components/sales/delivery-challan/delivery-challan-pdf-generator.ts
 *
 * Professional client-side A4 PDF generator and print utility for Delivery Challans using jsPDF.
 */

import { jsPDF } from "jspdf";
import { formatCurrency, numberToIndianWords } from "@/lib/invoice-utils";
import { type DeliveryChallanDocument, type CustomerOption } from "./delivery-challan-types";

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
      companyName: p.organizationName || p.tradeName || "Bharat Traders & Commodities Ltd.",
      email: p.email || "billing@ledgerflow.io",
      phone: p.phone || "+91 98765 43210",
      address: [p.address, p.city, p.state, p.pincode].filter(Boolean).join(", ") || "APMC Market Yard, Navi Mumbai, India",
      gstin: p.gstin || undefined,
    };
    cachedProfileInfo = profile;
    return profile;
  } catch {
    return {
      companyName: "Bharat Traders & Commodities Ltd.",
      email: "billing@ledgerflow.io",
      phone: "+91 98765 43210",
      address: "APMC Market Yard, Navi Mumbai, India",
    };
  }
}

function formatDate(dateStr?: string | Date): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateStr);
  }
}

export async function generateDeliveryChallanPDF(
  challan: DeliveryChallanDocument,
  customer?: CustomerOption | null,
): Promise<jsPDF> {
  const profile = await fetchCompanyProfile();
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

  // Header band
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentWidth, 34, "F");

  // Company Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(profile.companyName || "Bharat Traders & Commodities Ltd.", margin + 4, y + 8);

  // Subtitle / Address
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(profile.address || "", margin + 4, y + 14);

  const contactText = [profile.email, profile.phone, profile.gstin ? `GSTIN: ${profile.gstin}` : ""].filter(Boolean).join(" · ");
  doc.text(contactText, margin + 4, y + 19);

  // Top right: DELIVERY CHALLAN header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235); // blue-600
  doc.text("DELIVERY CHALLAN", pageWidth - margin - 4, y + 9, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Challan #: ${challan.deliveryChallanNumber}`, pageWidth - margin - 4, y + 16, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Date: ${formatDate(challan.deliveryChallanDate)}`, pageWidth - margin - 4, y + 21, { align: "right" });

  if (challan.referenceNumber) {
    doc.text(`Ref #: ${challan.referenceNumber}`, pageWidth - margin - 4, y + 26, { align: "right" });
  }

  y += 40;

  // Challan Info Bar & Customer details
  const colWidth = (contentWidth - 6) / 2;

  // Left card: Deliver To / Customer
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, colWidth, 38, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("DELIVER TO (CUSTOMER)", margin + 4, y + 6);

  const custName = challan.customerName || customer?.name || "Customer";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(custName, margin + 4, y + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  const snap = challan.customerSnapshot || customer;
  const addressParts = [
    snap?.billingAddress?.street || snap?.shippingAddress?.street,
    snap?.billingAddress?.city || snap?.shippingAddress?.city,
    snap?.billingAddress?.state || snap?.shippingAddress?.state,
    snap?.billingAddress?.postalCode || snap?.shippingAddress?.postalCode,
  ].filter(Boolean);

  let custY = y + 17;
  if (addressParts.length > 0) {
    doc.text(addressParts.join(", "), margin + 4, custY);
    custY += 4.5;
  }
  if (snap?.email || snap?.phone) {
    doc.text([snap.email, snap.phone].filter(Boolean).join(" · "), margin + 4, custY);
    custY += 4.5;
  }
  if (snap?.gstin) {
    doc.text(`GSTIN: ${snap.gstin}`, margin + 4, custY);
  }

  // Right card: Challan Specifications
  doc.roundedRect(margin + colWidth + 6, y, colWidth, 38, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("CHALLAN DETAILS", margin + colWidth + 10, y + 6);

  let specY = y + 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("Challan Type:", margin + colWidth + 10, specY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(37, 99, 235);
  doc.text(challan.challanType || "Supply on Approval", margin + colWidth + 40, specY);
  specY += 6;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Status:", margin + colWidth + 10, specY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(challan.status === "Delivered" ? "#16a34a" : "#2563eb");
  doc.text(challan.status || "Draft", margin + colWidth + 40, specY);
  specY += 6;

  if (challan.referenceNumber) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Reference #:", margin + colWidth + 10, specY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(challan.referenceNumber, margin + colWidth + 40, specY);
  }

  y += 44;

  // Table header
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(margin, y, contentWidth, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);

  const colSno = margin + 3;
  const colItem = margin + 14;
  const colQty = margin + 115;
  const colRate = margin + 145;
  const colAmt = pageWidth - margin - 3;

  doc.text("#", colSno, y + 5.5);
  doc.text("ITEM DETAILS", colItem, y + 5.5);
  doc.text("QUANTITY", colQty, y + 5.5, { align: "right" });
  doc.text("RATE (₹)", colRate, y + 5.5, { align: "right" });
  doc.text("AMOUNT (₹)", colAmt, y + 5.5, { align: "right" });

  y += 8;

  // Table rows
  const items = challan.items || [];
  let rowIndex = 0;

  for (const item of items) {
    const isEven = rowIndex % 2 === 0;
    const rowHeight = item.description ? 12 : 8;

    if (y + rowHeight > pageHeight - 65) {
      doc.addPage();
      y = margin;
    }

    if (!isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowHeight, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(String(rowIndex + 1), colSno, y + 5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(item.name || "Item", colItem, y + 5);

    if (item.description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(item.description.slice(0, 70), colItem, y + 9.5);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    const qtyText = `${item.quantity || 1} ${item.unit || "pcs"}`;
    doc.text(qtyText, colQty, y + 5, { align: "right" });
    doc.text(Number(item.rate || 0).toFixed(2), colRate, y + 5, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text(Number(item.amount || 0).toFixed(2), colAmt, y + 5, { align: "right" });

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

    y += rowHeight;
    rowIndex++;
  }

  y += 6;

  // Summary section
  const summaryBoxWidth = 80;
  const summaryLeft = pageWidth - margin - summaryBoxWidth;

  // Left side: In Indian Currency Words
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL IN WORDS", margin, y + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const words = numberToIndianWords(Math.round(challan.total || 0));
  doc.text(`Indian Rupees ${words} Only`, margin, y + 9, { maxWidth: contentWidth - summaryBoxWidth - 10 });

  // Right side: Calculations
  let calcY = y + 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  doc.text("Sub Total:", summaryLeft, calcY);
  doc.text(`₹ ${Number(challan.subTotal || 0).toFixed(2)}`, colAmt, calcY, { align: "right" });
  calcY += 5.5;

  if (challan.discount) {
    const discLabel = challan.discountType === "percent" ? `Discount (${challan.discount}%):` : "Discount:";
    doc.text(discLabel, summaryLeft, calcY);
    const discAmt = challan.discountType === "percent"
      ? (challan.subTotal * (challan.discount / 100))
      : challan.discount;
    doc.text(`- ₹ ${Number(discAmt).toFixed(2)}`, colAmt, calcY, { align: "right" });
    calcY += 5.5;
  }

  if (challan.adjustment) {
    doc.text("Adjustment:", summaryLeft, calcY);
    doc.text(`${challan.adjustment >= 0 ? "+" : "-"} ₹ ${Math.abs(challan.adjustment).toFixed(2)}`, colAmt, calcY, { align: "right" });
    calcY += 5.5;
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(summaryLeft, calcY - 1, pageWidth - margin, calcY - 1);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Total ( ₹ ):", summaryLeft, calcY + 5);
  doc.text(`₹ ${Number(challan.total || 0).toFixed(2)}`, colAmt, calcY + 5, { align: "right" });

  y = Math.max(calcY + 16, y + 25);

  // Notes and Terms
  if (challan.customerNotes || challan.termsAndConditions) {
    if (challan.customerNotes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("CUSTOMER NOTES", margin, y);
      y += 4.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(challan.customerNotes, margin, y, { maxWidth: contentWidth });
      y += 8;
    }

    if (challan.termsAndConditions) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("TERMS & CONDITIONS", margin, y);
      y += 4.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(challan.termsAndConditions, margin, y, { maxWidth: contentWidth });
      y += 10;
    }
  }

  // Footer / Signatory
  const footerY = pageHeight - 24;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("This is a computer-generated Delivery Challan and serves as proof of goods dispatch.", margin, footerY + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Authorized Signatory", pageWidth - margin, footerY + 12, { align: "right" });

  return doc;
}

export async function downloadDeliveryChallanPDF(
  challan: DeliveryChallanDocument,
  customer?: CustomerOption | null,
) {
  const doc = await generateDeliveryChallanPDF(challan, customer);
  doc.save(`${challan.deliveryChallanNumber || "delivery-challan"}.pdf`);
}

export async function printDeliveryChallan(
  challan: DeliveryChallanDocument,
  customer?: CustomerOption | null,
) {
  const doc = await generateDeliveryChallanPDF(challan, customer);
  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  iframe.src = blobUrl;
  iframe.onload = () => {
    setTimeout(() => {
      iframe.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(blobUrl);
      }, 2000);
    }, 200);
  };
}

