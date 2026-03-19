import { list } from "@vercel/blob";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
    <main className="min-h-screen bg-bg p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <div className="mb-4">
            <Link href="/">
              <Button variant="quaternary" size="sm">
                ← Back to CAPTCHA
              </Button>
            </Link>
          </div>
          <h1 className="text-value-big text-fg">Hall of</h1>
          <p className="text-value-small text-accent-error-highlight">Shame</p>
          <p className="text-body text-fg-tertiary max-w-md mx-auto">
            These people tried the CAPTCHA. They failed. Their blurred selfies
            now live here forever.
          </p>
          <Badge variant="defaultMuted">
            {entries.length} failed attempt{entries.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-5xl">👻</div>
            <p className="text-body text-fg-tertiary">
              No shame recorded yet. Be the first to fail.
            </p>
            <Link href="/">
              <Button variant="primary">Try the CAPTCHA</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {entries.map((entry, i) => (
              <div
                key={i}
                className="group relative bg-bg-1 border rounded-lg overflow-hidden hover:border-stroke-active transition-colors"
              >
                <div className="aspect-square relative">
                  <Image
                    src={entry.shameUrl}
                    alt="Failed CAPTCHA attempt"
                    fill
                    className="object-cover blur-xl scale-110"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-bg/40 flex items-center justify-center">
                    <span className="text-4xl">💀</span>
                  </div>
                </div>
                <div className="p-3 space-y-1.5">
                  <Badge
                    variant={entry.reason === "timeout" ? "warning" : "error"}
                  >
                    {entry.reason === "timeout"
                      ? "Ran out of time"
                      : "Wrong solution"}
                  </Badge>
                  <p className="text-label-numeric text-fg-tertiary">
                    {entry.time}s / {entry.attempts} moves
                  </p>
                  <p className="text-label text-fg-tertiary">
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
