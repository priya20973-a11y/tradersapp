/**
 * components/invoices/invoice-pdf-generator.ts
 *
 * Professional client-side A4 PDF generator using jsPDF.
 */

import { jsPDF } from "jspdf";
import { formatCurrency, numberToIndianWords } from "@/lib/invoice-utils";
import { type InvoiceRecord, type InvoiceSettingsData } from "./invoice-types";

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
  format: "PNG" | "JPEG";
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

export async function generateInvoicePdf(
  invoice: InvoiceRecord,
  settings?: InvoiceSettingsData | null,
  logoImage?: PreparedImage | string | null,
): Promise<jsPDF> {
  // Create A4 portrait document (210mm x 297mm)
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

  // Primary Accent Color
  const accentHex = settings?.pdfTemplate?.accentColor || "#2563eb";
  const r = parseInt(accentHex.slice(1, 3), 16) || 37;
  const g = parseInt(accentHex.slice(3, 5), 16) || 99;
  const b = parseInt(accentHex.slice(5, 7), 16) || 235;

  // Company details fallback
  const companyName =
    settings?.companyDetails?.legalName || "Bharat Traders & Commodities Ltd.";
  const companyGstin =
    settings?.companyDetails?.gstin || "";
  const companyEmail =
    settings?.companyDetails?.email || "billing@ledgerflow.io";
  const companyPhone =
    settings?.companyDetails?.phone || "+91 98765 43210";
  const companyAddress =
    settings?.companyDetails?.address
      ? `${settings.companyDetails.address}, ${settings.companyDetails.city || ""}, ${settings.companyDetails.state || ""} - ${settings.companyDetails.postalCode || ""}`
      : "Plot 42, APMC Market Yard, Navi Mumbai - 400705";

  // Check showCompanyLogo option
  const showLogo =
    settings?.pdfTemplate?.showCompanyLogo !== undefined
      ? Boolean(settings.pdfTemplate.showCompanyLogo)
      : settings?.showCompanyLogo !== undefined
      ? Boolean(settings.showCompanyLogo)
      : true;

  let preparedLogo: PreparedImage | null = null;
  if (showLogo) {
    if (logoImage && typeof logoImage === "object" && "dataUrl" in logoImage) {
      preparedLogo = logoImage;
    } else {
      let logoSrc = (typeof logoImage === "string" ? logoImage : null) || "";
      if (!logoSrc && typeof window !== "undefined") {
        try {
          const res = await fetch("/api/profile");
          if (res.ok) {
            const data = await res.json();
            if (data?.profile?.logo) {
              logoSrc = data.profile.logo;
            }
          }
        } catch {
          // ignore profile fetch fallback error
        }
      }
      if (!logoSrc) {
        logoSrc = settings?.companyDetails?.logoUrl || "";
      }
      if (logoSrc) {
        preparedLogo = await prepareImage(logoSrc);
      }
    }
  }

  // 1. Header Banner
  doc.setFillColor(r, g, b);
  doc.rect(margin, y, contentWidth, 3, "F");
  y += 8;

  const statusColor =
    invoice.status === "Paid"
      ? [16, 185, 129] // emerald
      : invoice.status === "Overdue"
      ? [244, 63, 94] // rose
      : invoice.status === "Draft"
      ? [100, 116, 139] // slate
      : [37, 99, 235]; // blue

  const contactText = [
    companyPhone ? `Phone: ${companyPhone}` : "",
    companyEmail ? `Email: ${companyEmail}` : "",
    companyGstin ? `GSTIN: ${companyGstin}` : "",
  ].filter(Boolean).join("  |  ");

  if (showLogo && preparedLogo) {
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
      console.warn("Failed to render logo to Invoice PDF:", err);
    }

    // Company info beside the logo
    const textStartX = margin + logoW + 4;
    const maxTextWidth = pageWidth - margin - 65 - textStartX;

    // Company Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text(companyName, textStartX, y + 4, { maxWidth: maxTextWidth });

    // "TAX INVOICE" header on right
    doc.setFontSize(16);
    doc.setTextColor(r, g, b);
    doc.text("TAX INVOICE", pageWidth - margin, y + 4, { align: "right" });

    // Subtitle / Company address
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(companyAddress, textStartX, y + 8.5, { maxWidth: maxTextWidth });

    // Invoice Number on right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Invoice #: ${invoice.number}`, pageWidth - margin, y + 8.5, { align: "right" });

    // Contacts
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(contactText, textStartX, y + 13, { maxWidth: maxTextWidth });

    // Status Badge on right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, pageWidth - margin, y + 13, { align: "right" });

    y += Math.max(logoH + 3, 17.5);
  } else {
    // Company Name without logo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59); // slate-850
    doc.text(companyName, margin, y);

    // "TAX INVOICE" header on right
    doc.setFontSize(16);
    doc.setTextColor(r, g, b);
    doc.text("TAX INVOICE", pageWidth - margin, y, { align: "right" });
    y += 5;

    // Subtitle / Company contacts
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(companyAddress, margin, y);

    // Invoice Number on right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Invoice #: ${invoice.number}`, pageWidth - margin, y, { align: "right" });
    y += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(contactText, margin, y);

    // Status Badge on right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, pageWidth - margin, y, { align: "right" });
    y += 8;
  }

  // Divider line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // 2. Invoice Details Grid (Bill To, Dates, Terms)
  const colWidth = contentWidth / 2;

  // Left: Bill To
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(r, g, b);
  doc.text("BILLED TO", margin, y);

  // Right: Metadata
  doc.text("INVOICE DETAILS", margin + colWidth, y);
  y += 4.5;

  const custSnapshot = invoice.customerSnapshot;
  const custName = custSnapshot?.name || invoice.customerName || "Customer";
  const custCompany = custSnapshot?.companyName || invoice.customerCompany;
  const custGstin = custSnapshot?.gstin;
  const custAddress = custSnapshot?.billingAddress?.street
    ? `${custSnapshot.billingAddress.street}, ${custSnapshot.billingAddress.city || ""}, ${custSnapshot.billingAddress.state || ""} - ${custSnapshot.billingAddress.postalCode || ""}`
    : custSnapshot?.billingAddress?.city || "";

  // Left Content
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(custName, margin, y);

  // Right Content (Issue Date)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Invoice Date:", margin + colWidth, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(
    invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString("en-IN") : "-",
    pageWidth - margin,
    y,
    { align: "right" },
  );
  y += 4.5;

  if (custCompany) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(custCompany, margin, y);
  }

  // Right Content (Due Date)
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Due Date:", margin + colWidth, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(
    invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "-",
    pageWidth - margin,
    y,
    { align: "right" },
  );
  y += 4.5;

  if (custAddress) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const splitAddr = doc.splitTextToSize(custAddress, colWidth - 8);
    doc.text(splitAddr, margin, y);
    y += splitAddr.length * 3.5;
  }

  // Right Content (Payment Terms & Place of supply)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Payment Terms:", margin + colWidth, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(invoice.paymentTerms || "Due on Receipt", pageWidth - margin, y, { align: "right" });
  y += 4.5;

  if (custGstin) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`GSTIN: ${custGstin}`, margin, y);
  }

  if (invoice.placeOfSupply) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Place of Supply:", margin + colWidth, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(invoice.placeOfSupply, pageWidth - margin, y, { align: "right" });
  }
  y += 8;

  // 3. Line Items Table Header
  const tableY = y;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(margin, tableY, contentWidth, 7, "F");
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, tableY + 7, pageWidth - margin, tableY + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  const colSno = margin + 2;
  const colDesc = margin + 12;
  const colHsn = margin + 85;
  const colQty = margin + 110;
  const colRate = margin + 132;
  const colTax = margin + 154;
  const colAmt = pageWidth - margin - 2;

  doc.text("#", colSno, tableY + 4.8);
  doc.text("ITEM & DESCRIPTION", colDesc, tableY + 4.8);
  doc.text("HSN", colHsn, tableY + 4.8);
  doc.text("QTY", colQty, tableY + 4.8, { align: "right" });
  doc.text("RATE", colRate, tableY + 4.8, { align: "right" });
  doc.text("TAX", colTax, tableY + 4.8, { align: "right" });
  doc.text("AMOUNT (₹)", colAmt, tableY + 4.8, { align: "right" });

  y = tableY + 11;

  // 4. Line Items Rows
  const items = invoice.items || [];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  items.forEach((item, index) => {
    // S.No
    doc.setTextColor(100, 116, 139);
    doc.text(String(index + 1), colSno, y);

    // Name & Desc
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(item.name, colDesc, y);

    let descOffset = 0;
    if (item.description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const splitDesc = doc.splitTextToSize(item.description, 68);
      doc.text(splitDesc, colDesc, y + 3.5);
      descOffset = splitDesc.length * 3.2;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);

    // HSN
    doc.text(item.hsnCode || "-", colHsn, y);

    // Qty + Unit
    doc.text(`${item.quantity} ${item.unit || "pcs"}`, colQty, y, { align: "right" });

    // Rate
    doc.text(Number(item.rate || 0).toFixed(2), colRate, y, { align: "right" });

    // Tax
    doc.text(`${item.taxRate || 0}%`, colTax, y, { align: "right" });

    // Amount
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(Number(item.amount || 0).toFixed(2), colAmt, y, { align: "right" });

    y += 5.5 + descOffset;

    // Light row separator
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y - 1.5, pageWidth - margin, y - 1.5);
  });

  y += 4;

  // 5. Financial Summary Breakdown (Right Aligned)
  const summaryWidth = 85;
  const summaryX = pageWidth - margin - summaryWidth;

  const addSummaryRow = (label: string, value: string, isBold = false, isHighlighted = false) => {
    if (isHighlighted) {
      doc.setFillColor(241, 245, 249);
      doc.rect(summaryX - 2, y - 3.5, summaryWidth + 2, 6, "F");
    }
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(isBold ? 9 : 8.5);
    doc.setTextColor(isHighlighted ? r : isBold ? 30 : 100, isBold ? 41 : 116, isBold ? 59 : 139);
    doc.text(label, summaryX, y);
    doc.text(value, pageWidth - margin, y, { align: "right" });
    y += 4.5;
  };

  addSummaryRow("Subtotal", formatCurrency(invoice.subTotal, invoice.currency));

  if (invoice.discount > 0) {
    addSummaryRow("Discount", `-${formatCurrency(invoice.discount, invoice.currency)}`);
  }

  if (invoice.cgst > 0 || invoice.sgst > 0) {
    addSummaryRow(`CGST (${((invoice.taxRate || 18) / 2).toFixed(1)}%)`, formatCurrency(invoice.cgst, invoice.currency));
    addSummaryRow(`SGST (${((invoice.taxRate || 18) / 2).toFixed(1)}%)`, formatCurrency(invoice.sgst, invoice.currency));
  } else if (invoice.igst > 0) {
    addSummaryRow(`IGST (${(invoice.taxRate || 18).toFixed(1)}%)`, formatCurrency(invoice.igst, invoice.currency));
  }

  if (invoice.shippingCharges > 0) {
    addSummaryRow("Shipping Charges", formatCurrency(invoice.shippingCharges, invoice.currency));
  }

  if (invoice.adjustment !== 0 && invoice.adjustment !== undefined) {
    addSummaryRow("Adjustment", `${invoice.adjustment > 0 ? "+" : ""}${formatCurrency(invoice.adjustment, invoice.currency)}`);
  }

  if (invoice.roundOff !== 0 && invoice.roundOff !== undefined) {
    addSummaryRow("Round Off", `${invoice.roundOff > 0 ? "+" : ""}${formatCurrency(invoice.roundOff, invoice.currency)}`);
  }

  // Divider
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.5);
  doc.line(summaryX - 2, y - 1, pageWidth - margin, y - 1);
  y += 2;

  // Grand Total
  addSummaryRow("Grand Total", formatCurrency(invoice.total, invoice.currency), true, true);
  y += 1;

  if (invoice.amountPaid > 0) {
    addSummaryRow("Amount Paid", formatCurrency(invoice.amountPaid, invoice.currency));
  }

  // Balance Due (Prominent)
  doc.setFillColor(254, 242, 242); // rose-50
  doc.rect(summaryX - 2, y - 3.5, summaryWidth + 2, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text("Balance Due", summaryX, y);
  doc.text(formatCurrency(invoice.balanceDue, invoice.currency), pageWidth - margin, y, { align: "right" });
  y += 8;

  // 6. Amount in Words Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Total in Words: ", margin + 3, y + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  doc.text(numberToIndianWords(invoice.total), margin + 25, y + 4.5);
  y += 11;

  // 7. Bank Details & Signature Block
  const bank = invoice.bankDetailsSnapshot || settings?.bankDetails;
  if (bank?.accountNumber) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(r, g, b);
    doc.text("BANK & PAYMENT DETAILS", margin, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    if (bank.bankName) {
      doc.text(`Bank Name: ${bank.bankName}`, margin, y);
      y += 3.5;
    }
    if (bank.accountHolder) {
      doc.text(`A/C Name: ${bank.accountHolder}`, margin, y);
      y += 3.5;
    }
    if (bank.accountNumber) {
      doc.text(`A/C Number: ${bank.accountNumber}`, margin, y);
      y += 3.5;
    }
    if (bank.ifsc) {
      doc.text(`IFSC Code: ${bank.ifsc}`, margin, y);
      y += 3.5;
    }
    if (bank.upiId) {
      doc.text(`UPI VPA: ${bank.upiId}`, margin, y);
      y += 3.5;
    }
    y += 2;
  }

  // Authorized Signature on right
  const sigY = y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`For ${companyName}`, pageWidth - margin, sigY, { align: "right" });
  doc.text("Authorized Signatory", pageWidth - margin, sigY + 14, { align: "right" });

  // 8. Notes & Terms
  if (invoice.customerNotes || invoice.termsAndConditions) {
    y = Math.max(y + 4, sigY + 16);
    if (invoice.customerNotes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Notes:", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(invoice.customerNotes, margin + 12, y);
      y += 4;
    }
    if (invoice.termsAndConditions) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Terms:", margin, y);
      doc.setFont("helvetica", "normal");
      const splitTerms = doc.splitTextToSize(invoice.termsAndConditions, contentWidth - 14);
      doc.text(splitTerms, margin + 12, y);
    }
  }

  // Footer page stamp
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    "Generated automatically by LedgerFlow • Computer generated tax invoice",
    pageWidth / 2,
    pageHeight - 6,
    { align: "center" },
  );

  return doc;
}
