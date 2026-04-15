// src/report/generatePdf.ts

import { jsPDF } from "jspdf";
import type { SessionSummary, QuestionAttempt } from "./sessionLog";
import type { TFunction } from "../i18n/types";
import arialUnicodeUrl from "../assets/fonts/ArialUnicode.ttf?url";
import { getLocaleFormat } from "../i18n";

// --- Color palette ---

const COLORS = {
  headerBg: "#f1f5f9",
  headerBorder: "#cbd5e1",
  correctBg: "#f0fdf4",
  correctBorder: "#22c55e",
  correctDark: "#16a34a",
  wrongBg: "#fff5f5",
  wrongBorder: "#ef4444",
  accentPurple: "#a855f7",
  textDark: "#1e293b",
  textMuted: "#64748b",
};

const PDF_FONT_FILE = "ArialUnicode.ttf";
const PDF_FONT_FAMILY = "ArialUnicode";
let pdfFontBinaryPromise: Promise<string> | null = null;

// --- Helpers ---

function formatDuration(ms: number, t: TFunction, locale: string): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const format = getLocaleFormat(locale);
  if (format.compactDurationLabels) {
    const { minute, second } = format.compactDurationLabels;
    if (min === 0) return `${totalSec}${second}`;
    return `${min}${minute} ${sec}${second}`;
  }
  if (min === 0) return t("pdf.durationSeconds", { seconds: totalSec });
  return t("pdf.durationMinutesSeconds", { minutes: min, seconds: sec });
}

function formatTime(ts: number, locale: string): string {
  const format = getLocaleFormat(locale);
  return new Date(ts).toLocaleTimeString(format.intlLocale, format.timeOptions);
}

function formatDate(iso: string, locale: string): string {
  const format = getLocaleFormat(locale);
  return new Date(iso).toLocaleDateString(format.intlLocale, format.pdfDateOptions);
}

function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let result = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    result += String.fromCharCode(...chunk);
  }
  return result;
}

