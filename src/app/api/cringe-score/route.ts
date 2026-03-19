import { NextRequest, NextResponse } from "next/server";

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
    const baseUrl = process.env.KILO_API_URL || "https://api.kilo.ai/gateway";

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
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

Respond with ONLY a JSON object: {"score": <number>, "verdict": "ACCEPT"|"REJECT", "roast": "<one sentence roasting the photo>"}

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
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Mimo API error:", response.status, errorText);
      return NextResponse.json(
        { error: "AI scoring failed", details: errorText },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "No response from AI" },
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
      return NextResponse.json({
        score: parsed.score,
        verdict: parsed.verdict,
        roast: parsed.roast,
      });
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
