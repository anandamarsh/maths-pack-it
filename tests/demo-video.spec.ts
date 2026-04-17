// tests/demo-video.spec.ts — Verifies demo video recording UI elements
// Run: npx playwright test tests/demo-video.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Demo Video Recording", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      class FakeTrack {
        kind: string;
        enabled = true;
        readyState = "live";
        private listeners = new Map<string, Array<() => void>>();

        constructor(kind: string) {
          this.kind = kind;
        }

        stop() {
          this.readyState = "ended";
          this.dispatchEvent("ended");
        }

        addEventListener(type: string, listener: () => void) {
          const current = this.listeners.get(type) ?? [];
          current.push(listener);
          this.listeners.set(type, current);
        }

        removeEventListener(type: string, listener: () => void) {
          const current = this.listeners.get(type) ?? [];
          this.listeners.set(type, current.filter((item) => item !== listener));
        }

        dispatchEvent(type: string) {
          for (const listener of this.listeners.get(type) ?? []) listener();
        }
      }

      class FakeMediaStream {
        private videoTrack = new FakeTrack("video");
        private audioTrack = new FakeTrack("audio");

        getTracks() {
          return [this.videoTrack, this.audioTrack];
        }

        getVideoTracks() {
          return [this.videoTrack];
        }

        getAudioTracks() {
          return [this.audioTrack];
        }
      }

      class FakeMediaRecorder {
        static isTypeSupported() {
          return true;
        }

        stream: FakeMediaStream;
        state: "inactive" | "recording" = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;

        constructor(stream: FakeMediaStream) {
          this.stream = stream;
        }

        start() {
          this.state = "recording";
        }

        stop() {
          if (this.state !== "recording") return;
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["demo"], { type: "video/webm" }) });
          this.onstop?.();
        }
      }

      Object.defineProperty(window.navigator, "mediaDevices", {
        configurable: true,
        value: {
          getDisplayMedia: async () => new FakeMediaStream(),
        },
      });

      Object.defineProperty(window, "MediaRecorder", {
        configurable: true,
        value: FakeMediaRecorder,
      });
    });
  });

  test("video record button is visible in dev mode toolbar", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);

    // The video record button should be visible (dev mode = localhost)
    const videoBtn = page.locator('button[title="Record demo video"]');
    await expect(videoBtn).toBeVisible({ timeout: 5000 });
  });

  test("video record button is next to screenshot button", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);

    // Both buttons should exist
    const screenshotBtn = page.locator('button[title="Screenshot"]');
    const videoBtn = page.locator('button[title="Record demo video"]');
    await expect(screenshotBtn).toBeVisible({ timeout: 5000 });
    await expect(videoBtn).toBeVisible({ timeout: 5000 });

    // Video button should be positioned after screenshot button
    const screenshotBox = await screenshotBtn.boundingBox();
    const videoBox = await videoBtn.boundingBox();
    expect(screenshotBox).not.toBeNull();
    expect(videoBox).not.toBeNull();
    // Video button should be to the right of screenshot button
    expect(videoBox!.x).toBeGreaterThan(screenshotBox!.x);
  });

  test("eggs per round is 2", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);

    // There should be 2 progress dots (eggs), not 3
    const dots = page.locator(".rounded-full.border-2");
    await expect(dots).toHaveCount(2, { timeout: 5000 });
  });

  test("recording starts with the intro template for 5 seconds before gameplay begins", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);

    await page.locator('button[title="Record demo video"]').click();

    const introOverlay = page.getByTestId("demo-overlay-intro");
    const audioButton = page.locator('button[title="Unmute"]');
    const videoButton = page.locator('button[title="Record demo video"]');
    await expect(introOverlay).toBeVisible();
    await expect(audioButton).toBeVisible();
    await expect(videoButton).toBeHidden();

    const introFrame = page.frameLocator('iframe[title="Demo intro screen"]');
    const syllabus = introFrame.getByText("Stage 4");
    const outcome = introFrame.getByText("MA4-RAT-C-01 Solves problems involving ratios and rates using the unitary method");
    const description = introFrame.getByText("Players pack items into equal groups, discover the unit rate, and use that rate to solve scaling problems.");

    await expect(syllabus).toBeVisible();
    await expect(outcome).toBeVisible();
    await expect(description).toBeVisible();
    await expect(description).toHaveCSS("text-align", "left");

    await page.waitForTimeout(4900);
    await expect(introOverlay).toBeVisible();

    await page.waitForTimeout(900);
    await expect(introOverlay).toBeHidden();
  });
});
