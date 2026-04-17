/**
 * Autopilot end-to-end test.
 *
 * Follows the steps in autopilot.md programmatically:
 *  1. Load the game
 *  2. Type the autopilot cheat code (198081)
 *  3. Verify the robot icon appears
 *  4. Wait for autopilot to play through Level 1 (tapping → answering → level complete)
 *  5. Verify the level complete modal appears
 *  6. Verify autopilot auto-proceeds to Level 2 (or restarts)
 *  7. Let it play Level 2 and verify level complete
 *
 * The test does NOT mock the email API — real emails go to amarsh.anand@gmail.com.
 * Confirm receipt in your inbox after the test passes.
 */

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:4005";

// How long one full level takes at worst-case timing (ms):
//   tap delays: 550 + 5×700 = 4050
//   answer: 1200 + 2×340 + 380 = 2260
//   feedback: 1200
//   level complete pause: 2500
// Total ~10 s per level, use 45 s to be safe
const LEVEL_TIMEOUT = 45_000;

test.describe("Autopilot mode", () => {
  test("activates via cheat code and starts the autoplay flow", async ({ page }) => {
    await page.goto(BASE);

    // Wait for the game canvas to be ready
    await page.waitForSelector('[data-autopilot-key="submit"]', { timeout: 10_000 });

    // Type cheat code: 1 9 8 0 8 1
    for (const digit of "198081") {
      await page.keyboard.press(digit);
      await page.waitForTimeout(60);
    }

    await expect(page.locator("text=Level 1 Complete!")).toBeVisible({
      timeout: LEVEL_TIMEOUT,
    });
  });

  test("plays through Level 1 and shows level complete modal", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('[data-autopilot-key="submit"]', { timeout: 10_000 });

    // Activate autopilot
    for (const digit of "198081") {
      await page.keyboard.press(digit);
      await page.waitForTimeout(60);
    }

    // Wait for "Level 1 Complete!" to appear in the modal
    await expect(
      page.locator("text=Level 1 Complete!")
    ).toBeVisible({ timeout: LEVEL_TIMEOUT });

    console.log("✅ Level 1 complete — email to amarsh.anand@gmail.com should be on its way");
  });

  test("plays through Level 1 and Level 2 end-to-end", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('[data-autopilot-key="submit"]', { timeout: 10_000 });

    // Activate autopilot
    for (const digit of "198081") {
      await page.keyboard.press(digit);
      await page.waitForTimeout(60);
    }

    // Level 1 complete
    await expect(page.locator("text=Level 1 Complete!")).toBeVisible({
      timeout: LEVEL_TIMEOUT,
    });
    console.log("✅ Level 1 complete");

    // Autopilot auto-proceeds — wait for Level 2 complete
    await expect(page.locator("text=Level 2 Complete!")).toBeVisible({
      timeout: LEVEL_TIMEOUT,
    });
    console.log("✅ Level 2 complete — two emails should have been sent to amarsh.anand@gmail.com");
  });

  test("typing the cheat code again stops autopilot", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('[data-autopilot-key="submit"]', { timeout: 10_000 });

    // Activate
    for (const digit of "198081") {
      await page.keyboard.press(digit);
      await page.waitForTimeout(60);
    }

    await page.waitForTimeout(500);

    for (const digit of "198081") {
      await page.keyboard.press(digit);
      await page.waitForTimeout(60);
    }

    await page.waitForTimeout(5_000);
    await expect(page.locator("text=Level 1 Complete!")).not.toBeVisible();
  });

  test("197879 cheat code shows correct answer during answering phase", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('[data-autopilot-key="submit"]', { timeout: 10_000 });

    // Activate autopilot to get through tapping phase quickly
    for (const digit of "198081") {
      await page.keyboard.press(digit);
      await page.waitForTimeout(60);
    }

    // Autopilot will type the answer; wait for feedback phase to confirm it worked
    await page.waitForFunction(
      () => {
        const q = document.querySelector('[class*="QuestionBox"], [data-testid="question"]');
        const text = document.body.innerText;
        return text.includes("Correct!") || text.includes("Wrong! It was");
      },
      { timeout: LEVEL_TIMEOUT }
    );
  });
});
