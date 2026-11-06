import type { Metadata } from "next";
import MemeCamera from "./meme-camera";
import "./meme.css";

export const metadata: Metadata = {
  title: "表情包换脸 · Meme Face — Little Moments",
  description: "把你的五官放进自己的表情包。Make your own expression meme, entirely on your device.",
};

export default function MemePage() {
  return <MemeCamera />;
}
