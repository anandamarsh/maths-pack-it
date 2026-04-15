export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};

function normalizeBody(body: unknown) {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body && typeof body === "object" ? body : null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Translation service is not configured. Set OPENAI_API_KEY." });
    return;
  }

  const payload = normalizeBody(req.body) as {
    targetLang?: string;
    strings?: Record<string, string>;
  } | null;

  const targetLang = payload?.targetLang?.trim();
  const strings = payload?.strings;

  if (!targetLang) {
    res.status(400).json({ error: "Missing targetLang." });
    return;
  }
  if (!strings || typeof strings !== "object" || Object.keys(strings).length === 0) {
    res.status(400).json({ error: "Missing strings object." });
    return;
  }

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the JSON object values from English to ${targetLang}. Rules:
1. Preserve all {placeholder} tokens exactly as-is (e.g. {count}, {email}, {level}).
2. Do not translate URLs.
3. Do not translate brand names like "SeeMaths", "Ripple Touch", "DiscussIt", "Interactive Maths".
4. Return a valid JSON object with the same keys.
5. Also include a "langCode" field with the ISO 639-1 two-letter code for the target language.
6. The response must be a JSON object with two fields: "translations" (the translated strings) and "langCode".`,
          },
          {
            role: "user",
            content: JSON.stringify(strings),
          },
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error("OpenAI API error:", errText);
      res.status(502).json({ error: "Translation API request failed." });
      return;
    }

    const data = await openaiResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      res.status(502).json({ error: "Empty response from translation API." });
      return;
    }

    const parsed = JSON.parse(content) as {
      translations?: Record<string, string>;
      langCode?: string;
    };

    if (!parsed.translations || typeof parsed.translations !== "object") {
      res.status(502).json({ error: "Invalid translation response format." });
      return;
    }

    res.status(200).json({
      translations: parsed.translations,
      langCode: parsed.langCode || targetLang.toLowerCase().slice(0, 2),
    });
  } catch (err) {
    console.error("Translation error:", err);
    res.status(500).json({ error: "Translation failed." });
  }
}
