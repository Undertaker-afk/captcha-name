"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "upload" | "scoring" | "rejected" | "puzzle" | "success";
type Tile = { id: number; correctIndex: number; currentIndex: number };

const GRID_SIZE = 5;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;
const SLIP_BASE_CHANCE = 0.4;
const SLIP_FAST_CHANCE = 0.7;
const FAST_VELOCITY = 800;
const SWEAT_INTERVAL = 2000;
const WOBBLE_INTERVAL = 10000;
const GRIP_FAIL_DURATION = 800;

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

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    setElapsedTime(0);
    timerRef.current = setInterval(() => {
      setElapsedTime((t) => t + 1);
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
        startTimer();
      };
      img.src = imgSrc;
    },
    [startTimer]
  );

  const handleUpload = useCallback(
    async (file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        setImageDataUrl(dataUrl);
        setPhase("scoring");

        try {
          const res = await fetch("/api/cringe-score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl }),
          });
          const data = await res.json();

          if (!res.ok || data.error) {
            setRoast(data.error || "Our AI had a meltdown. Try again.");
            setPhase("rejected");
            return;
          }

          setScore(data.score);
          setRoast(data.roast);

          if (data.score >= 85) {
            sliceImage(dataUrl);
          } else {
            setPhase("rejected");
          }
        } catch {
          setRoast("Network error. The shame will have to wait.");
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

  // Sweat drops effect
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

  // Wobble effect
  useEffect(() => {
    if (phase !== "puzzle") return;
    const interval = setInterval(() => {
      setWobbling(true);
      setTimeout(() => setWobbling(false), 600);
    }, WOBBLE_INTERVAL);
    return () => clearInterval(interval);
  }, [phase]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, tileId: number) => {
      setDraggingId(tileId);

      // Random grip failure
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

      // Slip check during drag-over
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
        return;
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
      if (timerRef.current) clearInterval(timerRef.current);
      setPhase("success");
    } else {
      setWobbling(true);
      setTimeout(() => setWobbling(false), 1000);
    }
  }, [tiles]);

  const getTileAtPosition = (currentIndex: number) =>
    tiles.find((t) => t.currentIndex === currentIndex);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {phase === "upload" && (
          <div className="text-center space-y-8 animate-fade-in">
            <div className="space-y-3">
              <h1 className="text-4xl font-black text-white tracking-tight">
                Sweaty Selfie
                <br />
                <span className="text-purple-400">Reassembly</span>
              </h1>
              <p className="text-gray-400 text-lg">
                The world&apos;s most humiliating CAPTCHA
              </p>
            </div>

            <div
              className="border-2 border-dashed border-purple-500/50 rounded-2xl p-12 hover:border-purple-400 transition-colors cursor-pointer bg-purple-950/30 hover:bg-purple-950/50"
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
              <div className="space-y-4">
                <div className="text-6xl">📸</div>
                <button className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white text-xl font-bold rounded-xl transition-colors shadow-lg shadow-purple-600/30">
                  Prove you&apos;re not a robot
                  <br />
                  <span className="text-sm font-normal text-purple-200">
                    Upload your MOST embarrassing photo
                  </span>
                </button>
                <p className="text-[6px] text-gray-600 max-w-xs mx-auto leading-relaxed">
                  We promise we delete it after&hellip; probably. By uploading
                  you agree to temporary self-roasting. No stock photos. No
                  filtered selfies. Only pure, unfiltered shame.
                </p>
              </div>
            </div>
          </div>
        )}

        {phase === "scoring" && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="text-6xl animate-pulse">🔍</div>
            <h2 className="text-2xl font-bold text-white">
              Analyzing your shame&hellip;
            </h2>
            <div className="w-48 h-2 bg-gray-800 rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full animate-scan" />
            </div>
            <p className="text-gray-500 text-sm">
              Our AI is judging you. Hard.
            </p>
          </div>
        )}

        {phase === "rejected" && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="text-6xl">😤</div>
            <h2 className="text-2xl font-bold text-white">Rejected.</h2>
            <div className="bg-gray-900/80 rounded-xl p-6 space-y-3 max-w-md mx-auto">
              <p className="text-purple-300 text-lg italic">
                &ldquo;{roast}&rdquo;
              </p>
              <p className="text-gray-400">
                Cringe score:{" "}
                <span className="text-red-400 font-bold">{score}/100</span>
              </p>
              <p className="text-gray-500 text-sm">
                Cute. Try again with something that makes you sweat just looking
                at it. Need 85+.
              </p>
            </div>
            <button
              onClick={() => {
                setPhase("upload");
                setImageDataUrl(null);
              }}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors"
            >
              Try again with something worse
            </button>
          </div>
        )}

        {phase === "puzzle" && (
          <div className="text-center space-y-4 animate-fade-in">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">
                Reassemble your shame.
              </h2>
              <p className="text-purple-400 text-sm">
                Careful&hellip; your hands are sweaty from the embarrassment.
              </p>
            </div>

            <div className="flex justify-between text-sm text-gray-500 px-2">
              <span>⏱️ {formatTime(elapsedTime)}</span>
              <span>🔄 {attempts} moves</span>
            </div>

            <div
              className={`grid gap-1 mx-auto aspect-square ${wobbling ? "animate-wobble" : ""} ${gripFailing ? "animate-grip-fail" : ""}`}
              style={{
                gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                maxWidth: "420px",
              }}
            >
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
                      aspect-square rounded-sm cursor-grab active:cursor-grabbing
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
                    <div className="absolute bottom-0 right-0 bg-black/60 text-white text-[8px] px-1 rounded-tl-sm pointer-events-none">
                      {tile.correctIndex + 1}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={checkSolution}
              className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-green-600/30"
            >
              I&apos;ve reassembled my shame
            </button>

            <p className="text-gray-600 text-[10px]">
              Drag tiles to match the original image. The grid wobbles because
              you&apos;re panicking.
            </p>
          </div>
        )}

        {phase === "success" && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="text-6xl animate-bounce-once">🎉</div>
            <h2 className="text-2xl font-bold text-white">You did it.</h2>
            <div className="bg-gray-900/80 rounded-xl p-6 max-w-md mx-auto space-y-3">
              <p className="text-gray-300 leading-relaxed">
                You stared at your worst photo for{" "}
                <span className="text-purple-400 font-bold">
                  {formatTime(elapsedTime)}
                </span>{" "}
                while your fake sweaty hands betrayed you{" "}
                <span className="text-purple-400 font-bold">{attempts}</span>{" "}
                times.
              </p>
              <div className="border-t border-gray-700 pt-3 space-y-2">
                <p className="text-green-400 font-bold text-lg">
                  CAPTCHA passed.
                </p>
                <p className="text-gray-500 text-sm">
                  Your shame file has been deleted (we swear).
                </p>
                <p className="text-purple-400 font-mono text-sm">
                  Bot probability: 0.0000001%
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setPhase("upload");
                setImageDataUrl(null);
                setTiles([]);
                setAttempts(0);
                setElapsedTime(0);
              }}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl transition-colors"
            >
              Do it again (you won&apos;t)
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
