"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Phase =
  | "upload"
  | "scoring"
  | "rejected"
  | "puzzle"
  | "success"
  | "failed";
type Tile = { id: number; correctIndex: number; currentIndex: number };

const GRID_SIZE = 5;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;
const SLIP_BASE_CHANCE = 0.4;
const SLIP_FAST_CHANCE = 0.7;
const SWEAT_INTERVAL = 2000;
const WOBBLE_INTERVAL = 10000;
const GRIP_FAIL_DURATION = 800;
const PUZZLE_TIME_LIMIT = 30;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateTiles(): Tile[] {
  const indices = Array.from({ length: TOTAL_TILES }, (_, i) => i);
  const shuffled = shuffleArray(indices);
  let attempts = 0;
  while (shuffled.some((v, i) => v === i) && attempts < 100) {
    const newShuffled = shuffleArray(indices);
    shuffled.splice(0, shuffled.length, ...newShuffled);
    attempts++;
  }
  return indices.map((correctIndex) => ({
    id: correctIndex,
    correctIndex,
    currentIndex: shuffled[correctIndex],
  }));
}

function getTileBackgroundStyle(
  slicedImageUrl: string | null,
  correctIndex: number
): React.CSSProperties {
  if (!slicedImageUrl) return {};
  const col = correctIndex % GRID_SIZE;
  const row = Math.floor(correctIndex / GRID_SIZE);
  return {
    backgroundImage: `url(${slicedImageUrl})`,
    backgroundSize: `${GRID_SIZE * 100}% ${GRID_SIZE * 100}%`,
    backgroundPosition: `${(col / (GRID_SIZE - 1)) * 100}% ${(row / (GRID_SIZE - 1)) * 100}%`,
  };
}

