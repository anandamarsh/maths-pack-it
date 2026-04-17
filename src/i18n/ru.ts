// src/i18n/ru.ts — Russian translations

import type { Translations } from "./types";

const ru: Translations = {
  // Autopilot
  "autopilot.clickToStop": "Автопилот ВКЛЮЧЁН — нажмите, чтобы остановить",
  "autopilot.ariaCancel": "Автопилот активен — нажмите, чтобы отменить",

  // Audio
  "audio.mute": "Без звука",
  "audio.unmute": "Включить звук",

  // Toolbar
  "toolbar.restart": "Начать заново",
  "toolbar.screenshot": "Снимок экрана",
  "toolbar.showSolve": "Показать решение этого вопроса",
  "toolbar.share": "Поделиться",
  "toolbar.comments": "Комментарии",
  "toolbar.addComment": "+ Добавить комментарий",

  // Level buttons
  "level.completePrev": "Сначала пройдите уровень {n}",

  // Session report modal
  "report.shareReport": "Поделиться отчётом",
  "report.creating": "Создание...",
  "report.nextLevel": "Следующий уровень",
  "report.playAgain": "Играть снова",
  "report.emailAria": "Отправить отчёт по email",
  "report.sendTitle": "Отправить отчёт по электронной почте",
  "report.enterEmail": "Введите адрес электронной почты",
  "report.emailPlaceholder": "parent@email.com",
  "report.levelComplete": "Уровень {level} пройден!",
  "report.subheading": "Монстр-раунд пройден!",
  "report.score": "Счёт",
  "report.accuracy": "Точность",
  "report.eggs": "Яйца",
  "report.sendSuccess": "Отчёт отправлен на {email}",
  "report.sendFail": "Не удалось отправить отчёт.",

  // Game
  "game.tapScreen": "Нажмите на экран! ({count}/{total})",
  "game.correct": "Правильно!",
  "game.wrongAnswer": "Неправильно! Ответ: {answer}",
  "game.levelComplete": "Уровень пройден!",
  "game.entryPrompt": "Сколько кругов вы создали?",
  "game.tryOnYourOwn": "Попробуйте сами",
  "game.tapAnywhere": "Нажмите куда-нибудь!",

  // Rotate
  "rotate.heading": "Поверните устройство",
  "rotate.subtext": "Эта игра лучше работает в альбомном режиме",

  // Social
  "social.shareTitle": "Посмотрите эту математическую игру на Interactive Maths!",
  "social.commentsTitle": "Комментарии DiscussIt",
  "social.youtubePrompt": "В первый раз? Посмотрите видео о том, как играть.",
  "social.youtubeDismiss": "Больше не показывать",

  // PDF
  "pdf.title": "Pack It!",
  "pdf.sessionReport": "Отчёт о сессии (Уровень {n})",
  "pdf.gameDescription": "Унитарный метод и удельные нормы",
  "pdf.objectiveLabel": "Цель:",
  "pdf.objectiveText": "Разложите предметы по равным группам, найдите единичную норму и используйте её для решения задачи.",
  "pdf.scoreLabel": "Счёт",
  "pdf.accuracyLabel": "Точность",
  "pdf.timeLabel": "Общее время",
  "pdf.questionLabel": "В{n}",
  "pdf.correct": "ПРАВИЛЬНО",
  "pdf.wrong": "НЕПРАВИЛЬНО",
  "pdf.givenAnswer": "Данный ответ: {value}",
  "pdf.correctAnswer": "Правильный ответ: {value}",
  "pdf.rippleCount": "{count} круг(ов)",
  "pdf.durationSeconds": "{seconds} с",
  "pdf.durationMinutesSeconds": "{minutes} мин {seconds} с",
  "pdf.encourage90": "Потрясающе! Ты чемпион по счёту!",
  "pdf.encourage70": "Отличная работа! Ты становишься всё лучше!",
  "pdf.encourage50": "Хорошая попытка! Продолжай тренироваться!",
  "pdf.encourageBelow": "Молодец! Каждая попытка делает тебя сильнее!",
  "pdf.tip": "Совет: В следующий раз считай внимательнее — не торопись!",
  "pdf.footer": "Создано SeeMaths - Pack It!",
  "pdf.footerUrl": "https://www.seemaths.com",

  // Email
  "email.subject": "Отчёт {gameName}",
  "email.greeting": "Здравствуйте,",
  "email.bodyIntro": "Игрок играл в {game} на SeeMaths в {time} {date} в течение {duration}. Результат: {score}, точность: {accuracy}.",
  "email.curriculumIntro": "Эта игра соответствует {stageLabel} по теме {curriculumCode} - {curriculumDescription}.",
  "email.regards": "С уважением,",
  "email.invalidEmail": "Введите корректный адрес электронной почты.",
  "email.missingPdf": "Вложение с отчётом отсутствует.",
  "email.notConfigured": "Почтовый сервис не настроен.",
  "email.sendFailed": "Не удалось отправить отчёт по email.",

  // Curriculum
  "curriculum.stageEarlyStage1": "Математика NSW, этап 4",
  "curriculum.outcomeMae1wm": "Решает задачи на отношения и нормы с использованием унитарного метода",

  // Language switcher
  "lang.label": "Язык",
  "lang.en": "English",
  "lang.zh": "中文",
  "lang.es": "Español",
  "lang.ru": "Русский",
  "lang.hi": "हिन्दी",
  "lang.other": "Другой...",
  "lang.translating": "Перевод...",
  "lang.translateFail": "Ошибка перевода.",
  "lang.promptTitle": "Перевести на другой язык",
  "lang.promptPlaceholder": "напр. Французский, Хинди, Арабский...",
  "lang.translate": "Перевести",
  "lang.cancel": "Отмена",
};

export default ru;
