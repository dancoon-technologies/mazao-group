/**
 * Generate a visit report PDF (single visit). Used by Visits page (detail modal) and Sales page.
 */

import type { Visit } from "@/lib/types";
import { formatDateTime, formatActivityType, formatActivityTypes } from "@/lib/format";
import { getVisitValueKey } from "@/lib/visitFormFields";

const PDF_COLORS = {
  primary: [27, 143, 58] as [number, number, number],
  gray900: [17, 24, 39] as [number, number, number],
  gray500: [107, 114, 128] as [number, number, number],
  gray200: [229, 231, 235] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const PDF_MARGIN = 14;
const PDF_HEADER_HEIGHT = 22;
const PDF_FOOTER_HEIGHT = 14;

function drawPdfHeader(
  doc: import("jspdf").jsPDF,
  title: string,
  subtitle?: string
): void {
  doc.setFillColor(...PDF_COLORS.primary);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 10, "F");
  doc.setTextColor(...PDF_COLORS.white);
  doc.setFontSize(12);
  doc.text("Mazao Group", PDF_MARGIN, 7);
  doc.setTextColor(...PDF_COLORS.gray900);
  doc.setFontSize(14);
  doc.text(title, PDF_MARGIN, PDF_HEADER_HEIGHT);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.gray500);
    doc.text(subtitle, PDF_MARGIN, PDF_HEADER_HEIGHT + 6);
  }
}

function drawPdfFooter(
  doc: import("jspdf").jsPDF,
  pageNumber: number,
  pageCount: number,
  generatedAt: string
): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...PDF_COLORS.gray200);
  doc.line(PDF_MARGIN, pageH - PDF_FOOTER_HEIGHT, pageW - PDF_MARGIN, pageH - PDF_FOOTER_HEIGHT);
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text(`Generated ${generatedAt}`, PDF_MARGIN, pageH - 8);
  doc.text(`Page ${pageNumber} of ${pageCount}`, pageW - PDF_MARGIN, pageH - 8, { align: "right" });
}

const PDF_TABLE_HEAD_STYLES = {
  fillColor: PDF_COLORS.primary,
  textColor: PDF_COLORS.white,
  fontStyle: "bold" as const,
  fontSize: 9,
};

export interface GenerateVisitReportPdfOptions {
  partnerLabel: string;
  locationLabel: string;
  visitDataFields: { key: string; label: string }[];
}

export async function generateVisitReportPdf(
  visit: Visit,
  options: GenerateVisitReportPdfOptions
): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const { partnerLabel, locationLabel, visitDataFields } = options;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const generatedAt = formatDateTime(new Date().toISOString());
  drawPdfHeader(doc, "Visit report", formatDateTime(visit.created_at));

  const pdfHasVal = (v: unknown): boolean =>
    v != null && v !== "" && String(v).trim() !== "" && String(v) !== "—";

  const body: [string, string][] = [];
  body.push(["Date", formatDateTime(visit.created_at)]);
  body.push([
    "Officer",
    ([visit.officer_display_name, visit.officer_email].filter(Boolean).join(" — ") ||
      (visit.officer_email ?? visit.officer ?? "")),
  ]);
  if (pdfHasVal(visit.farmer_display_name ?? visit.farmer)) {
    body.push([partnerLabel, (visit.farmer_display_name ?? visit.farmer) as string]);
  }
  if (pdfHasVal(visit.farm_display_name)) {
    body.push([`${locationLabel} visited`, visit.farm_display_name as string]);
  }
  body.push([
    "Activity",
    formatActivityTypes(visit.activity_types?.length ? visit.activity_types : undefined) ||
      formatActivityType(visit.activity_type ?? ""),
  ]);
  if (pdfHasVal(visit.verification_status)) body.push(["Status", visit.verification_status]);
  if (pdfHasVal(visit.distance_from_farmer)) {
    body.push(["Distance (m)", String(Math.round(Number(visit.distance_from_farmer)))]);
  }
  for (const { key, label } of visitDataFields) {
    if (key === "product_lines") continue;
    const valueKey = getVisitValueKey(key);
    const v = visit[valueKey as keyof Visit];
    if (!pdfHasVal(v)) continue;
    const str = String(v);
    const cell = key === "farmers_feedback" ? str.slice(0, 200) : str;
    body.push([label, cell]);
  }
  if (pdfHasVal(visit.notes) && !visitDataFields.some((f) => f.key === "notes")) {
    body.push(["Notes", (visit.notes ?? "").slice(0, 300)]);
  }

  autoTable(doc, {
    head: [["Field", "Value"]],
    body,
    startY: PDF_HEADER_HEIGHT + 14,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    styles: { fontSize: 9, textColor: PDF_COLORS.gray900 },
    headStyles: PDF_TABLE_HEAD_STYLES,
    columnStyles: { Value: { cellWidth: "wrap" } },
  });

  let finalY =
    doc.getNumberOfPages() > 0
      ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
      : PDF_HEADER_HEIGHT + 14;

  if (visit.product_lines && visit.product_lines.length > 0) {
    const productHead = ["Product", "Qty sold", "Qty given"];
    const productBody = visit.product_lines.map((line) => [
      `${line.product_name ?? "—"}${line.product_unit ? ` (${line.product_unit})` : ""}`,
      line.quantity_sold ?? "0",
      line.quantity_given ?? "0",
    ]);
    autoTable(doc, {
      head: [productHead],
      body: productBody,
      startY: finalY + 10,
      margin: { left: PDF_MARGIN, right: PDF_MARGIN },
      styles: { fontSize: 9, textColor: PDF_COLORS.gray900 },
      headStyles: PDF_TABLE_HEAD_STYLES,
    });
    finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawPdfFooter(doc, p, totalPages, generatedAt);
  }

  const dateStr = visit.created_at.slice(0, 10);
  doc.save(`visit-report-${dateStr}-${visit.id.slice(0, 8)}.pdf`);
}
