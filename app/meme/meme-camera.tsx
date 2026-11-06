"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import AlignmentOverlay from "./alignment-overlay";
import { previewCrop, makePhotoOutput } from "../photo";
import { composeMeme, DEFAULT_ADJUSTMENTS, type Landmark, type MemeAdjustments } from "./processing";

const TEMPLATE = "/memes/thinking-template.jpg";
const EXAMPLE = "/memes/thinking-example.jpg";
type Status = "idle" | "requesting" | "ready" | "denied" | "error";
type Capture = { source: HTMLCanvasElement; points: Landmark[] };

// The native runtime writes this informational message to stderr. Preserve
// real errors while giving that one message its correct browser log level.
async function nativeFaceOperation<T>(action: () => T | Promise<T>): Promise<T> {
  const previous = console.error;
  const forward = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("INFO: Created TensorFlow Lite XNNPACK delegate")) console.info(...args);
    else previous(...args);
  };
  console.error = forward;
  try { return await action(); }
  finally { if (console.error === forward) console.error = previous; }
}

function CameraIcon() {
  return <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m8 5 2-2h4l2 2h3a2 2 0 0 1 2 2v12H3V7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="12" r="4"/></svg>;
}

export default function MemeCamera() {
  const [status, setStatus] = useState<Status>("idle");
  const [modelStatus, setModelStatus] = useState("idle");
  const [template, setTemplate] = useState<HTMLImageElement | null>(null);
  const [captured, setCaptured] = useState<Capture[] | null>(null);
  const [resultUrl, setResultUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [shotCount, setShotCount] = useState<1 | 4>(1);
  const [shot, setShot] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adjust, setAdjust] = useState<MemeAdjustments>({ ...DEFAULT_ADJUSTMENTS });
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<FaceLandmarker | null>(null);
  const modelPromise = useRef<Promise<FaceLandmarker> | null>(null);
  const fileRef = useRef<File | null>(null);
  const operation = useRef(0);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const resultAnchor = useRef<HTMLDivElement>(null);

  function stopCamera() {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach(track => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => {
    mounted.current = true;
    let active = true;
    const image = new Image();
    image.onload = () => { if (active) setTemplate(image); };
    image.onerror = () => { if (active) setError("模板没加载成功，请刷新页面。 / Please refresh to load the template."); };
    image.src = TEMPLATE;
    const hidden = () => {
      if (!document.hidden || !streamRef.current) return;
      ++operation.current;
      stopCamera();
      busyRef.current = false;
      setBusy(false);
      setCountdown(null);
      setFlash(false);
      setStatus("idle");
    };
    const resize = () => {
      if (!busyRef.current) return;
      ++operation.current;
      busyRef.current = false;
      setBusy(false);
      setCountdown(null);
      setFlash(false);
      setNotice("画面尺寸变了，请重新拍摄。 / The view changed size. Please take another photo.");
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("resize", resize);
    return () => {
      active = false;
      mounted.current = false;
      ++operation.current;
      stopCamera();
      detectorRef.current?.close();
      detectorRef.current = null;
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  useEffect(() => {
    if (!captured || !template) return;
    let cancelled = false;
    setRendering(true);
    fileRef.current = null;
    void (async () => {
      try {
        const photos = captured.map(frame => composeMeme(template, frame.source, frame.points, adjust).toDataURL("image/png"));
        const blob = await makePhotoOutput(photos, new Date());
        if (cancelled || !mounted.current) return;
        fileRef.current = new File([blob], `my-meme-${Date.now()}.png`, { type: "image/png" });
        setResultUrl(URL.createObjectURL(blob));
        setRendering(false);
      } catch (cause) {
        if (cancelled || !mounted.current) return;
        setError(cause instanceof Error ? cause.message : "生成失败，请重拍。 / Please retake.");
        setRendering(false);
      }
    })();
    return () => { cancelled = true; };
  }, [captured, template, adjust]);

  async function prepareModel(): Promise<FaceLandmarker> {
    if (detectorRef.current) return detectorRef.current;
    if (modelPromise.current) return modelPromise.current;
    setModelStatus("loading");
    const pending = (async () => {
      const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("/mediapipe");
      const detector = await nativeFaceOperation(() => FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "CPU" },
        runningMode: "IMAGE",
        numFaces: 1,
        minFaceDetectionConfidence: .45,
        minFacePresenceConfidence: .45,
      }));
      if (!mounted.current) { detector.close(); throw new DOMException("Cancelled", "AbortError"); }
      detectorRef.current = detector;
      setModelStatus("ready");
      return detector;
    })();
    modelPromise.current = pending;
    try { return await pending; }
    catch (cause) {
      modelPromise.current = null;
      if (mounted.current) setModelStatus("error");
      throw cause;
    }
  }

  async function startCamera() {
    if (status === "requesting" || busyRef.current) return;
    const id = ++operation.current;
    stopCamera();
    setStatus("requesting");
    setError("");
    setNotice("");
    void prepareModel().catch(() => {
      if (mounted.current) setError("五官处理器没能加载。请点击重新准备。 / Could not load the face processor. Tap Retry processor.");
    });
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("相机需要 HTTPS 或本机 localhost。 / Camera access requires HTTPS or localhost.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } } });
      if (!mounted.current || operation.current !== id) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stopCamera(); return; }
      video.srcObject = stream;
      await video.play();
      if (!mounted.current || operation.current !== id) return;
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        if (streamRef.current !== stream) return;
        ++operation.current;
        stopCamera();
        busyRef.current = false;
        setBusy(false);
        setCountdown(null);
        setStatus("error");
        setError("相机断开了，请重新开启。 / Your camera disconnected. Please enable it again.");
      });
      setStatus("ready");
    } catch (cause) {
      if (!mounted.current || operation.current !== id) return;
      stopCamera();
      const denied = cause instanceof DOMException && cause.name === "NotAllowedError";
      setStatus(denied ? "denied" : "error");
      setError(denied ? "请在浏览器的网站设置中允许相机，然后重试。iPhone：Safari 页面菜单 → 网站设置 → 相机 → 允许。 / Allow Camera in this site’s browser settings, then try again."
        : cause instanceof DOMException && cause.name === "NotFoundError" ? "没有找到相机，请连接摄像头或用手机打开。 / No camera found. Connect one or use your phone."
        : cause instanceof DOMException && cause.name === "NotReadableError" ? "相机可能被其他应用占用，请关闭后重试。 / Your camera may be in use by another app."
        : cause instanceof Error ? cause.message : "相机无法开启，请重试。 / Please try enabling your camera again.");
    }
  }

  async function readFace(source: HTMLCanvasElement, detector: FaceLandmarker): Promise<Capture> {
    const points = (await nativeFaceOperation(() => detector.detect(source))).faceLandmarks[0];
    if (!points?.length) throw new Error("没有识别到脸，请把双眼移入模板的虚线眼框，光线亮一点再拍。 / No face found. Line up your eyes with the template openings in good lighting.");
    return { source, points };
  }

  function finishCapture(frames: Capture[]) {
    setAdjust({ ...DEFAULT_ADJUSTMENTS });
    setCaptured(frames);
    stopCamera();
    setStatus("idle");
    setNotice("已按模板的眼睛位置对齐五官。 / Your features are aligned with the template openings.");
    resultAnchor.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  async function capture() {
    if (busyRef.current || status !== "ready" || !detectorRef.current || !template) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const id = ++operation.current;
    const check = () => { if (!mounted.current || operation.current !== id) throw new DOMException("Cancelled", "AbortError"); };
    try {
      const frames: Capture[] = [];
      for (let index = 0; index < shotCount; index++) {
        setShot(index + 1);
        for (let count = 3; count > 0; count--) {
          setCountdown(count);
          await new Promise(resolve => setTimeout(resolve, 1000));
          check();
        }
        setCountdown(null);
        const video = videoRef.current;
        const guide = guideRef.current;
        if (!video || !guide || video.readyState < 2 || !video.videoWidth) throw new Error("相机暂停了，请重试。 / Your camera paused. Please try again.");
        const bounds = guide.getBoundingClientRect();
        const crop = previewCrop(video.videoWidth, video.videoHeight, video.getBoundingClientRect(), bounds);
        const source = document.createElement("canvas");
        source.width = 800;
        source.height = Math.round(800 * bounds.height / bounds.width);
        const ctx = source.getContext("2d")!;
        ctx.translate(source.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, source.width, source.height);
        setFlash(true);
        await new Promise(resolve => setTimeout(resolve, 120));
        check();
        setFlash(false);
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        check();
        frames.push(await readFace(source, detectorRef.current));
        check();
      }
      finishCapture(frames);
    } catch (cause) {
      if (mounted.current && operation.current === id && !(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "拍摄失败，请重试。 / Please try again.");
    } finally {
      if (mounted.current && operation.current === id) {
        busyRef.current = false;
        setBusy(false);
        setFlash(false);
        setCountdown(null);
      }
    }
  }

  async function trySample() {
    if (busyRef.current || !template) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    const id = ++operation.current;
    try {
      const detector = await prepareModel();
      const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("示例加载失败。 / Could not load the example.")); image.src = EXAMPLE; });
      if (!mounted.current || operation.current !== id) return;
      const source = document.createElement("canvas");
      source.width = 640;
      source.height = 640;
      source.getContext("2d")!.drawImage(image, 430, 0, 860, 860, 0, 0, 640, 640);
      const sample = await readFace(source, detector);
      if (mounted.current && operation.current === id) finishCapture(Array.from({ length: shotCount }, () => sample));
    } catch (cause) {
      if (mounted.current && operation.current === id) setError(cause instanceof Error ? cause.message : "示例处理失败，请用相机拍摄。 / Please try with your camera.");
    } finally {
      if (mounted.current && operation.current === id) { busyRef.current = false; setBusy(false); }
    }
  }

  function retake() {
    setCaptured(null);
    setResultUrl("");
    fileRef.current = null;
    setNotice("");
    void startCamera();
  }

  async function save() {
    const file = fileRef.current;
    if (!file || saving || rendering) return;
    setSaving(true);
    setNotice("");
    try {
      const phone = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (phone && navigator.canShare?.({ files: [file] }) && navigator.share) await navigator.share({ files: [file] });
      else {
        const link = document.createElement("a");
        link.href = resultUrl;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setNotice("表情包已下载。 / Your meme has been downloaded.");
      }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setError("分享没能打开，请长按成品保存，或再次点击保存。 / Touch and hold your result to save it, or try Save again.");
    } finally { setSaving(false); }
  }

  const canCapture = status === "ready" && modelStatus === "ready" && !!template && !busy && !captured;
  return <main className="meme-page">
    <header className="meme-header"><Link href="/" className="meme-back">← 拍照亭 <span>Photo booth</span></Link><span className="meme-wordmark">little moments<span>®</span></span><span className="meme-local"><span /> ON YOUR DEVICE</span></header>
    <div className="meme-intro"><span className="meme-eyebrow">YOUR FACE. A CLASSIC POSE.</span><h1>今天的梗，<em>你来演。</em></h1><p>对着半透明模板，把双眼放进虚线眼框，再做个表情。<span>Line up your eyes with the translucent template. Make the expression.</span></p></div>
    <div className="meme-workspace">
      <section className="meme-capture-panel" aria-label="Meme face camera">
        <div className="meme-shot-mode" role="group" aria-label="Meme capture mode"><button aria-pressed={shotCount === 1} onClick={() => setShotCount(1)} disabled={busy || !!captured}>单张 / Single</button><button aria-pressed={shotCount === 4} onClick={() => setShotCount(4)} disabled={busy || !!captured}>四张长条 / 4-photo strip</button></div>
        <div className="meme-section-title"><span>01 / {captured ? "你的表情包" : "拍下你的表情"}</span><small>{captured ? "YOUR MEME" : "MAKE THE FACE"}</small></div>
        <div className={`meme-camera-preview ${captured ? "has-result" : ""} ${captured?.length === 4 ? "is-strip" : ""}`} ref={resultAnchor}>
          <video autoPlay playsInline muted ref={videoRef} className={status === "ready" && !captured ? "is-live" : ""} aria-label="Meme camera preview" />
          {captured && resultUrl ? <img className="meme-main-result" src={resultUrl} alt="Your expression in the thinking meme pose" /> : <>
            <div className="meme-camera-tag"><span className={status === "ready" ? "is-live" : ""} />{status === "ready" ? "LIVE CAMERA" : "MEME CAMERA"}</div>
            <div className="meme-face-guide" ref={guideRef} aria-label="Align your eyes with the dashed eye openings in the translucent meme"><AlignmentOverlay /></div>
            <figure className="meme-inset-example"><img src={EXAMPLE} alt="Original thinking meme reference, visible while shooting" /><figcaption>原图示例 / Reference</figcaption></figure>
            {status !== "ready" && <div className="meme-start"><CameraIcon /><h2>{status === "denied" ? "先让相机看到你" : "让表情，有个去处。"}</h2><p>{status === "requesting" ? "请允许浏览器使用相机。 / Allow camera access." : "先开相机，把双眼放到模板的虚线眼框里。 / Match your eyes to the template openings."}</p><button className="meme-primary" onClick={() => void startCamera()} disabled={status === "requesting" || busy}>{status === "requesting" ? "开启中… / Opening…" : "开启相机 / Enable camera"}</button></div>}
            {status === "ready" && <div className="meme-live-tip">双眼对准绿色虚线框，再做表情。<span>Match both eyes to the green openings.</span></div>}
          </>}
          {countdown !== null && <div className="meme-countdown" aria-hidden="true">{countdown}</div>}
          {flash && <div className="meme-flash" aria-hidden="true" />}
          {busy && countdown === null && <div className="meme-working" role="status">正在提取五官…<span>Making your meme…</span></div>}
        </div>
        <div className="meme-shoot-controls">{captured ? <><button className="meme-secondary" onClick={retake} disabled={busy || saving}>↻ 重新拍 / Retake</button><button className="meme-primary" onClick={() => void save()} disabled={!resultUrl || rendering || saving}>{saving ? "打开中…" : "保存表情包 / Save meme"}</button></> : <><span>3 秒倒计时<span>3-second countdown</span></span><button className="meme-shutter" onClick={() => void capture()} disabled={!canCapture} aria-label="Capture my meme face"><span><CameraIcon /></span></button><span>{shotCount === 1 ? "只拍一张" : `第 ${shot || 1} / 4 张`}<span>{shotCount === 1 ? "One great expression" : "Four-photo strip"}</span></span></>}</div>
        <div className="meme-model-status" role="status" aria-live="polite">{countdown ? `第 ${shot} / ${shotCount} 张 · ${countdown} 秒 / Photo ${shot} of ${shotCount} in ${countdown}` : modelStatus === "loading" ? "正在准备本地五官识别… / Preparing the face processor…" : modelStatus === "ready" ? "五官识别已就绪 · 仅在本机处理 / Face processor ready · On-device only" : "五官在本机提取，不上传照片。 / Your photos stay on your device."}</div>
        {modelStatus === "error" && <button className="meme-text-button" onClick={() => { setError(""); void prepareModel().catch(() => setError("无法加载处理器，请刷新重试。 / Please refresh and retry.")); }}>重新准备 / Retry processor</button>}
        {error && <p className="meme-error" role="alert">{error}</p>}
        {notice && <p className="meme-notice" role="status">{notice}</p>}
      </section>
      <aside className="meme-reference-panel">
        <div className="meme-section-title"><span>02 / 跟着这个演</span><small>THE ORIGINAL</small></div>
        <div className="meme-reference-card"><img src={EXAMPLE} alt="Original thinking meme with real facial features and a hand gesture" /><div><strong>嗯……让我想想。</strong><span>Thinking…</span><p>眯一点眼睛、抿嘴，或者完全自由发挥。<br />Squint, purse your lips, or make it your own.</p><button className="meme-sample-button" onClick={() => void trySample()} disabled={busy || !template}>用示例试做 / Try sample →</button></div></div>
        <div className="meme-section-title meme-template-title"><span>你的动作模板</span><small>THE POSE</small></div>
        <div className="meme-template-card"><img src={TEMPLATE} alt="Blank thinking meme template with an empty face and original hand gesture" /><div><strong>保留动作，换上你的五官。</strong><p>模板和原图一直留在旁边，拍摄时也能参考。<span>The original pose stays. Your expression takes over.</span></p></div></div>
        {captured && <details className="meme-adjustments"><summary>微调五官 / Adjust your features <span>＋</span></summary>{([
          ["ink", "搞怪浓度 / Ink", .65, 1.8, .05],
          ["scale", "五官大小 / Size", .75, 1.3, .01],
          ["x", "左右位置 / Left–right", -100, 100, 1],
          ["y", "上下位置 / Up–down", -100, 100, 1],
        ] as const).map(([key, label, min, max, step]) => <label key={key}>{label}<input type="range" min={min} max={max} step={step} value={adjust[key]} disabled={saving} onChange={event => setAdjust(current => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}<button className="meme-text-button" onClick={() => setAdjust({ ...DEFAULT_ADJUSTMENTS })}>恢复自动效果 / Reset</button></details>}
        <p className="meme-footnote">✳ 先上这一款，下一张动作随时再加。<span>One classic pose to start. More little expressions to come.</span></p>
      </aside>
    </div>
  </main>;
}
