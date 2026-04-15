// src/i18n/zh.ts — Simplified Chinese translations

import type { Translations } from "./types";

const zh: Translations = {
  // Autopilot
  "autopilot.clickToStop": "自动驾驶已开启 — 点击停止",
  "autopilot.ariaCancel": "自动驾驶已激活 — 点击取消",

  // Audio
  "audio.mute": "静音",
  "audio.unmute": "取消静音",

  // Toolbar
  "toolbar.restart": "重新开始",
  "toolbar.screenshot": "截图",
  "toolbar.showSolve": "展示如何解答此题",
  "toolbar.share": "分享",
  "toolbar.comments": "评论",
  "toolbar.addComment": "+ 添加评论",

  // Level buttons
  "level.completePrev": "请先完成第 {n} 关",

  // Session report modal
  "report.shareReport": "分享报告",
  "report.creating": "生成中...",
  "report.nextLevel": "下一关",
  "report.playAgain": "再玩一次",
  "report.emailAria": "通过邮件发送报告",
  "report.sendTitle": "通过邮件发送报告",
  "report.enterEmail": "请输入邮箱地址",
  "report.emailPlaceholder": "parent@email.com",
  "report.levelComplete": "第 {level} 关完成！",
  "report.subheading": "怪兽关卡已通过！",
  "report.score": "得分",
  "report.accuracy": "正确率",
  "report.eggs": "彩蛋",
  "report.sendSuccess": "报告已发送至 {email}",
  "report.sendFail": "发送报告失败。",

  // Game
  "game.tapScreen": "点击屏幕！({count}/{total})",
  "game.correct": "正确！",
  "game.wrongAnswer": "错误！正确答案是 {answer}",
  "game.levelComplete": "关卡完成！",
  "game.entryPrompt": "你制造了多少个涟漪？",
  "game.tryOnYourOwn": "自己试一试",
  "game.tapAnywhere": "点击任意位置！",

  // Rotate
  "rotate.heading": "请旋转设备",
  "rotate.subtext": "横屏模式下游戏体验更佳",

  // Social
  "social.shareTitle": "快来看看 Interactive Maths 上的数学游戏！",
  "social.commentsTitle": "DiscussIt 评论",
  "social.youtubePrompt": "第一次玩吗？先看一个如何玩的影片。",
  "social.youtubeDismiss": "不再显示",

  // PDF
  "pdf.title": "涟漪触控",
  "pdf.sessionReport": "学习报告（第 {n} 关）",
  "pdf.gameDescription": "计数与数字认知",
  "pdf.objectiveLabel": "目标：",
  "pdf.objectiveText": "数出屏幕上的涟漪，并在键盘上输入正确数字。",
  "pdf.scoreLabel": "得分",
  "pdf.accuracyLabel": "正确率",
  "pdf.timeLabel": "总用时",
  "pdf.questionLabel": "第{n}题",
  "pdf.correct": "正确",
  "pdf.wrong": "错误",
  "pdf.givenAnswer": "回答：{value}",
  "pdf.correctAnswer": "正确答案：{value}",
  "pdf.rippleCount": "{count} 个涟漪",
  "pdf.durationSeconds": "{seconds}秒",
  "pdf.durationMinutesSeconds": "{minutes}分 {seconds}秒",
  "pdf.encourage90": "太棒了！你是计数冠军！",
  "pdf.encourage70": "做得好！你越来越厉害了！",
  "pdf.encourage50": "不错的尝试！继续练习你会成为高手！",
  "pdf.encourageBelow": "加油！每次尝试都会让你更强！",
  "pdf.tip": "小提示：下次数的时候慢慢来，仔细数！",
  "pdf.footer": "由 SeeMaths - 涟漪触控 生成",
  "pdf.footerUrl": "https://www.seemaths.com",

  // Email
  "email.subject": "{gameName} 报告",
  "email.greeting": "您好，",
  "email.bodyIntro": "一位玩家于 {date} {time} 在 SeeMaths 玩了 {game}，时长 {duration}。得分 {score}，正确率 {accuracy}。",
  "email.curriculumIntro": "此游戏对应 {stageLabel}，主题为 {curriculumCode} - {curriculumDescription}。",
  "email.regards": "此致，",
  "email.invalidEmail": "请输入有效的邮箱地址。",
  "email.missingPdf": "缺少报告附件。",
  "email.notConfigured": "邮件服务未配置。",
  "email.sendFailed": "报告邮件发送失败。",

  // Curriculum
  "curriculum.stageEarlyStage1": "新南威尔士州课程早期阶段 1（幼儿园）",
  "curriculum.outcomeMae1wm": "展示并描述计数顺序",

  // Language switcher
  "lang.label": "语言",
  "lang.en": "English",
  "lang.zh": "中文",
  "lang.es": "Español",
  "lang.ru": "Русский",
  "lang.hi": "हिन्दी",
  "lang.other": "其他...",
  "lang.translating": "翻译中...",
  "lang.translateFail": "翻译失败。",
  "lang.promptTitle": "翻译为其他语言",
  "lang.promptPlaceholder": "例如：法语、印地语、阿拉伯语...",
  "lang.translate": "翻译",
  "lang.cancel": "取消",
};

export default zh;
