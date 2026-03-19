import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/db";
import { cringeRatings } from "@/db/schema";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit for base64 image data

const CRINGE_PROMPT = `You are a CRINGE INDEX RATING AI for a CAPTCHA system. Your job is to rate how embarrassing, cringeworthy, or humiliating a photo is.

Rate the image on a scale of 0-100 based on these criteria:
- Visible regret, distress, or emotional discomfort
- Bad lighting, unflattering angle, or poor photo quality
- Awkward expression (double chin, mid-sneeze, crying face, etc.)
- Signs of intoxication, dishevelment, or general life failure
- The kind of photo someone would be MORTIFIED to show publicly

SCORING GUIDE:
- 0-30: Polished, filtered, confident, or generic. REJECT.
- 31-60: Somewhat unflattering but not truly embarrassing. REJECT.
- 61-84: Noticeably embarrassing but not peak cringe. REJECT.
- 85-100: Genuinely mortifying. The person would die if this went public. ACCEPT.

Also rate these CRINGE CATEGORIES from 1 to 10:
- sweat: How sweaty, gross, or glistening does the person look? (1 = pristine, 10 = drenched)
- double_chin: How prominent is the double chin or unflattering jaw/neck situation? (1 = chiseled, 10 = full turkey neck)
- regret: How much visible regret, despair, or "why did I take this" energy does the photo radiate? (1 = confident king/queen, 10 = pure existential dread)

Respond with ONLY a JSON object: {"score": <number 0-100>, "verdict": "ACCEPT"|"REJECT", "roast": "<one sentence roasting the photo>", "sweat": <number 1-10>, "double_chin": <number 1-10>, "regret": <number 1-10>}

Reject anything that looks confident, filtered, posed, or like a stock photo. The photo must contain REAL HUMAN EMBARRASSMENT.`;

function jsonResponse(data: Record<string, unknown>, status: number) {
  return NextResponse.json(data, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.KILO_API_KEY;
    const baseUrl =
      process.env.KILO_API_URL || "https://api.kilo.ai/api/gateway";

    if (!apiKey) {
      return jsonResponse(
        {
          error:
            "KILO_API_KEY is not configured. Set it in your .env.local file.",
        },
        500
      );
    }

    let body: { image?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON in request body" }, 400);
    }

    const { image } = body;

    if (!image) {
      return jsonResponse({ error: "No image provided" }, 400);
    }

    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return jsonResponse(
        { error: "Image must be a base64 data URL (data:image/...)" },
        400
      );
    }

    if (image.length > MAX_IMAGE_SIZE_BYTES) {
      return jsonResponse(
        {
          error: `Image too large (${(image.length / 1024 / 1024).toFixed(1)}MB). Max allowed: 5MB.`,
        },
        400
      );
    }

    const client = new OpenAI({ apiKey, baseURL: baseUrl });

    const completion = await client.chat.completions.create({
      model: "xiaomi/mimo-v2-pro:free",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: CRINGE_PROMPT },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      max_tokens: 250,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      return jsonResponse(
        {
          error:
            "No response from AI. The model may not support image analysis.",
        },
        502
      );
    }

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return jsonResponse(
          { error: "Could not parse AI response", raw: content },
          502
        );
      }
      const parsed = JSON.parse(jsonMatch[0]);

      const result = {
        score: parsed.score,
        verdict: parsed.verdict,
        roast: parsed.roast,
        sweat: parsed.sweat ?? 1,
        doubleChin: parsed.double_chin ?? 1,
        regret: parsed.regret ?? 1,
      };

      let ratingId: number | undefined;
      try {
        const [inserted] = await db
          .insert(cringeRatings)
          .values({
            overallScore: result.score,
            sweatRating: result.sweat,
            doubleChinRating: result.doubleChin,
            regretRating: result.regret,
            verdict: result.verdict,
            roast: result.roast,
          })
          .returning({ id: cringeRatings.id });
        ratingId = inserted?.id;
      } catch (dbError) {
        console.error("DB insert failed (non-blocking):", dbError);
      }

      return jsonResponse({ ...result, ratingId }, 200);
    } catch {
      return jsonResponse(
        { error: "Invalid AI response format", raw: content },
        502
      );
    }
  } catch (error) {
    console.error("Cringe score error:", error);
    const message =
      error instanceof OpenAI.APIError
        ? `AI scoring failed (${error.status}): ${error.message}`
        : "Internal server error";
    const status = error instanceof OpenAI.APIError ? 502 : 500;
    return jsonResponse({ error: message }, status);
  }
}
