import { test } from "@playwright/test";

test("capture game screenshots", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.waitForSelector(".arcade-grid", { timeout: 5000 });
  await page.waitForTimeout(800);

  // Screenshot 1: initial tapping state
  await page.screenshot({ path: "public/screenshots/ripple-scene-s1.png" });

  // Tap to create ripples
  await page.mouse.click(300, 250);
  await page.waitForTimeout(80);
  await page.mouse.click(500, 180);
  await page.waitForTimeout(80);
  await page.mouse.click(200, 350);
  await page.waitForTimeout(120);

  // Screenshot 2: ripples active
  await page.screenshot({ path: "public/screenshots/ripple-scene-s2.png" });

  await page.mouse.click(650, 300);
  await page.waitForTimeout(80);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(400);

  // Screenshot 3: mid-game
  await page.screenshot({ path: "public/screenshots/ripple-scene-s3.png" });

  // Tap enough to reach answering phase (target is 3-5 taps)
  for (let i = 0; i < 10; i++) {
    await page.mouse.click(250 + i * 35, 200 + (i % 3) * 60);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(700);

  // Screenshot 4: answering phase (keypad visible)
  await page.screenshot({ path: "public/screenshots/ripple-scene-s4.png" });
});