async function ensurePdfFont(doc: jsPDF): Promise<string> {
  if (!pdfFontBinaryPromise) {
    pdfFontBinaryPromise = fetch(arialUnicodeUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load PDF font: ${response.status}`);
        }
        return arrayBufferToBinaryString(await response.arrayBuffer());
      });
  }

  const fontBinary = await pdfFontBinaryPromise;
  doc.addFileToVFS(PDF_FONT_FILE, fontBinary);
  doc.addFont(PDF_FONT_FILE, PDF_FONT_FAMILY, "normal");
  doc.addFont(PDF_FONT_FILE, PDF_FONT_FAMILY, "bold");
  doc.setFont(PDF_FONT_FAMILY, "normal");
  return PDF_FONT_FAMILY;
}

// --- Icon loader ---

async function loadIconBase64(): Promise<string | null> {
  try {
    const svgRes = await fetch("/favicon.svg");
    if (svgRes.ok) {
      const svgText = await svgRes.text();
      const blob = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const size = 512;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, size, size);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      });
    }
    const pngRes = await fetch("/icon-512.png");
    const pngBlob = await pngRes.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(pngBlob);
    });
  } catch {
    return null;
  }
}

// --- Star decorator ---

function drawStar(doc: jsPDF, cx: number, cy: number, outerR: number, innerR: number, color: string) {
  const pts = 5;
  const verts: [number, number][] = [];
  for (let i = 0; i < pts * 2; i++) {
    const angle = (i * Math.PI / pts) - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    verts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  const lines: number[][] = verts.slice(1).map((pt, i) => [pt[0] - verts[i][0], pt[1] - verts[i][1]]);
  lines.push([verts[0][0] - verts[verts.length - 1][0], verts[0][1] - verts[verts.length - 1][1]]);
  doc.setFillColor(color);
  doc.lines(lines, verts[0][0], verts[0][1], [1, 1], "F", true);
}

// --- Ripple position diagram ---

function drawRippleDiagram(
  doc: jsPDF,
  attempt: QuestionAttempt,
  x: number,
  y: number,
  width: number,
  height: number,
  t: TFunction,
) {
  // Light background
  doc.setFillColor("#f8fafc");
  doc.roundedRect(x, y, width, height, 3, 3, "F");
  doc.setDrawColor("#cbd5e1");
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 3, 3, "S");

  // Dot grid
  doc.setFillColor("#cbd5e1");
  const gridStep = 8;
  for (let gx = x + gridStep; gx < x + width - 1; gx += gridStep) {
    for (let gy = y + gridStep; gy < y + height - 1; gy += gridStep) {
      doc.circle(gx, gy, 0.35, "F");
    }
  }

  // Draw each ripple as concentric circles, with overlap-aware labels
  const padding = 4;
  const labelH = 3.5; // approximate label height in mm
  const placedLabels: { lx: number; ly: number; w: number }[] = [];

  for (const rp of attempt.ripplePositions) {
    const px = x + padding + (rp.x / 100) * (width - padding * 2);
    const py = y + padding + (rp.y / 100) * (height - padding * 2);

    // Outer rings
    doc.setDrawColor(rp.color);
    doc.setLineWidth(0.5);
    doc.circle(px, py, 4, "S");
    doc.setLineWidth(0.3);
    doc.circle(px, py, 6.5, "S");

    // Center dot
    doc.setFillColor(rp.color);
    doc.circle(px, py, 1.5, "F");

    // Overlap-aware label placement
    doc.setFontSize(4.5);
    doc.setFont(PDF_FONT_FAMILY, "normal");
    const labelText = `(${rp.x},${rp.y})`;
    const labelW = doc.getTextWidth(labelText);

    // Candidate positions: below, above, right, left
    const candidates = [
      { lx: px, ly: py + 9.5 },
      { lx: px, ly: py - 8 },
      { lx: px + 9, ly: py + 1 },
      { lx: px - 9, ly: py + 1 },
    ];

    let chosen = candidates[0];
    for (const cand of candidates) {
      // Keep label inside diagram bounds
      if (cand.lx - labelW / 2 < x + 1 || cand.lx + labelW / 2 > x + width - 1) continue;
      if (cand.ly > y + height - 1.5 || cand.ly - labelH < y + 1) continue;
      // Check against already-placed labels
      const overlaps = placedLabels.some(
        (p) => Math.abs(p.lx - cand.lx) < (p.w + labelW) / 2 + 1 && Math.abs(p.ly - cand.ly) < labelH + 1,
      );
      if (!overlaps) { chosen = cand; break; }
    }
    placedLabels.push({ lx: chosen.lx, ly: chosen.ly, w: labelW });

    doc.setTextColor("#1e293b");
    doc.text(labelText, chosen.lx, chosen.ly, { align: "center" });
  }

  // "Ripple count" label at bottom
  doc.setFontSize(5);
  doc.setFont(PDF_FONT_FAMILY, "normal");
  doc.setTextColor("#64748b");
  doc.text(
    t("pdf.rippleCount", { count: attempt.ripplePositions.length }),
    x + width / 2, y + height - 2, { align: "center" },
  );
}

// --- Main PDF generation ---

export async function generateSessionPdf(summary: SessionSummary, t: TFunction, locale = "en"): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  const fontFamily = await ensurePdfFont(doc);
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297
  const margin = 15;
  const contentW = pageW - margin * 2;              // 180
  let curY = margin;

  const iconBase64 = await loadIconBase64();

  // ═══════════════════════════════════════════════════════════════════════════
  // HEADER BANNER
  // ═══════════════════════════════════════════════════════════════════════════

  const bannerH = 28;
  doc.setFillColor(COLORS.headerBg);
  doc.roundedRect(margin, curY, contentW, bannerH, 4, 4, "F");
  doc.setDrawColor(COLORS.headerBorder);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, curY, contentW, bannerH, 4, 4, "S");

  const iconSize = 20;
  const iconPad = 4;
  const iconX = margin + iconPad;
  const iconY = curY + (bannerH - iconSize) / 2;

  if (iconBase64) {
    doc.addImage(iconBase64, "PNG", iconX, iconY, iconSize, iconSize);
  }

  const titleColX = margin + iconPad + iconSize + 4;
  const titleColW = (margin + contentW) - titleColX - iconPad;
  const titleCX = titleColX + titleColW / 2;

  doc.setTextColor(COLORS.textDark);
  doc.setFontSize(17);
  doc.setFont(fontFamily, "bold");
  doc.text(t("pdf.title"), titleCX, curY + 11, { align: "center" });

  const line2Y = curY + 21;
  doc.setFontSize(7.5);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(formatDate(summary.date, locale), titleColX, line2Y);
  doc.text(
    `${formatTime(summary.startTime, locale)} - ${formatTime(summary.endTime, locale)}`,
    margin + contentW - iconPad, line2Y, { align: "right" }
  );

  doc.setFontSize(9);
  doc.setFont(fontFamily, "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text(t("pdf.sessionReport", { n: summary.level }), titleCX, line2Y, { align: "center" });

  curY += bannerH + 10;

  // ═══════════════════════════════════════════════════════════════════════════
  // GAME DESCRIPTION
  // ═══════════════════════════════════════════════════════════════════════════

  doc.setFontSize(9);
  doc.setFont(fontFamily, "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text(t("pdf.gameDescription"), margin, curY);
  curY += 5.5;

  doc.setFontSize(8);
  doc.setFont(fontFamily, "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text(t("pdf.objectiveLabel"), margin, curY);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(
    t("pdf.objectiveText"),
    margin + doc.getTextWidth(t("pdf.objectiveLabel")) + 2, curY
  );
  curY += 8;

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORE BOXES
  // ═══════════════════════════════════════════════════════════════════════════

  const boxW = (contentW - 8) / 3;
  const boxH = 18;

  // Score - blue
  const scoreColor = "#1d4ed8";
  const scoreBg = "#eff6ff";
  doc.setFillColor(scoreBg);
  doc.roundedRect(margin, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(scoreColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(7.5);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(t("pdf.scoreLabel"), margin + boxW / 2, curY + 5.5, { align: "center" });
  doc.setFontSize(15);
  doc.setFont(fontFamily, "bold");
  doc.setTextColor(scoreColor);
  doc.text(`${summary.correctCount} / ${summary.totalQuestions}`, margin + boxW / 2, curY + 13.5, { align: "center" });

  // Accuracy - color coded
  const box2X = margin + boxW + 4;
  const accColor = summary.accuracy >= 80 ? "#16a34a" : summary.accuracy >= 50 ? "#f59e0b" : "#dc2626";
  const accBg = summary.accuracy >= 80 ? "#f0fdf4" : summary.accuracy >= 50 ? "#fffbeb" : "#fff5f5";
  doc.setFillColor(accBg);
  doc.roundedRect(box2X, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(accColor);
  doc.roundedRect(box2X, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(7.5);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(t("pdf.accuracyLabel"), box2X + boxW / 2, curY + 5.5, { align: "center" });
  doc.setFontSize(15);
  doc.setFont(fontFamily, "bold");
  doc.setTextColor(accColor);
  doc.text(`${summary.accuracy}%`, box2X + boxW / 2, curY + 13.5, { align: "center" });

  // Time - purple
  const box3X = margin + (boxW + 4) * 2;
  doc.setFillColor("#faf5ff");
  doc.roundedRect(box3X, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(COLORS.accentPurple);
  doc.roundedRect(box3X, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(7.5);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(t("pdf.timeLabel"), box3X + boxW / 2, curY + 5.5, { align: "center" });
  doc.setFontSize(15);
  doc.setFont(fontFamily, "bold");
  doc.setTextColor(COLORS.accentPurple);
  doc.text(formatDuration(summary.endTime - summary.startTime, t, locale), box3X + boxW / 2, curY + 13.5, { align: "center" });

  curY += boxH + 7;

  // ═══════════════════════════════════════════════════════════════════════════
  // EGGS
  // ═══════════════════════════════════════════════════════════════════════════

  const eggRx = 2.2, eggRy = 3, eggStep = 6;
  const maxPerRow = Math.floor(contentW / eggStep);
  const eggRowH = eggRy * 2 + 3;

  for (let rowStart = 0; rowStart < summary.attempts.length; rowStart += maxPerRow) {
    const rowAttempts = summary.attempts.slice(rowStart, rowStart + maxPerRow);
    const rowWidth = rowAttempts.length * eggStep;
    let eggX = margin + (contentW - rowWidth) / 2 + eggStep / 2;
    const eggCY = curY + eggRy;

    for (const attempt of rowAttempts) {
      if (!attempt.isCorrect) {
        doc.setFillColor("#ef4444");
        doc.setDrawColor("#dc2626");
      } else {
        doc.setFillColor("#facc15");
        doc.setDrawColor("#f59e0b");
      }
      doc.ellipse(eggX, eggCY, eggRx, eggRy, "FD");
      eggX += eggStep;
    }
    curY += eggRowH;
  }

  curY += 5;

  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTION CARDS with ripple diagrams
  // ═══════════════════════════════════════════════════════════════════════════

  const cardHeaderH = 10;
  const stripeW = 3;
  const cardGap = 5;
  const cardLeft = margin + cardGap;
  const cardRight = margin + contentW;
  const cardContentW = cardRight - cardLeft;

  const diagramW = 70;
  const diagramH = 42;

  for (const attempt of summary.attempts) {
    const cardBodyH = diagramH + 8;
    const estimatedCardH = cardHeaderH + cardBodyH;

    curY += cardGap;

    if (curY + estimatedCardH > pageH - margin) {
      doc.addPage();
      curY = margin + cardGap;
    }

    const cardBorderColor = attempt.isCorrect ? COLORS.correctBorder : COLORS.wrongBorder;
    const cardBg = attempt.isCorrect ? COLORS.correctBg : COLORS.wrongBg;

    // Card header
    doc.setFillColor(cardBg);
    doc.rect(cardLeft, curY, cardContentW, cardHeaderH, "F");

    // Left color stripe (full card height)
    const stripeH = cardHeaderH + cardBodyH;
    doc.setFillColor(cardBorderColor);
    doc.rect(cardLeft, curY, stripeW, stripeH, "F");

    // Q number
    const qLabel = t("pdf.questionLabel", { n: attempt.questionNumber });
    doc.setFontSize(10);
    doc.setFont(fontFamily, "bold");
    doc.setTextColor(COLORS.textDark);
    doc.text(qLabel, cardLeft + stripeW + 3, curY + 6.8);

    // CORRECT / WRONG + time
    const timeStr = formatDuration(attempt.timeTakenMs, t, locale);
    doc.setFontSize(7);
    doc.setFont(fontFamily, "normal");
    const timeW2 = doc.getTextWidth(timeStr);

    doc.setFontSize(9);
    doc.setFont(fontFamily, "bold");
    const icon = attempt.isCorrect ? t("pdf.correct") : t("pdf.wrong");
    const iconW = doc.getTextWidth(icon);

    const groupRight = pageW - margin - 4;
    const groupStart = groupRight - iconW - 3 - timeW2;

    doc.setTextColor(cardBorderColor);
    doc.text(icon, groupStart, curY + 6.8);

    doc.setFontSize(7);
    doc.setFont(fontFamily, "normal");
    doc.setTextColor(COLORS.textMuted);
    doc.text(timeStr, groupRight, curY + 6.8, { align: "right" });

    curY += cardHeaderH;

    // Card body: diagram (left) + question text (right)
    const bodyPad = 4;
    const diagramX = cardLeft + stripeW + 4;

    // Draw the ripple position diagram
    drawRippleDiagram(doc, attempt, diagramX, curY + bodyPad, diagramW, diagramH, t);

    // Question and answer text (right of diagram)
    const textX = diagramX + diagramW + 5;
    const textW = cardRight - textX - 4;

    doc.setFontSize(8.5);
    doc.setFont(fontFamily, "bold");
    doc.setTextColor(COLORS.textDark);
    const promptLines = doc.splitTextToSize(attempt.prompt, textW);
    doc.text(promptLines, textX, curY + bodyPad + 4);

    let textY = curY + bodyPad + 4 + promptLines.length * 4.5 + 3;

    doc.setFontSize(8);
    doc.setFont(fontFamily, "normal");
    doc.setTextColor(attempt.isCorrect ? COLORS.correctDark : COLORS.wrongBorder);
    doc.text(t("pdf.givenAnswer", { value: attempt.childAnswer ?? "-" }), textX, textY);
    textY += 4.5;

    doc.setTextColor(COLORS.textDark);
    doc.text(t("pdf.correctAnswer", { value: attempt.correctAnswer }), textX, textY);

    curY += cardBodyH;

    // Separator
    doc.setDrawColor("#e2e8f0");
    doc.setLineWidth(0.3);
    doc.line(cardLeft, curY, cardRight, curY);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENCOURAGEMENT SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  curY += cardGap;

  if (curY + 40 > pageH - margin) {
    doc.addPage();
    curY = margin;
  }

  const encStripH = 32;
  doc.setFillColor("#ede9fe");
  doc.roundedRect(margin, curY, contentW, encStripH, 4, 4, "F");

  const starCY = curY + encStripH / 2 - 2;
  drawStar(doc, margin + 11, starCY - 3, 5, 2.2, "#facc15");
  drawStar(doc, margin + 20, starCY + 4, 3.5, 1.5, "#fbbf24");
  drawStar(doc, margin + 9, starCY + 6, 2.5, 1.1, "#fde68a");

  const rEdge = margin + contentW;
  drawStar(doc, rEdge - 11, starCY - 3, 5, 2.2, "#facc15");
  drawStar(doc, rEdge - 20, starCY + 4, 3.5, 1.5, "#fbbf24");
  drawStar(doc, rEdge - 9, starCY + 6, 2.5, 1.1, "#fde68a");

  doc.setFontSize(13);
  doc.setFont(fontFamily, "bold");
  doc.setTextColor(COLORS.accentPurple);
  const encouragement =
    summary.accuracy >= 90 ? t("pdf.encourage90") :
    summary.accuracy >= 70 ? t("pdf.encourage70") :
    summary.accuracy >= 50 ? t("pdf.encourage50") :
                             t("pdf.encourageBelow");
  doc.text(encouragement, pageW / 2, curY + 13, { align: "center" });

  const wrongAttempts = summary.attempts.filter(a => !a.isCorrect);
  if (wrongAttempts.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont(fontFamily, "normal");
    doc.setTextColor(COLORS.textMuted);
    doc.text(t("pdf.tip"), pageW / 2, curY + 22, { align: "center" });
  }

  // Footer
  doc.setFontSize(7);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor("#94a3b8");
  doc.text(t("pdf.footer"), pageW / 2, pageH - 8, { align: "center" });
  doc.text(t("pdf.footerUrl"), pageW / 2, pageH - 4, { align: "center" });

  return doc.output("blob");
}
