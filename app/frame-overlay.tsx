"use client";

import { useEffect, useRef } from "react";
import { drawPhotoFrame, type FrameStyle } from "./frame";

export default function FrameOverlay({ image, style }: { image: HTMLImageElement | null; style: FrameStyle }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawPhotoFrame(ctx, image, width, height, style);
    };
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    draw();
    return () => observer.disconnect();
  }, [image, style]);
  return <canvas ref={canvasRef} className="food-frame-art" aria-hidden="true" />;
}
