// src/i18n/types.ts — Translation key type definition

/**
 * Every key in this type must be present in every locale file.
 * Values may contain `{placeholder}` tokens for interpolation.
 */
export type Translations = {
  // Autopilot
  "autopilot.clickToStop": string;
  "autopilot.ariaCancel": string;

  // Audio
  "audio.mute": string;
  "audio.unmute": string;

  // Toolbar
  "toolbar.restart": string;
  "toolbar.screenshot": string;
  "toolbar.showSolve": string;
  "toolbar.share": string;
  "toolbar.comments": string;
  "toolbar.addComment": string;

  // Level buttons
  "level.completePrev": string;

  // Session report modal
  "report.shareReport": string;
  "report.creating": string;
  "report.nextLevel": string;
  "report.playAgain": string;
  "report.emailAria": string;
  "report.sendTitle": string;
  "report.enterEmail": string;
  "report.emailPlaceholder": string;
  "report.levelComplete": string;
  "report.subheading": string;
  "report.score": string;
  "report.accuracy": string;
  "report.eggs": string;
  "report.sendSuccess": string;
  "report.sendFail": string;

  // Game
  "game.tapScreen": string;
  "game.correct": string;
  "game.wrongAnswer": string;
  "game.levelComplete": string;
  "game.entryPrompt": string;
  "game.tryOnYourOwn": string;
  "game.tapAnywhere": string;

  // Rotate
  "rotate.heading": string;
  "rotate.subtext": string;

  // Social
  "social.shareTitle": string;
  "social.commentsTitle": string;
  "social.youtubePrompt": string;
  "social.youtubeDismiss": string;

  // PDF
  "pdf.title": string;
  "pdf.sessionReport": string;
  "pdf.gameDescription": string;
  "pdf.objectiveLabel": string;
  "pdf.objectiveText": string;
  "pdf.scoreLabel": string;
  "pdf.accuracyLabel": string;
  "pdf.timeLabel": string;
  "pdf.questionLabel": string;
  "pdf.correct": string;
  "pdf.wrong": string;
  "pdf.givenAnswer": string;
  "pdf.correctAnswer": string;
  "pdf.rippleCount": string;
  "pdf.durationSeconds": string;
  "pdf.durationMinutesSeconds": string;
  "pdf.encourage90": string;
  "pdf.encourage70": string;
  "pdf.encourage50": string;
  "pdf.encourageBelow": string;
  "pdf.tip": string;
  "pdf.footer": string;
  "pdf.footerUrl": string;

  // Email
  "email.subject": string;
  "email.greeting": string;
  "email.bodyIntro": string;
  "email.curriculumIntro": string;
  "email.regards": string;
  "email.invalidEmail": string;
  "email.missingPdf": string;
  "email.notConfigured": string;
  "email.sendFailed": string;

  // Curriculum
  "curriculum.stageEarlyStage1": string;
  "curriculum.outcomeMae1wm": string;

  // Language switcher
  "lang.label": string;
  "lang.en": string;
  "lang.zh": string;
  "lang.es": string;
  "lang.ru": string;
  "lang.hi": string;
  "lang.other": string;
  "lang.translating": string;
  "lang.translateFail": string;
  "lang.promptTitle": string;
  "lang.promptPlaceholder": string;
  "lang.translate": string;
  "lang.cancel": string;
};

export type TranslationKey = keyof Translations;

/** Function signature for the translation helper */
export type TFunction = (key: TranslationKey, vars?: Record<string, string | number>) => string;
