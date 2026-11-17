"use client";

import { useState, type PointerEvent, type RefObject } from "react";
import type { Roi } from "../hooks/useVibrationMonitor";

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  roi: Roi;
  onRoiChange: (roi: Roi) => void;
  isRunning: boolean;
};

type Point = { x: number; y: number };

const MIN_BOX = 0.04;
const DEFAULT_ASPECT = 16 / 9;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function boxFrom(a: Point, b: Point): Roi {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

export function CameraView({ videoRef, roi, onRoiChange, isRunning }: Props) {
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const [drag, setDrag] = useState<{ from: Point; to: Point } | null>(null);
  const shown = drag ? boxFrom(drag.from, drag.to) : roi;

  const pointAt = (event: PointerEvent<HTMLDivElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    };
  };

  const handleDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointAt(event);
    setDrag({ from: point, to: point });
  };

  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag) setDrag({ from: drag.from, to: pointAt(event) });
  };

  const handleUp = () => {
    if (!drag) return;
    const box = boxFrom(drag.from, drag.to);
    if (box.w >= MIN_BOX && box.h >= MIN_BOX) onRoiChange(box);
    setDrag(null);
  };

  return (
    <div
      className="relative w-full cursor-crosshair touch-none overflow-hidden bg-ink select-none"
      style={{ aspectRatio: aspect }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        className="size-full object-fill"
        onLoadedMetadata={(event) =>
          setAspect(event.currentTarget.videoWidth / event.currentTarget.videoHeight)
        }
      />
      {!isRunning && (
        <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-white/70">
          start, then drag a box around the moving part
        </p>
      )}
      {isRunning && <div
        className="pointer-events-none absolute ring-2 ring-watch-box"
        style={{
          left: `${shown.x * 100}%`,
          top: `${shown.y * 100}%`,
          width: `${shown.w * 100}%`,
          height: `${shown.h * 100}%`,
          boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.3)",
        }}
      />}
    </div>
  );
}
