"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui";

// ---------------------------------------------------------------------------
// Signature pad (canvas → PNG data URL)

export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext("2d")!;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setHasInk(true);
    onChange(canvasRef.current!.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          aria-label="Signature pad"
          className="h-44 w-full touch-none rounded-xl bg-white ring-2 ring-slate-300"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
        {!hasInk ? <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm text-slate-400">Customer signs here</p> : null}
      </div>
      <button type="button" onClick={clear} className="mt-2 min-h-10 text-sm font-semibold text-slate-600 underline">
        Clear signature
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audio consent (MediaRecorder → data URL). Needs HTTPS or localhost.

const MAX_AUDIO_SECONDS = 60;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function AudioRecorder({ script, onChange }: { script: string; onChange: (dataUrl: string | null) => void }) {
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const [clip, setClip] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    setRecording(false);
  };

  const start = async () => {
    setError(null);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Audio recording needs a secure (https) connection and a supported browser. Use signature or a paper form photo instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream, { audioBitsPerSecond: 24_000 });
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const dataUrl = await blobToDataUrl(new Blob(chunks, { type: rec.mimeType }));
        setClip(dataUrl);
        onChange(dataUrl);
      };
      recorder.current = rec;
      rec.start();
      setClip(null);
      onChange(null);
      setSeconds(0);
      setRecording(true);
      const startedAt = Date.now();
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setSeconds(elapsed);
        if (elapsed >= MAX_AUDIO_SECONDS) stop();
      }, 500);
    } catch {
      setError("Microphone permission was denied.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ask the customer to say</p>
        <p className="mt-1 italic">“{script}”</p>
      </div>
      {recording ? (
        <Button variant="danger" full onClick={stop}>
          ■ Stop recording ({seconds}s / {MAX_AUDIO_SECONDS}s)
        </Button>
      ) : (
        <Button variant="secondary" full onClick={start}>
          ● {clip ? "Record again" : "Start recording"}
        </Button>
      )}
      {clip ? <audio controls src={clip} className="w-full" /> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paper form photo (camera → downscaled JPEG data URL)

async function downscale(file: File, maxSide = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

export function PhotoCapture({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await downscale(file);
      setPhoto(dataUrl);
      onChange(dataUrl);
      setError(null);
    } catch {
      setError("Couldn't read that photo. Try again.");
    }
  };

  return (
    <div className="space-y-3">
      <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-white px-4 font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50">
        {photo ? "Retake photo" : "Take photo of signed form"}
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
        <img src={photo} alt="Signed paper form" className="max-h-72 w-full rounded-xl object-contain ring-1 ring-slate-200" />
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
