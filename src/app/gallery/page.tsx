import { list } from "@vercel/blob";
import Image from "next/image";
import Link from "next/link";

interface ShameEntry {
  shameUrl: string;
  reason: string;
  time: number;
  attempts: number;
  timestamp: string;
}

export default async function GalleryPage() {
  let entries: ShameEntry[] = [];

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new Error("No blob token");
    }

    const { blobs } = await list({ prefix: "shame/", token });
    const jsonBlobs = blobs.filter((b) => b.pathname.endsWith(".json"));

    const results = await Promise.all(
      jsonBlobs.map(async (blob) => {
        try {
          const res = await fetch(blob.url);
          const data = await res.json();
          return data as ShameEntry;
        } catch {
          return null;
        }
      })
    );

    entries = results
      .filter((e): e is ShameEntry => e !== null)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  } catch {
    entries = [];
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-red-950/30 to-gray-950 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <Link
            href="/"
            className="inline-block text-gray-500 hover:text-gray-300 text-sm transition-colors mb-4"
          >
            ← Back to CAPTCHA
          </Link>
          <h1 className="text-4xl font-black text-white tracking-tight">
            Hall of
            <br />
            <span className="text-red-400">Shame</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            These people tried the CAPTCHA. They failed. Their blurred selfies
            now live here forever.
          </p>
          <p className="text-gray-600 text-sm">
            {entries.length} failed attempt{entries.length !== 1 ? "s" : ""}{" "}
            recorded
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-6xl">👻</div>
            <p className="text-gray-500 text-lg">
              No shame recorded yet. Be the first to fail.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors"
            >
              Try the CAPTCHA
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {entries.map((entry, i) => (
              <div
                key={i}
                className="group relative bg-gray-900/60 rounded-xl overflow-hidden border border-gray-800 hover:border-red-500/40 transition-colors"
              >
                <div className="aspect-square relative">
                  <Image
                    src={entry.shameUrl}
                    alt="Failed CAPTCHA attempt"
                    fill
                    className="object-cover blur-xl scale-110"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <span className="text-3xl">💀</span>
                  </div>
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-red-400 text-xs font-bold uppercase tracking-wider">
                    {entry.reason === "timeout"
                      ? "Ran out of time"
                      : "Wrong solution"}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {entry.time}s / {entry.attempts} moves
                  </p>
                  <p className="text-gray-600 text-[10px]">
                    {new Date(entry.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
