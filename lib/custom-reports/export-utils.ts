/**
 * lib/custom-reports/export-utils.ts
 *
 * Client & server compatible export utilities for Custom Reports:
 * - Excel (.xlsx) using SheetJS
 * - CSV (.csv) with RFC-4180 escaping
 * - PDF (.pdf) using jsPDF
 */

import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import type { CustomReportColumn } from "@/models/custom-report";

export interface ExportReportOptions {
  moduleName: string;
  reportTitle?: string;
  columns: CustomReportColumn[]; // selected & ordered columns
  rows: Record<string, unknown>[];
  organizationName?: string;
  filterSummary?: string;
}

/**
 * Format a value based on column format specification.
 */
export function formatCellValue(val: unknown, format?: string): string {
  if (val === null || val === undefined || val === "") return "—";

  if (format === "currency") {
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(num);
  }

  if (format === "date") {
    try {
      const d = new Date(val as string | number | Date);
      if (isNaN(d.getTime())) return String(val);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(val);
    }
  }

  if (format === "number") {
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return new Intl.NumberFormat("en-IN").format(num);
  }

  return String(val);
}

/**
 * Export data to Excel (.xlsx)
 */
export function exportToExcel(options: ExportReportOptions): void {
  const { moduleName, reportTitle, columns, rows, organizationName, filterSummary } = options;
  const activeCols = columns.filter((c) => c.visible !== false);

  // Build header metadata rows
  const title = reportTitle || `${moduleName} Custom Report`;
  const nowStr = new Date().toLocaleString("en-IN");
  
  const sheetData: (string | number)[][] = [
    [organizationName || "LedgerFlow Financial ERP"],
    [title],
    [`Generated: ${nowStr}${filterSummary ? ` | Filters: ${filterSummary}` : ""}`],
    [], // empty row
    activeCols.map((c) => c.label), // Header column labels
  ];

  // Totals accumulators
  const totals: Record<string, number> = {};

  // Data rows
  rows.forEach((row) => {
    const rowValues: (string | number)[] = activeCols.map((col) => {
      const raw = row[col.key];
      if (col.format === "currency" || col.format === "number") {
        const num = Number(raw);
        if (!isNaN(num)) {
          totals[col.key] = (totals[col.key] || 0) + num;
          return num;
        }
      }
      if (col.format === "date" && raw) {
        return formatCellValue(raw, "date");
      }
      return raw !== null && raw !== undefined ? String(raw) : "";
    });
    sheetData.push(rowValues);
  });

  // Append Total / Summary row
  if (Object.keys(totals).length > 0) {
    const summaryRow = activeCols.map((col, idx) => {
      if (idx === 0) return "Total";
      if (totals[col.key] !== undefined) {
        return Math.round(totals[col.key] * 100) / 100;
      }
      return "";
    });
    sheetData.push([]);
    sheetData.push(summaryRow);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Auto-fit column widths
  const colWidths = activeCols.map((col) => {
    let maxLen = col.label.length;
    rows.slice(0, 50).forEach((r) => {
      const val = String(r[col.key] ?? "");
      if (val.length > maxLen) maxLen = Math.min(val.length, 40);
    });
    return { wch: Math.max(maxLen + 4, 12) };
  });
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, moduleName.slice(0, 31));

  const safeName = (reportTitle || moduleName).replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${safeName}_${new Date().toISOString().split("T")[0]}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}

/**
 * Export data to CSV (.csv)
 */
