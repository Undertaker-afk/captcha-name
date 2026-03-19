import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cringeRatings } from "@/db/schema";

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    const apiKey = process.env.KILO_API_KEY;
    const baseUrl = process.env.KILO_API_URL || "https://api.kilo.ai/api/gateway";

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    const apiUrl = `${baseUrl}/v1/chat/completions`;
    console.log("Cringe score: calling", apiUrl, "model: xiaomi/mimo-v2-pro:free");

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "xiaomi/mimo-v2-pro:free",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a CRINGE INDEX RATING AI for a CAPTCHA system. Your job is to rate how embarrassing, cringeworthy, or humiliating a photo is.

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

Reject anything that looks confident, filtered, posed, or like a stock photo. The photo must contain REAL HUMAN EMBARRASSMENT.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: image,
                },
              },
            ],
          },
        ],
        max_tokens: 250,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Kilo API error:", response.status, errorText);
      return NextResponse.json(
        { error: `AI scoring failed (${response.status}): ${errorText}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    console.log("Kilo API raw response:", JSON.stringify(data).slice(0, 500));
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("Kilo API: empty content in response. Full response:", JSON.stringify(data));
      return NextResponse.json(
        { error: "No response from AI. The model may not support image analysis." },
        { status: 502 }
      );
    }

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return NextResponse.json(
          { error: "Could not parse AI response", raw: content },
          { status: 502 }
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

      try {
        await db.insert(cringeRatings).values({
          overallScore: result.score,
          sweatRating: result.sweat,
          doubleChinRating: result.doubleChin,
          regretRating: result.regret,
          verdict: result.verdict,
          roast: result.roast,
        });
      } catch (dbError) {
        console.error("DB insert failed (non-blocking):", dbError);
      }

      return NextResponse.json(result);
    } catch {
      return NextResponse.json(
        { error: "Invalid AI response format", raw: content },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Cringe score error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
