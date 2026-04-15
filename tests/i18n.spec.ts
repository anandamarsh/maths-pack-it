// tests/i18n.spec.ts — Verifies internationalisation works across all built-in languages
// Run: npx playwright test tests/i18n.spec.ts

import { test, expect } from "@playwright/test";

// Sample strings from each locale to verify switching works
const LOCALE_CHECKS: Record<string, { tapAnywhere: string; restart: string; mute: string; share: string }> = {
  en: { tapAnywhere: "Tap anywhere!", restart: "Restart", mute: "Mute", share: "Share" },
  zh: { tapAnywhere: "点击任意位置！", restart: "重新开始", mute: "静音", share: "分享" },
  hi: { tapAnywhere: "कहीं भी टैप करें!", restart: "फिर से शुरू करें", mute: "म्यूट करें", share: "साझा करें" },
};

test.describe("i18n — Language Switching", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any saved language preference
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("lang"));
    await page.reload();
    await page.waitForTimeout(500);
  });

  test("defaults to English", async ({ page }) => {
    // Tutorial hint should show English text
    const tutorialHint = page.locator("text=Tap anywhere!");
    await expect(tutorialHint).toBeVisible({ timeout: 5000 });

    // Restart button should have English title
    const restartBtn = page.locator('button[title="Restart"]');
    await expect(restartBtn).toBeVisible();
  });

  test("language globe button is visible in toolbar", async ({ page }) => {
    const globeBtn = page.locator('button[title="Language"]');
    await expect(globeBtn).toBeVisible({ timeout: 5000 });
  });

  test("language dropdown opens and shows only supported languages", async ({ page }) => {
    const globeBtn = page.locator('button[title="Language"]');
    await globeBtn.click();

    // Only English, Chinese, and Hindi should be visible
    await expect(page.locator("text=English")).toBeVisible();
    await expect(page.locator("text=中文")).toBeVisible();
    await expect(page.locator("text=हिन्दी")).toBeVisible();
    await expect(page.locator("text=Español")).toHaveCount(0);
    await expect(page.locator("text=Русский")).toHaveCount(0);
    await expect(page.getByText("Other...")).toHaveCount(0);
  });

  for (const [locale, expected] of Object.entries(LOCALE_CHECKS)) {
    test(`switches to ${locale} and verifies UI text`, async ({ page }) => {
      // Open language dropdown
      const globeBtn = page.locator('button[title="Language"], button[title="语言"], button[title="भाषा"]');
      await globeBtn.click();

      // Get the locale name map
      const names: Record<string, string> = { en: "English", zh: "中文", hi: "हिन्दी" };
      await page.getByText(names[locale]).click();

      // Wait for re-render
      await page.waitForTimeout(300);

      // Check tutorial hint text
      const hint = page.locator(`text=${expected.tapAnywhere}`);
      await expect(hint).toBeVisible({ timeout: 3000 });

      // Check toolbar button titles
      const restartBtn = page.locator(`button[title="${expected.restart}"]`);
      await expect(restartBtn).toBeVisible();

      // Check share button title
      const shareBtn = page.locator(`button[title="${expected.share}"]`);
      await expect(shareBtn).toBeVisible();
    });
  }

  test("language persists after page reload", async ({ page }) => {
    // Switch to Chinese
    const globeBtn = page.locator('button[title="Language"]');
    await globeBtn.click();
    await page.getByText("中文").click();
    await page.waitForTimeout(300);

    // Verify Chinese text is shown
    await expect(page.locator("text=点击任意位置！")).toBeVisible({ timeout: 3000 });

    // Reload page
    await page.reload();
    await page.waitForTimeout(500);

    // Chinese should still be active
    await expect(page.locator("text=点击任意位置！")).toBeVisible({ timeout: 3000 });
  });

  test("current language shows checkmark in dropdown", async ({ page }) => {
    // Default is English, check for checkmark
    const globeBtn = page.locator('button[title="Language"]');
    await globeBtn.click();

    // The English row should have a checkmark
    const englishRow = page.locator("button").filter({ hasText: "English" }).filter({ hasText: "✓" });
    await expect(englishRow).toBeVisible();
  });

  test("dropdown closes on Escape key", async ({ page }) => {
    const globeBtn = page.locator('button[title="Language"]');
    await globeBtn.click();

    // Dropdown should be visible
    await expect(page.locator("text=English")).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    await expect(page.locator("text=English")).not.toBeVisible();
  });
});

test.describe("i18n — Level Complete Modal", () => {
  test("shows translated text in session report modal (Hindi)", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("lang", "hi"));
    await page.reload();
    await page.waitForTimeout(500);

    // Play through a quick game using cheat codes
    // Type 198081 to activate autopilot
    for (const key of "198081") {
      await page.keyboard.press(key);
    }

    // Wait for autopilot to complete level 1 (should see the modal)
    const modalHeading = page.locator("text=स्तर 1 पूरा!");
    await expect(modalHeading).toBeVisible({ timeout: 60000 });

    // Check translated labels
    await expect(page.locator("text=स्कोर")).toBeVisible();
    await expect(page.locator("text=सटीकता")).toBeVisible();
    await expect(page.locator("text=अंडे")).toBeVisible();
    await expect(page.locator("text=रिपोर्ट साझा करें")).toBeVisible();
    await expect(page.locator("text=अगला स्तर")).toBeVisible();
  });
});

test.describe("i18n — Email in Chinese", () => {
  test("sends email with Chinese translated strings", async ({ page }) => {
    // Switch to Chinese
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("lang", "zh"));
    await page.reload();
    await page.waitForTimeout(500);

    // Activate autopilot to play through
    for (const key of "198081") {
      await page.keyboard.press(key);
    }

    // Wait for level complete modal with Chinese text
    const modalHeading = page.locator("text=第 1 关完成！");
    await expect(modalHeading).toBeVisible({ timeout: 60000 });

    // The autopilot should type email and send automatically
    // Wait for the success message in Chinese
    const successMsg = page.locator("text=报告已发送至");
    await expect(successMsg).toBeVisible({ timeout: 30000 });
  });
});
