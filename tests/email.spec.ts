// tests/email.spec.ts — Verifies the email report API sends successfully
// Run: npx playwright test tests/email.spec.ts
// Prerequisite: vercel dev running on http://localhost:3000

import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";
const TEST_EMAIL = "amarsh.anand@gmail.com";

test("sends report email via /api/send-report", async ({ request }) => {
  // Build a minimal valid payload matching what emailReport() sends
  const response = await request.post(`${BASE_URL}/api/send-report`, {
    data: {
      email: TEST_EMAIL,
      // Minimal 1x1 PNG encoded as base64 (a real but tiny PDF-like payload)
      pdfBase64: "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPJ4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQo+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDQKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjE5NQolJUVPRgo=",
      playerName: "Test Explorer",
      correctCount: 3,
      totalQuestions: 3,
      accuracy: 100,
      gameName: "Ripple Touch",
      senderName: "SeeMaths Ripple Touch",
      siteUrl: "https://www.seemaths.com",
      sessionTime: "10:00 am",
      sessionDate: "6th Apr",
      durationText: "2 minutes",
      stageLabel: "Stage 1 (Years 1-2) NSW Curriculum",
      curriculumCode: "MAe-1WM",
      curriculumDescription: "Demonstrates and describes counting sequences",
      reportFileName: "ripple-report-test-explorer.pdf",
    },
  });

  console.log(`\nResponse status: ${response.status()}`);
  const body = await response.json().catch(() => ({}));
  console.log("Response body:", JSON.stringify(body));

  expect(response.status()).toBe(200);
  expect(body.ok).toBe(true);

  console.log(`\n✅ Email sent successfully to ${TEST_EMAIL}`);
  console.log("Check your inbox for the Ripple Touch report.");
});
