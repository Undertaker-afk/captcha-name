import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { cringeRatings } from "@/db/schema";
import { desc } from "drizzle-orm";

interface RatingEntry {
  id: number;
  overallScore: number;
  sweatRating: number;
  doubleChinRating: number;
  regretRating: number;
  verdict: string;
  roast: string;
  createdAt: Date | null;
}

async function getTopRatings(): Promise<RatingEntry[]> {
  try {
    const rows = await db
      .select()
      .from(cringeRatings)
      .orderBy(desc(cringeRatings.createdAt))
      .limit(50);
    return rows as RatingEntry[];
  } catch {
    return [];
  }
}

function CategoryLeaderboard({
  title,
  emoji,
  entries,
  scoreKey,
}: {
  title: string;
  emoji: string;
  entries: RatingEntry[];
  scoreKey: "sweatRating" | "doubleChinRating" | "regretRating";
}) {
  const sorted = [...entries]
    .sort((a, b) => b[scoreKey] - a[scoreKey])
    .slice(0, 10);

  if (sorted.length === 0) {
    return (
      <div className="bg-bg-1 border rounded-lg p-6 space-y-3">
        <h2 className="text-headline text-fg flex items-center gap-2">
          <span>{emoji}</span> {title}
        </h2>
        <p className="text-body text-fg-tertiary">No entries yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-1 border rounded-lg p-6 space-y-4">
      <h2 className="text-headline text-fg flex items-center gap-2">
        <span>{emoji}</span> {title}
      </h2>
      <div className="space-y-2">
        {sorted.map((entry, i) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 p-3 rounded-md bg-bg hover:bg-bg-hover transition-colors"
          >
            <span className="text-label-numeric text-fg-tertiary w-6 text-right">
              {i === 0
                ? "🥇"
                : i === 1
                  ? "🥈"
                  : i === 2
                    ? "🥉"
                    : `#${i + 1}`}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-label text-fg-secondary truncate italic">
                &ldquo;{entry.roast}&rdquo;
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="warning">{entry[scoreKey]}/10</Badge>
              <Badge variant="defaultMuted">{entry.overallScore}/100</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function CategoriesPage() {
  const entries = await getTopRatings();

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
          <h1 className="text-value-big text-fg">Cringe</h1>
          <p className="text-value-small text-accent-main-highlight">
            Categories
          </p>
          <p className="text-body text-fg-tertiary max-w-md mx-auto">
            AI-rated cringe breakdown across three humiliating dimensions. Every
            submission gets judged on sweat, chin, and regret.
          </p>
          <Badge variant="defaultMuted">
            {entries.length} rated submission{entries.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-5xl">🤖</div>
            <p className="text-body text-fg-tertiary">
              No ratings yet. Be the first to get judged.
            </p>
            <Link href="/">
              <Button variant="primary">Try the CAPTCHA</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <CategoryLeaderboard
              title="Most Sweaty"
              emoji="💧"
              entries={entries}
              scoreKey="sweatRating"
            />
            <CategoryLeaderboard
              title="Best Double Chin"
              emoji="😤"
              entries={entries}
              scoreKey="doubleChinRating"
            />
            <CategoryLeaderboard
              title="Peak Regret"
              emoji="😰"
              entries={entries}
              scoreKey="regretRating"
            />
          </div>
        )}
      </div>
    </main>
  );
}