export function exportToCSV(options: ExportReportOptions): void {
  const { moduleName, reportTitle, columns, rows } = options;
  const activeCols = columns.filter((c) => c.visible !== false);

  const escapeCsv = (str: unknown) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const csvRows: string[] = [];

  // Header row
  csvRows.push(activeCols.map((c) => escapeCsv(c.label)).join(","));

  // Totals accumulators
  const totals: Record<string, number> = {};

  // Data rows
  rows.forEach((row) => {
    const rowValues = activeCols.map((col) => {
      const raw = row[col.key];
      if (col.format === "currency" || col.format === "number") {
        const num = Number(raw);
        if (!isNaN(num)) {
          totals[col.key] = (totals[col.key] || 0) + num;
        }
      }
      return escapeCsv(formatCellValue(raw, col.format));
    });
    csvRows.push(rowValues.join(","));
  });

  // Totals row
  if (Object.keys(totals).length > 0) {
    const summaryRow = activeCols.map((col, idx) => {
      if (idx === 0) return escapeCsv("Total");
      if (totals[col.key] !== undefined) {
        return escapeCsv(formatCellValue(totals[col.key], col.format));
      }
      return '""';
    });
    csvRows.push(summaryRow.join(","));
  }

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  const safeName = (reportTitle || moduleName).replace(/[^a-zA-Z0-9_-]/g, "_");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${safeName}_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export data to PDF (.pdf) using jsPDF
 */
export function exportToPDF(options: ExportReportOptions): void {
  const { moduleName, reportTitle, columns, rows, organizationName, filterSummary } = options;
  const activeCols = columns.filter((c) => c.visible !== false);

  // Landscape if more than 5 columns
  const isLandscape = activeCols.length > 5;
  const doc = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = isLandscape ? 297 : 210;
  const pageHeight = isLandscape ? 210 : 297;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  // Header banner accent
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(margin, y, contentWidth, 2.5, "F");
  y += 7;

  // Organization name & Report Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(organizationName || "LedgerFlow Financial ERP", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  const dateStr = `Exported: ${new Date().toLocaleString("en-IN")}`;
  doc.text(dateStr, pageWidth - margin, y, { align: "right" });
  y += 5.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(reportTitle || `${moduleName} Custom Report`, margin, y);

  if (filterSummary) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Filters: ${filterSummary}`, margin, y + 4.5);
    y += 5;
  }
  y += 5;

  // Table geometry
  const colWidth = contentWidth / activeCols.length;
  const rowHeight = 6.5;

  // Table Header
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(margin, y, contentWidth, rowHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  activeCols.forEach((col, idx) => {
    const x = margin + idx * colWidth + 2;
    const isNumeric = col.format === "currency" || col.format === "number";
    if (isNumeric) {
      doc.text(col.label, margin + (idx + 1) * colWidth - 2, y + 4.5, { align: "right" });
    } else {
      doc.text(col.label, x, y + 4.5);
    }
  });

  y += rowHeight;

  // Totals accumulators
  const totals: Record<string, number> = {};

  // Data rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);

  rows.forEach((row, rowIdx) => {
    // Check page overflow
    if (y > pageHeight - margin - 15) {
      doc.addPage();
      y = margin;

      // Re-draw table header on new page
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, rowHeight, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      activeCols.forEach((col, idx) => {
        const x = margin + idx * colWidth + 2;
        const isNumeric = col.format === "currency" || col.format === "number";
        if (isNumeric) {
          doc.text(col.label, margin + (idx + 1) * colWidth - 2, y + 4.5, { align: "right" });
        } else {
          doc.text(col.label, x, y + 4.5);
        }
      });
      y += rowHeight;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
    }

    // Alternating row background
    if (rowIdx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowHeight, "F");
    }

    // Row borders
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    // Cells
    activeCols.forEach((col, idx) => {
      const raw = row[col.key];
      const isNumeric = col.format === "currency" || col.format === "number";
      if (isNumeric) {
        const num = Number(raw);
        if (!isNaN(num)) {
          totals[col.key] = (totals[col.key] || 0) + num;
        }
      }
      const formatted = formatCellValue(raw, col.format);
      const text = formatted.length > 25 ? formatted.slice(0, 24) + "…" : formatted;

      if (isNumeric) {
        doc.text(text, margin + (idx + 1) * colWidth - 2, y + 4.5, { align: "right" });
      } else {
        doc.text(text, margin + idx * colWidth + 2, y + 4.5);
      }
    });

    y += rowHeight;
  });

  // Summary Totals row
  if (Object.keys(totals).length > 0) {
    if (y > pageHeight - margin - 15) {
      doc.addPage();
      y = margin;
    }
    doc.setFillColor(239, 246, 255); // blue-50
    doc.rect(margin, y, contentWidth, rowHeight + 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 138); // blue-900

    activeCols.forEach((col, idx) => {
      if (idx === 0) {
        doc.text("Total", margin + 2, y + 4.8);
      } else if (totals[col.key] !== undefined) {
        const text = formatCellValue(totals[col.key], col.format);
        doc.text(text, margin + (idx + 1) * colWidth - 2, y + 4.8, { align: "right" });
      }
    });
    y += rowHeight + 2;
  }

  // Footer page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${totalPages} · Confidential Report`,
      pageWidth / 2,
      pageHeight - 5,
      { align: "center" }
    );
  }

  const safeName = (reportTitle || moduleName).replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`${safeName}_${new Date().toISOString().split("T")[0]}.pdf`);
}
