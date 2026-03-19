import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { image, reason, time, attempts } = await req.json();

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "Blob token not configured" },
        { status: 500 }
      );
    }

    const base64Data = image.split(",")[1] || image;
    const mimeType = image.match(/data:([^;]+);/)?.[1] || "image/png";
    const ext = mimeType.split("/")[1] || "png";

    const buffer = Buffer.from(base64Data, "base64");
    const timestamp = Date.now();
    const filename = `shame/${timestamp}.${ext}`;

    const { url } = await put(filename, buffer, {
      access: "public",
      token,
      contentType: mimeType,
    });

    const metadata = {
      shameUrl: url,
      reason: reason || "unknown",
      time: time || 0,
      attempts: attempts || 0,
      timestamp: new Date().toISOString(),
    };

    const metaFilename = `shame/${timestamp}.json`;
    await put(metaFilename, JSON.stringify(metadata), {
      access: "public",
      token,
      contentType: "application/json",
    });

    return NextResponse.json({ url, metadata });
  } catch (error) {
    console.error("Shame upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload shame" },
      { status: 500 }
    );
  }
}