function CategoryBar({ label, emoji, value }: { label: string; emoji: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg w-6 text-center">{emoji}</span>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-label text-fg-secondary">{label}</span>
          <span className="text-label-numeric text-accent-main-highlight">{value}/10</span>
        </div>
        <div className="w-full h-1.5 bg-fill rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-main-highlight rounded-full transition-all duration-500"
            style={{ width: `${(value / 10) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function SweatyCaptcha() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [slicedImageUrl, setSlicedImageUrl] = useState<string | null>(null);
  const [roast, setRoast] = useState("");
  const [score, setScore] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [gripFailing, setGripFailing] = useState(false);
  const [sweatDrops, setSweatDrops] = useState<number[]>([]);
  const [wobbling, setWobbling] = useState(false);
  const [slippingTileId, setSlippingTileId] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [failureReason, setFailureReason] = useState("");
  const [sweat, setSweat] = useState(0);
  const [doubleChin, setDoubleChin] = useState(0);
  const [regret, setRegret] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shameUploadedRef = useRef(false);
  const ratingIdRef = useRef<number | undefined>(undefined);

  const [timeLeft, setTimeLeft] = useState(PUZZLE_TIME_LIMIT);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const fireShameUpload = useCallback(
    (reason: string, time: number, moveCount: number, image: string) => {
      if (shameUploadedRef.current) return;
      shameUploadedRef.current = true;
      fetch("/api/shame-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image,
          reason,
          time,
          attempts: moveCount,
          ratingId: ratingIdRef.current,
        }),
      }).catch(() => {});
    },
    []
  );

  const handleFailure = useCallback(
    (reason: string) => {
      cleanup();
      setFailureReason(reason);
      setPhase("failed");
      if (imageDataUrl) {
        fireShameUpload(reason, elapsedTime, attempts, imageDataUrl);
      }
    },
    [cleanup, elapsedTime, attempts, imageDataUrl, fireShameUpload]
  );

  const startPuzzle = useCallback(() => {
    setElapsedTime(0);
    setTimeLeft(PUZZLE_TIME_LIMIT);
    shameUploadedRef.current = false;

    timerRef.current = setInterval(() => {
      setElapsedTime((t) => t + 1);
    }, 1000);

    countdownRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
          setFailureReason("timeout");
          setPhase("failed");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (phase === "failed" && !shameUploadedRef.current && imageDataUrl) {
      fireShameUpload(failureReason, elapsedTime, attempts, imageDataUrl);
    }
  }, [phase, failureReason, elapsedTime, attempts, imageDataUrl, fireShameUpload]);

  const sliceImage = useCallback(
    (imgSrc: string) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
        setSlicedImageUrl(canvas.toDataURL());
        setTiles(generateTiles());
        setPhase("puzzle");
        startPuzzle();
      };
      img.src = imgSrc;
    },
    [startPuzzle]
  );

  const handleUpload = useCallback(
    async (file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        setImageDataUrl(dataUrl);
        shameUploadedRef.current = false;
        ratingIdRef.current = undefined;
        setPhase("scoring");

        try {
          const res = await fetch("/api/cringe-score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl }),
          });

          let data: { error?: string; score?: number; roast?: string; sweat?: number; doubleChin?: number; regret?: number; ratingId?: number };
          try {
            data = await res.json();
          } catch {
            throw new Error(`Server returned non-JSON response (status ${res.status})`);
          }

          if (!res.ok || data.error) {
            setScore(0);
            setSweat(0);
            setDoubleChin(0);
            setRegret(0);
            setRoast(data.error || "Our AI had a meltdown. Try again.");
            setPhase("rejected");
            return;
          }

          setScore(data.score ?? 0);
          setRoast(data.roast || "The AI went silent. How meta.");
          setSweat(data.sweat ?? 1);
          setDoubleChin(data.doubleChin ?? 1);
          setRegret(data.regret ?? 1);
          ratingIdRef.current = data.ratingId;

          if ((data.score ?? 0) >= 85) {
            toast.success("Cringe detected. Brace yourself.");
            sliceImage(dataUrl);
          } else {
            setPhase("rejected");
          }
        } catch (err) {
          setScore(0);
          setSweat(0);
          setDoubleChin(0);
          setRegret(0);
          setRoast(
            err instanceof Error
              ? `Connection failed: ${err.message}`
              : "Network error. The shame will have to wait."
          );
          setPhase("rejected");
        }
      };
      reader.readAsDataURL(file);
    },
    [sliceImage]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        handleUpload(file);
      }
    },
    [handleUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  useEffect(() => {
    if (phase !== "puzzle") return;
    const interval = setInterval(() => {
      const randomTiles = Array.from({ length: 3 }, () =>
        Math.floor(Math.random() * TOTAL_TILES)
      );
      setSweatDrops(randomTiles);
      setTimeout(() => setSweatDrops([]), 1500);
    }, SWEAT_INTERVAL);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== "puzzle") return;
    const interval = setInterval(() => {
      setWobbling(true);
      setTimeout(() => setWobbling(false), 600);
    }, WOBBLE_INTERVAL);
    return () => clearInterval(interval);
  }, [phase]);

  const handleDragStart = useCallback(
    (_e: React.DragEvent, tileId: number) => {
      setDraggingId(tileId);
      if (Math.random() < 0.25) {
        setGripFailing(true);
        setTimeout(() => setGripFailing(false), GRIP_FAIL_DURATION);
      }
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (draggingId === null) return;

      if (Math.random() < SLIP_BASE_CHANCE * 0.03) {
        setSlippingTileId(draggingId);
        setTimeout(() => {
          setSlippingTileId(null);
          setTiles((prev) => {
            const newTiles = [...prev];
            const dragIdx = newTiles.findIndex((t) => t.id === draggingId);
            if (dragIdx === -1) return prev;
            const wrongIndex =
              Math.random() < 0.5
                ? Math.max(0, targetIndex - GRID_SIZE)
                : Math.min(TOTAL_TILES - 1, targetIndex + GRID_SIZE);
            const wrongTileIdx = newTiles.findIndex(
              (t) => t.currentIndex === wrongIndex
            );
            if (wrongTileIdx !== -1 && wrongTileIdx !== dragIdx) {
              const temp = newTiles[dragIdx].currentIndex;
              newTiles[dragIdx].currentIndex =
                newTiles[wrongTileIdx].currentIndex;
              newTiles[wrongTileIdx].currentIndex = temp;
            }
            return newTiles;
          });
          setDraggingId(null);
        }, 200);
      }
    },
    [draggingId]
  );

  const handleDropOnCell = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (draggingId === null) return;

      const slipChance =
        Math.random() < 0.5 ? SLIP_FAST_CHANCE : SLIP_BASE_CHANCE;

      if (Math.random() < slipChance) {
        setSlippingTileId(draggingId);
        setTimeout(() => {
          setSlippingTileId(null);
          const wrongIndex =
            Math.random() < 0.5
              ? Math.max(0, targetIndex - 1)
              : Math.min(TOTAL_TILES - 1, targetIndex + 1);
          setTiles((prev) => {
            const newTiles = [...prev];
            const dragTileIdx = newTiles.findIndex((t) => t.id === draggingId);
            if (dragTileIdx === -1) return prev;
            const targetTileIdx = newTiles.findIndex(
              (t) => t.currentIndex === wrongIndex
            );
            if (targetTileIdx !== -1) {
              const temp = newTiles[dragTileIdx].currentIndex;
              newTiles[dragTileIdx].currentIndex =
                newTiles[targetTileIdx].currentIndex;
              newTiles[targetTileIdx].currentIndex = temp;
            }
            return newTiles;
          });
          setDraggingId(null);
        }, 200);
        return;
      }

      setTiles((prev) => {
        const newTiles = [...prev];
        const dragTileIdx = newTiles.findIndex((t) => t.id === draggingId);
        if (dragTileIdx === -1) return prev;
        const targetTileIdx = newTiles.findIndex(
          (t) => t.currentIndex === targetIndex
        );
        if (targetTileIdx !== -1) {
          const temp = newTiles[dragTileIdx].currentIndex;
          newTiles[dragTileIdx].currentIndex =
            newTiles[targetTileIdx].currentIndex;
          newTiles[targetTileIdx].currentIndex = temp;
        }
        return newTiles;
      });
      setDraggingId(null);
      setAttempts((a) => a + 1);
    },
    [draggingId]
  );

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setSlippingTileId(null);
  }, []);

  const checkSolution = useCallback(() => {
    const solved = tiles.every((t) => t.correctIndex === t.currentIndex);
    if (solved) {
      cleanup();
      setPhase("success");
    } else {
      setWobbling(true);
      setTimeout(() => setWobbling(false), 1000);
      handleFailure("wrong_solution");
    }
  }, [tiles, cleanup, handleFailure]);

  const getTileAtPosition = (currentIndex: number) =>
    tiles.find((t) => t.currentIndex === currentIndex);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const resetAll = useCallback(() => {
    cleanup();
    setPhase("upload");
    setImageDataUrl(null);
    setSlicedImageUrl(null);
    setTiles([]);
    setAttempts(0);
    setElapsedTime(0);
    setTimeLeft(PUZZLE_TIME_LIMIT);
    shameUploadedRef.current = false;
    ratingIdRef.current = undefined;
    setFailureReason("");
    setSweat(0);
    setDoubleChin(0);
    setRegret(0);
  }, [cleanup]);

  const timerUrgent = timeLeft <= 10;
  const timerCritical = timeLeft <= 5;

  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center p-4 relative">
      <a
        href="/gallery"
        className="absolute top-4 right-4"
      >
        <Button variant="secondary" size="default">
          Hall of Shame
        </Button>
      </a>

      <a
        href="/categories"
        className="absolute top-4 left-4"
      >
        <Button variant="secondary" size="default">
          Cringe Categories
        </Button>
      </a>

      <div className="w-full max-w-lg">
        {phase === "upload" && (
          <div className="text-center space-y-8 animate-fade-in">
            <div className="space-y-3">
              <h1 className="text-value-big text-fg">
                Sweaty Selfie
              </h1>
              <p className="text-value-small text-accent-main-highlight">
                Reassembly
              </p>
              <p className="text-body text-fg-tertiary">
                The world&apos;s most humiliating CAPTCHA
              </p>
            </div>

            <div
              className="border border-dashed border-stroke rounded-lg p-12 hover:border-stroke-active transition-colors cursor-pointer bg-bg-1 hover:bg-bg-hover"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
              />
              <div className="space-y-4 flex flex-col items-center">
                <div className="text-5xl">📸</div>
                <Button variant="primary" size="default">
                  Prove you&apos;re not a robot
                </Button>
                <p className="text-body text-fg-secondary">
                  Upload your MOST embarrassing photo
                </p>
                <p className="text-label text-fg-tertiary max-w-xs leading-relaxed">
                  We promise we delete it after&hellip; probably. No stock
                  photos. No filtered selfies. Only pure, unfiltered shame.
                </p>
              </div>
            </div>
          </div>
        )}

        {phase === "scoring" && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="text-5xl animate-pulse">🔍</div>
            <h2 className="text-headline text-fg">
              Analyzing your shame
            </h2>
            <div className="w-48 h-1.5 bg-fill rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-accent-main-highlight rounded-full animate-scan" />
            </div>
            <p className="text-body text-fg-tertiary">
              Our AI is judging you. Hard.
            </p>
          </div>
        )}

        {phase === "rejected" && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="text-5xl">😤</div>
            <h2 className="text-headline text-fg">Rejected</h2>
            <div className="bg-bg-1 border rounded-lg p-6 space-y-3 max-w-md mx-auto">
              <p className="text-body text-fg-secondary italic">
                &ldquo;{roast}&rdquo;
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-label text-fg-tertiary">
                  Cringe score
                </span>
                <Badge variant="error">{score}/100</Badge>
              </div>
              <div className="border-t border-stroke pt-3 space-y-2.5">
                <p className="text-label text-fg-tertiary uppercase tracking-wide">
                  Cringe Categories
                </p>
                <CategoryBar label="Most Sweaty" emoji="💧" value={sweat} />
                <CategoryBar label="Best Double Chin" emoji="😤" value={doubleChin} />
                <CategoryBar label="Peak Regret" emoji="😰" value={regret} />
              </div>
              <p className="text-body text-fg-tertiary">
                Need 85+ to pass. Try something that makes you sweat.
              </p>
            </div>
            <Button variant="primary" onClick={() => { setPhase("upload"); setImageDataUrl(null); }}>
              Try again with something worse
            </Button>
          </div>
        )}

        {phase === "puzzle" && (
          <div className="text-center space-y-4 animate-fade-in">
            <div className="space-y-1">
              <h2 className="text-headline text-fg">
                Reassemble your shame
              </h2>
              <p className="text-body text-accent-main-highlight">
                Careful&hellip; your hands are sweaty
              </p>
            </div>

            <div className="flex justify-between items-center px-2">
              <Badge
                variant={timerCritical ? "error" : timerUrgent ? "warning" : "defaultMuted"}
              >
                {timerCritical && "⏰ "}
                {timeLeft}s
              </Badge>
              <Badge variant="defaultMuted">
                {attempts} moves
              </Badge>
            </div>

            <div
              className={`relative w-full max-w-[420px] mx-auto grid gap-px aspect-square ${
                wobbling ? "animate-wobble" : ""
              } ${gripFailing ? "animate-grip-fail" : ""} ${
                timerCritical ? "animate-panic-shake" : ""
              }`}
              style={{
                gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              }}
            >
              {timerCritical && (
                <div className="absolute inset-0 border-2 border-accent-error-highlight/60 rounded-lg animate-pulse pointer-events-none z-20" />
              )}
              {Array.from({ length: TOTAL_TILES }, (_, cellIndex) => {
                const tile = getTileAtPosition(cellIndex);
                if (!tile) return null;

                const isSweaty = sweatDrops.includes(cellIndex);
                const isSlipping = slippingTileId === tile.id;
                const isDragging = draggingId === tile.id;

                return (
                  <div
                    key={tile.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, tile.id)}
                    onDragOver={(e) => handleDragOver(e, cellIndex)}
                    onDrop={(e) => handleDropOnCell(e, cellIndex)}
                    onDragEnd={handleDragEnd}
                    className={`
                      aspect-square cursor-grab active:cursor-grabbing
                      transition-transform relative overflow-hidden
                      ${isDragging ? "opacity-50 scale-95 z-10" : ""}
                      ${isSlipping ? "animate-slip" : ""}
                      ${isSweaty ? "animate-sweat-glisten" : ""}
                      hover:brightness-110
                    `}
                    style={getTileBackgroundStyle(slicedImageUrl, tile.correctIndex)}
                  >
                    {isSweaty && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="animate-drip text-2xl select-none">
                          💧
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0 right-0 bg-bg-inverted/70 text-fg-inverted text-label px-0.5 rounded-tl pointer-events-none">
                      {tile.correctIndex + 1}
                    </div>
                  </div>
                );
              })}
            </div>

            <Button variant="primary" onClick={checkSolution}>
              I&apos;ve reassembled my shame
            </Button>

            <p className="text-label text-fg-tertiary">
              Fail and your shame gets preserved forever.
            </p>
          </div>
        )}

        {phase === "failed" && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="text-5xl">💀</div>
            <h2 className="text-headline text-accent-error-highlight">
              You failed
            </h2>
            <div className="bg-bg-1 border rounded-lg p-6 max-w-md mx-auto space-y-3">
              {failureReason === "timeout" ? (
                <p className="text-body text-fg-secondary">
                  Time&apos;s up. 30 seconds wasn&apos;t enough.
                </p>
              ) : (
                <p className="text-body text-fg-secondary">
                  Wrong arrangement. You panicked. Classic human move.
                </p>
              )}
              <div className="border-t border-stroke pt-3 space-y-2">
                <Badge variant="warning">Your shame has been preserved</Badge>
                <p className="text-label text-fg-tertiary">
                  Your blurred selfie now lives in the Hall of Shame forever.
                </p>
                <div className="pt-2">
                  <a href="/gallery">
                    <Button variant="secondary" size="sm">
                      Visit the Hall of Shame →
                    </Button>
                  </a>
                </div>
              </div>
            </div>
            <Button variant="primary" onClick={resetAll}>
              Try again (bring a new shame)
            </Button>
          </div>
        )}

        {phase === "success" && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="text-5xl animate-bounce-once">🎉</div>
            <h2 className="text-headline text-fg">
              You did it
            </h2>
            <div className="bg-bg-1 border rounded-lg p-6 max-w-md mx-auto space-y-3">
              <p className="text-body text-fg-secondary">
                Reassembled in{" "}
                <span className="text-accent-main-highlight font-bold">
                  {formatTime(elapsedTime)}
                </span>{" "}
                with{" "}
                <span className="text-accent-main-highlight font-bold">
                  {attempts}
                </span>{" "}
                sweaty moves.
              </p>
              <div className="border-t border-stroke pt-3 space-y-2.5">
                <p className="text-label text-fg-tertiary uppercase tracking-wide">
                  Your Cringe Profile
                </p>
                <CategoryBar label="Most Sweaty" emoji="💧" value={sweat} />
                <CategoryBar label="Best Double Chin" emoji="😤" value={doubleChin} />
                <CategoryBar label="Peak Regret" emoji="😰" value={regret} />
              </div>
              <div className="border-t border-stroke pt-3 space-y-2">
                <Badge variant="positive">CAPTCHA passed</Badge>
                <p className="text-label text-fg-tertiary">
                  Your shame file has been deleted (we swear).
                </p>
                <p className="text-label-numeric text-accent-main-highlight">
                  Bot probability: 0.0000001%
                </p>
              </div>
            </div>
            <Button variant="quaternary" onClick={resetAll}>
              Do it again (you won&apos;t)
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
