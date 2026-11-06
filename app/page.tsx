"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { makeStrip, PHOTO_COUNT, takePhoto } from "./photo";

type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "unavailable";
type Screen = "camera" | "result";

function Icon({ name, size = 22 }: { name: "camera" | "arrow" | "share" | "retake" | "lock" | "close" | "sparkle" | "strip"; size?: number }) {
  const paths = {
    camera: <><path d="M8 5 9.5 3h5L16 5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><circle cx="12" cy="12" r="4" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    share: <><path d="M12 15V3m-4 4 4-4 4 4M7 11H5v10h14V11h-2" /></>,
    retake: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    sparkle: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /></>,
    strip: <><rect x="6" y="2" width="12" height="20" rx="1" /><path d="M9 5h6v3H9Zm0 5h6v3H9Zm0 5h6v3H9Z" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function PhotoBooth() {
  const [screen, setScreen] = useState<Screen>("camera");
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [shot, setShot] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [flash, setFlash] = useState(false);
  const [monochrome, setMonochrome] = useState(false);
  const [stripUrl, setStripUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [help, setHelp] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<File | null>(null);
  const operation = useRef(0);
  const busyRef = useRef(false);
  const requestingRef = useRef(false);
  const mountedRef = useRef(true);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    if (requestingRef.current) return;
    requestingRef.current = true;
    const id = ++operation.current;
    stopCamera();
    setStatus("requesting");
    setError("");
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access needs a secure connection. Open this app over HTTPS, or use localhost on this computer.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1440 } },
      });
      if (!mountedRef.current || id !== operation.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stopCamera(); return; }
      video.srcObject = stream;
      await video.play();
      if (id !== operation.current) return;
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        if (streamRef.current !== stream) return;
        ++operation.current;
        busyRef.current = false;
        setCapturing(false);
        setCountdown(null);
        setStatus("unavailable");
        setError("Your camera disconnected. Reconnect it, then try again.");
      });
      setStatus("ready");
    } catch (cause) {
      if (!mountedRef.current || id !== operation.current) return;
      stopCamera();
      if (cause instanceof DOMException && ["NotAllowedError", "PermissionDeniedError"].includes(cause.name)) {
        setStatus("denied");
      } else {
        setStatus("unavailable");
        setError(cause instanceof DOMException && cause.name === "NotFoundError"
          ? "We couldn’t find a camera. Connect one or open this app on your phone."
          : cause instanceof DOMException && cause.name === "NotReadableError"
            ? "Your camera may be in use by another app. Close it there, then try again."
            : cause instanceof Error ? cause.message : "Your camera couldn’t start. Please try again.");
      }
    } finally {
      requestingRef.current = false;
    }
  }, [stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      mountedRef.current = false;
      ++operation.current;
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => () => { if (stripUrl) URL.revokeObjectURL(stripUrl); }, [stripUrl]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && streamRef.current) {
        ++operation.current;
        stopCamera();
        busyRef.current = false;
        setCapturing(false);
        setCountdown(null);
        setFlash(false);
        setPhotos([]);
        setShot(0);
        setStatus("idle");
        setNotice("Welcome back. Tap Enable camera when you’re ready.");
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [stopCamera]);

  async function capture() {
    if (busyRef.current || status !== "ready" || !videoRef.current) return;
    busyRef.current = true;
    const id = ++operation.current;
    const check = () => { if (!mountedRef.current || id !== operation.current) throw new DOMException("Capture cancelled", "AbortError"); };
    const pause = async (ms: number) => { await new Promise(resolve => setTimeout(resolve, ms)); check(); };
    setCapturing(true);
    setPhotos([]);
    setError("");
    setNotice("");
    const frames: string[] = [];
    try {
      for (let index = 0; index < PHOTO_COUNT; index++) {
        setShot(index + 1);
        for (let count = 3; count > 0; count--) {
          setCountdown(count);
          await pause(1000);
        }
        setCountdown(null);
        check();
        const frame = takePhoto(videoRef.current!, monochrome, guideRef.current?.getBoundingClientRect());
        frames.push(frame);
        setPhotos([...frames]);
        setFlash(true);
        await pause(160);
        setFlash(false);
        await pause(290);
      }
      const date = new Date();
      const blob = await makeStrip(frames, date);
      check();
      const name = `little-moments-${date.toISOString().replace(/[:.]/g, "-")}.png`;
      fileRef.current = new File([blob], name, { type: "image/png" });
      setStripUrl(URL.createObjectURL(blob));
      stopCamera();
      setStatus("idle");
      setScreen("result");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Something interrupted your photos. Please try again.");
    } finally {
      if (mountedRef.current && id === operation.current) {
        busyRef.current = false;
        setCapturing(false);
        setCountdown(null);
        setFlash(false);
      }
    }
  }

  function retake() {
    setScreen("camera");
    setPhotos([]);
    setShot(0);
    setStripUrl("");
    fileRef.current = null;
    setNotice("");
    setError("");
    // Keep the video element mounted so it is immediately available here.
    void startCamera();
  }

  async function save() {
    const file = fileRef.current;
    if (!file || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (mobile && navigator.canShare?.({ files: [file] }) && navigator.share) {
        // The file is prepared before the tap, preserving iOS transient activation.
        await navigator.share({ files: [file] });
        setNotice("Your strip is ready. Keep this little moment.");
      } else {
        const link = document.createElement("a");
        link.href = stripUrl;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setNotice(mobile ? "If the image opens, touch and hold it to save to Photos." : "Your photo strip has been downloaded.");
      }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setNotice("Sharing couldn’t open. Touch and hold your strip to save it, or try Save again.");
    } finally { setSaving(false); }
  }

  const result = screen === "result";
  return (
    <main className={`booth ${result ? "is-result" : ""}`}>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Little Moments home"><span className="brand-symbol"><Icon name="strip" size={27} /></span>little moments<span className="brand-dot">®</span></a>
        <div className="editorial">
          <div className="eyebrow"><span /> YOUR POCKET PHOTO BOOTH</div>
          <h1>{result ? <>A moment<br />worth <em>keeping.</em></> : <>Life moves fast.<br />Keep a little<br /><em>moment.</em></>}</h1>
          <p>{result ? "A little piece of right now. Save it, share it, or do it all over again." : "Just you, a few poses, and a keepsake to make you smile."}</p>
          <div className="little-star">✳</div>
        </div>
        <div className="how-it-works">
          <div><span>01</span><p>Find your good side</p></div>
          <div><span>02</span><p>Strike four poses</p></div>
          <div><span>03</span><p>Keep it forever</p></div>
        </div>
        <footer className="sidebar-footer"><Icon name="lock" size={13} /><span>Just between you and your camera.</span></footer>
      </aside>

      <section className={`viewfinder ${result ? "result-view" : ""}`} aria-label={result ? "Your photo strip" : "Photo booth camera"}>
        <video ref={videoRef} autoPlay playsInline muted disablePictureInPicture className={`camera-video ${status === "ready" ? "is-live" : ""} ${monochrome ? "monochrome" : ""}`} aria-label="Mirrored front camera preview" hidden={result} />
        <header className="camera-header">
          <span className="mobile-brand">little moments<span>®</span></span>
          <span className="camera-label"><span className={`status-dot ${status === "ready" ? "live" : ""}`} />{result ? "A LITTLE KEEPSAKE" : status === "ready" ? "LIVE CAMERA" : "THE PHOTO BOOTH"}</span>
          <button className="help-button" onClick={() => setHelp(true)} aria-label="How it works and install instructions">?</button>
        </header>

        {!result && <>
          <div className="frame-guide" ref={guideRef} aria-hidden="true"><i /><i /><i /><i /></div>
          {status !== "ready" && <div className="camera-welcome">
            <div className="camera-emblem"><Icon name="camera" size={34} /><span className="emblem-star">✧</span></div>
            <div className="eyebrow">A SMALL PAUSE. A GOOD MEMORY.</div>
            <h2>{status === "denied" ? <>Let’s let you <em>in.</em></> : status === "unavailable" ? <>A little camera <em>trouble.</em></> : status === "requesting" ? <>One little <em>second…</em></> : <>Hey, good <em>looking.</em></>}</h2>
            <p>{status === "denied" ? "Your camera is turned off for this site. Allow camera access in your browser’s website settings, then try again." : status === "unavailable" ? error : status === "requesting" ? "Choose Allow when your browser asks to use the camera." : "A few seconds. Four photos. All you.\nTurn on your camera to get started."}</p>
            {status === "denied" && <div className="permission-tip">On iPhone: open Safari’s page menu → Website Settings → Camera → Allow. On a computer, use the site controls beside the address.</div>}
            <button className="enable-button" onClick={() => void startCamera()} disabled={status === "requesting"}><Icon name="camera" size={18} />{status === "requesting" ? "Opening camera…" : status === "idle" ? "Enable camera" : "Try again"}<Icon name="arrow" size={18} /></button>
            <span className="privacy-note"><Icon name="lock" size={12} /> Your photos stay on your device.</span>
          </div>}
          {countdown !== null && <div className="countdown" aria-hidden="true" key={`${shot}-${countdown}`}>{countdown}</div>}
          <div className="capture-announcement" role="status" aria-live="polite">{capturing ? `Photo ${shot} of 4${countdown ? ` in ${countdown}` : ""}` : ""}</div>
          <div className="camera-bottom">
            <div className="pose-hint">{capturing ? (shot === 1 ? "Here comes your first moment" : shot === 4 ? "One last pose. Make it yours." : "New pose, same lovely you.") : status === "ready" ? "Get comfy. Make a face. Be yourself." : "GOOD MEMORIES START HERE"}</div>
            {status === "ready" && error && <p className="inline-error" role="alert">{error}</p>}
            <div className="camera-controls">
              <label className={`filter-selector ${monochrome ? "selected" : ""} ${capturing ? "is-disabled" : ""}`}>
                <span className="filter-icon" aria-hidden="true" />
                <span className="filter-caption">FILTER</span>
                <span className="filter-value" aria-hidden="true">{monochrome ? "Black & white" : "Color"}<span>⌄</span></span>
                <select aria-label="Photo filter" value={monochrome ? "bw" : "color"} onChange={event => setMonochrome(event.target.value === "bw")} disabled={capturing}>
                  <option value="color">Color</option>
                  <option value="bw">Black & white</option>
                </select>
              </label>
              <button className={`shutter ${capturing ? "is-capturing" : ""}`} onClick={() => void capture()} disabled={status !== "ready" || capturing} aria-label="Take four photos"><span>{capturing ? <span className="capture-dot" /> : <Icon name="camera" size={27} />}</span></button>
              <div className="photo-counter" aria-label={`${photos.length} of 4 photos captured`}><Icon name="strip" size={25} /><span>{String(photos.length).padStart(2, "0")} / 04</span></div>
            </div>
            <div className="capture-description">4 photos <span>·</span> 3 seconds between poses</div>
          </div>
          <div className="shot-progress" aria-label="Photo progress">{Array.from({ length: 4 }, (_, i) => <span className={photos[i] ? "complete" : capturing && shot === i + 1 ? "current" : ""} key={i}>{photos[i] ? <img src={photos[i]} alt={`Captured pose ${i + 1}`} /> : String(i + 1).padStart(2, "0")}</span>)}</div>
        </>}

        {result && <div className="result-content">
          <div className="result-heading"><span className="eyebrow">FRESH FROM THE BOOTH</span><h2>That’s a <em>keeper.</em><Icon name="sparkle" size={27} /></h2><p>Four little moments, just for you.</p></div>
          <div className="strip-stage"><div className="strip-tape" /><img className="photo-strip" src={stripUrl} alt="Your four photos in a vertical white-bordered photo strip" /></div>
          <div className="result-actions"><button className="retake-button" onClick={retake} disabled={saving}><Icon name="retake" size={18} />Retake</button><button className="save-button" onClick={() => void save()} disabled={saving}><Icon name="share" size={18} />{saving ? "Opening…" : "Save strip"}</button></div>
          <p className="save-hint">On iPhone, choose “Save Image” in the share sheet.</p>
        </div>}
        {notice && <p className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message"><Icon name="close" size={15} /></button></p>}
      </section>
      {flash && <div className="flash" aria-hidden="true" />}
      {help && <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) setHelp(false); }}><Help onClose={() => setHelp(false)} /></div>}
    </main>
  );
}

function Help({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="help-dialog" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="help-title">
    <button className="dialog-close" onClick={onClose} aria-label="Close instructions"><Icon name="close" /></button>
    <Icon name="strip" size={32} /><h2 id="help-title">A booth in your pocket.</h2>
    <p>Enable your front camera, choose Color or Black &amp; white in the Filter control, tap the round shutter, and strike four poses. Each photo gets a 3-second countdown. Your selected filter applies to the preview and all four saved photos.</p>
    <h3>Make yourself at home</h3><p>On iPhone, open this app in Safari, tap Share, then <strong>Add to Home Screen</strong>. Open the new icon for the full-screen experience.</p>
    <h3>Keep your moment</h3><p>Tap <strong>Save strip</strong> and choose <strong>Save Image</strong> on iPhone. On a computer, your strip downloads as a PNG.</p>
    <p className="help-privacy"><Icon name="lock" size={15} /> Photos are created on your device and never uploaded.</p>
    <button className="save-button" onClick={onClose}>Got it<Icon name="arrow" size={18} /></button>
  </dialog>;
}
