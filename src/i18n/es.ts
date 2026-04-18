// src/i18n/es.ts — Spanish translations

import type { Translations } from "./types";

const es: Translations = {
  // Autopilot
  "autopilot.clickToStop": "Piloto automático ACTIVADO — clic para detener",
  "autopilot.ariaCancel": "Piloto automático activo — clic para cancelar",

  // Audio
  "audio.mute": "Silenciar",
  "audio.unmute": "Activar sonido",

  // Toolbar
  "toolbar.restart": "Reiniciar",
  "toolbar.screenshot": "Captura de pantalla",
  "toolbar.showSolve": "Mostrar cómo resolver esta pregunta",
  "toolbar.share": "Compartir",
  "toolbar.comments": "Comentarios",
  "toolbar.addComment": "+ Añadir comentario",

  // Level buttons
  "level.completePrev": "Completa el Nivel {n} primero",

  // Session report modal
  "report.shareReport": "Compartir informe",
  "report.creating": "Creando...",
  "report.nextLevel": "Siguiente nivel",
  "report.playAgain": "Jugar de nuevo",
  "report.emailAria": "Enviar informe por correo",
  "report.sendTitle": "Enviar el informe por correo electrónico",
  "report.enterEmail": "Introduce una dirección de correo",
  "report.emailPlaceholder": "padre@email.com",
  "report.levelComplete": "¡Nivel {level} completado!",
  "report.subheading": "¡Ronda monstruo superada!",
  "report.score": "Puntuación",
  "report.accuracy": "Precisión",
  "report.eggs": "Huevos",
  "report.sendSuccess": "Informe enviado a {email}",
  "report.sendFail": "Error al enviar el informe.",

  // Game
  "game.tapScreen": "¡Toca la pantalla! ({count}/{total})",
  "game.correct": "¡Correcto!",
  "game.wrongAnswer": "¡Incorrecto! Era {answer}",
  "game.levelComplete": "¡Nivel completado!",
  "game.entryPrompt": "¿Cuántas ondas hiciste?",
  "game.tryOnYourOwn": "Inténtalo tú mismo",
  "game.tapAnywhere": "¡Toca en cualquier lugar!",
  "game.next": "Siguiente",
  "game.answerLabel": "Respuesta:",
  "game.roundLoad": "Cargar",
  "game.roundPack": "Empacar",
  "game.roundShip": "Enviar",
  "game.complete": "Completado",
  "game.nextRound": "Siguiente",

  // Rotate
  "rotate.heading": "Gira tu dispositivo",
  "rotate.subtext": "Este juego funciona mejor en modo horizontal",

  // Social
  "social.shareTitle": "¡Mira este juego de matemáticas en Interactive Maths!",
  "social.commentsTitle": "Comentarios de DiscussIt",
  "social.youtubePrompt": "¿Es tu primera vez? Mira un video sobre cómo jugar.",
  "social.youtubeDismiss": "No volver a mostrar",
  "social.watchHowToPlay": "Ver cómo jugar",
  "social.howToPlayVideo": "Video de cómo jugar",
  "social.closeHowToPlayVideo": "Cerrar video de cómo jugar",
  "social.howToPlayVideoPrompt": "Aviso del video de cómo jugar",
  "dev.recordDemoVideo": "Grabar video de demostración",

  // PDF
  "pdf.title": "Pack It!",
  "pdf.sessionReport": "Informe de sesión (Nivel {n})",
  "pdf.gameDescription": "Método unitario y tasas unitarias",
  "pdf.objectiveLabel": "Objetivo:",
  "pdf.objectiveText": "Agrupa objetos en partes iguales, encuentra la tasa unitaria y úsala para resolver la pregunta.",
  "pdf.scoreLabel": "Puntuación",
  "pdf.accuracyLabel": "Precisión",
  "pdf.timeLabel": "Tiempo total",
  "pdf.questionLabel": "P{n}",
  "pdf.correct": "CORRECTO",
  "pdf.wrong": "INCORRECTO",
  "pdf.givenAnswer": "Respuesta dada: {value}",
  "pdf.correctAnswer": "Respuesta correcta: {value}",
  "pdf.rippleCount": "{count} onda(s)",
  "pdf.durationSeconds": "{seconds} s",
  "pdf.durationMinutesSeconds": "{minutes} min {seconds} s",
  "pdf.encourage90": "¡Increíble! ¡Eres un campeón del conteo!",
  "pdf.encourage70": "¡Buen trabajo! ¡Cada vez lo haces mejor!",
  "pdf.encourage50": "¡Buen esfuerzo! ¡Sigue practicando y serás un experto!",
  "pdf.encourageBelow": "¡Buen intento! ¡Cada intento te hace más fuerte!",
  "pdf.tip": "Consejo: Intenta contar con más cuidado la próxima vez — ¡tómate tu tiempo!",
  "pdf.footer": "Generado por SeeMaths - Pack It!",
  "pdf.footerUrl": "https://www.seemaths.com",

  // Email
  "email.subject": "Informe de {gameName}",
  "email.greeting": "Hola,",
  "email.bodyIntro": "Un jugador jugó {game} en SeeMaths a las {time} el {date} durante {duration}. Obtuvo {score} con una precisión del {accuracy}.",
  "email.curriculumIntro": "Este juego es equivalente a {stageLabel} en el tema {curriculumCode} - {curriculumDescription}.",
  "email.regards": "Saludos,",
  "email.invalidEmail": "Introduce una dirección de correo válida.",
  "email.missingPdf": "Falta el archivo adjunto del informe.",
  "email.notConfigured": "El servicio de correo no está configurado.",
  "email.sendFailed": "No se pudo enviar el correo del informe.",

  // Curriculum
  "curriculum.stageEarlyStage1": "Matemáticas de NSW Etapa 4",
  "curriculum.outcomeMae1wm": "Resuelve problemas de razones y tasas usando el método unitario",

  // Language switcher
  "lang.label": "Idioma",
  "lang.en": "English",
  "lang.zh": "中文",
  "lang.es": "Español",
  "lang.ru": "Русский",
  "lang.hi": "हिन्दी",
  "lang.other": "Otro...",
  "lang.translating": "Traduciendo...",
  "lang.translateFail": "Error en la traducción.",
  "lang.promptTitle": "Traducir a otro idioma",
  "lang.promptPlaceholder": "p.ej. Francés, Hindi, Árabe...",
  "lang.translate": "Traducir",
  "lang.cancel": "Cancelar",
};

export default es;
