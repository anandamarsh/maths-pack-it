// src/report/shareReport.ts

import { generateSessionPdf } from "./generatePdf";
import type { SessionSummary } from "./sessionLog";
import { getLocaleFormat, getT } from "../i18n";
import type { TFunction } from "../i18n/types";

const SITE_URL = "https://www.seemaths.com";
const GAME_NAME = "Ripple Touch";
const SENDER_NAME = "Ripple Touch";
const CURRICULUM_INDEX_URL =
  "https://www.educationstandards.nsw.edu.au/wps/portal/nesa/k-10/learning-areas/mathematics/mathematics-k-10";
const CURRICULUM_BY_LEVEL = {
  1: {
    code: "MAe-1WM",
    syllabusUrl:
      "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=6",
  },
  2: {
    code: "MAe-1WM",
    syllabusUrl:
      "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=6",
  },
} as const;

/** Get the current locale from localStorage, defaulting to "en" */
function getCurrentLocale(): string {
  try { return localStorage.getItem("lang") || "en"; } catch { return "en"; }
}

function getReportFileName(summary: SessionSummary): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = (summary.playerName || "explorer").toLowerCase().replace(/\s+/g, "-");
  return `ripple-report-${name}-${stamp}.pdf`;
}

function formatSessionDate(timestamp: number, locale: string): string {
  const format = getLocaleFormat(locale);
  return new Date(timestamp).toLocaleDateString(format.intlLocale, format.emailDateOptions);
}

function formatSessionTime(timestamp: number, locale: string): string {
  const format = getLocaleFormat(locale);
  return new Date(timestamp).toLocaleTimeString(format.intlLocale, format.timeOptions);
}

function formatDurationMinutes(startTime: number, endTime: number, locale: string): string {
  const minutes = Math.max(1, Math.round((endTime - startTime) / 60000));
  const format = getLocaleFormat(locale);
  if (format.useCompactDurationInEmail && format.compactDurationLabels) {
    return `${minutes}${format.compactDurationLabels.minute}`;
  }
  return new Intl.NumberFormat(format.intlLocale, {
    style: "unit",
    unit: "minute",
    unitDisplay: "long",
  }).format(minutes);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to encode report."));
    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Invalid report encoding."));
        return;
      }
      const [, base64 = ""] = reader.result.split(",", 2);
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

export async function downloadReport(summary: SessionSummary): Promise<void> {
  const t = getT(getCurrentLocale());
  const locale = getCurrentLocale();
  const blob = await generateSessionPdf(summary, t, locale);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = getReportFileName(summary);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareReport(summary: SessionSummary): Promise<boolean> {
  const t = getT(getCurrentLocale());
  const locale = getCurrentLocale();
  const blob = await generateSessionPdf(summary, t, locale);
  const fileName = getReportFileName(summary);
  const file = new File([blob], fileName, { type: "application/pdf" });

  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data?: ShareData) => boolean;
  };

  const shareData: ShareData = {
    files: [file],
    title: `${summary.playerName || "Explorer"}'s ${GAME_NAME} Report`,
    text: `Check out this maths session report! Score: ${summary.correctCount}/${summary.totalQuestions} (${summary.accuracy}%)`,
  };

  if (typeof nav.share === "function" && typeof nav.canShare === "function") {
    try {
      if (nav.canShare(shareData)) {
        await nav.share(shareData);
        return true;
      }
    } catch (err) {
      if ((err as DOMException).name === "AbortError") {
        return false;
      }
    }
  }

  await downloadReport(summary);
  return true;
}

function getEmailMetadata(summary: SessionSummary, t: TFunction, locale: string) {
  const level = (summary.level in CURRICULUM_BY_LEVEL ? summary.level : 1) as keyof typeof CURRICULUM_BY_LEVEL;
  const curriculum = CURRICULUM_BY_LEVEL[level];
  return {
    gameName: GAME_NAME,
    senderName: SENDER_NAME,
    siteUrl: SITE_URL,
    sessionTime: formatSessionTime(summary.startTime, locale),
    sessionDate: formatSessionDate(summary.startTime, locale),
    durationText: formatDurationMinutes(summary.startTime, summary.endTime, locale),
    stageLabel: t("curriculum.stageEarlyStage1"),
    curriculumCode: curriculum.code,
    curriculumDescription: t("curriculum.outcomeMae1wm"),
    curriculumUrl: curriculum.syllabusUrl,
    curriculumIndexUrl: CURRICULUM_INDEX_URL,
  };
}

function buildEmailStrings(summary: SessionSummary, t: TFunction, locale: string) {
  const meta = getEmailMetadata(summary, t, locale);
  const scoreLine = `${summary.correctCount}/${summary.totalQuestions}`;
  const accuracy = `${summary.accuracy}%`;

  return {
    emailSubject: t("email.subject", { gameName: meta.gameName }),
    emailGreeting: t("email.greeting"),
    emailBody: t("email.bodyIntro", {
      game: meta.gameName,
      time: meta.sessionTime,
      date: meta.sessionDate,
      duration: meta.durationText,
      score: scoreLine,
      accuracy,
    }),
    emailCurriculum: t("email.curriculumIntro", {
      stageLabel: meta.stageLabel,
      curriculumCode: meta.curriculumCode,
      curriculumDescription: meta.curriculumDescription,
    }),
    emailRegards: t("email.regards"),
  };
}

export async function emailReport(
  summary: SessionSummary,
  email: string,
): Promise<void> {
  const locale = getCurrentLocale();
  const t = getT(locale);
  const blob = await generateSessionPdf(summary, t, locale);
  const emailStrings = buildEmailStrings(summary, t, locale);

  const response = await fetch("/api/send-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.trim(),
      pdfBase64: await blobToBase64(blob),
      playerName: summary.playerName || "Explorer",
      correctCount: summary.correctCount,
      totalQuestions: summary.totalQuestions,
      accuracy: summary.accuracy,
      ...getEmailMetadata(summary, t, locale),
      ...emailStrings,
      reportFileName: getReportFileName(summary),
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Failed to send report email.");
  }
}

export function canNativeShare(): boolean {
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data?: ShareData) => boolean;
  };
  if (typeof nav.share !== "function" || typeof nav.canShare !== "function") {
    return false;
  }
  try {
    const dummyFile = new File([new Blob(["test"])], "test.pdf", { type: "application/pdf" });
    return nav.canShare({ files: [dummyFile] });
  } catch {
    return false;
  }
}
