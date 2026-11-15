"use client";

import { Camera, Circle, Pause, Play, RefreshCcw, Square, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { MAX_VIDEO_SECONDS, recorderType } from "../video-file";

type RecorderState = "idle" | "recording" | "paused";

function cameraError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "cameraDenied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "cameraMissing";
  return "cameraUnavailable";
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

const noSubscribe = () => () => {};
const canRecord = () => Boolean(navigator.mediaDevices?.getUserMedia) && recorderType() !== null;

// Filmer sans quitter FRIPE. Si la caméra intégrée n'est pas disponible (navigateur ancien, page non
// sécurisée, refus), l'appareil photo du téléphone et l'import restent toujours proposés.
export function CameraCapture({ onDone }: { onDone: (file: File) => void }) {
  const t = useTranslations("studio");
  const preview = useRef<HTMLVideoElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const native = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Lu après hydratation : le serveur ne sait pas si le navigateur peut filmer.
  const supported = useSyncExternalStore(noSubscribe, canRecord, () => false);

  useEffect(() => {
    if (preview.current) preview.current.srcObject = stream;
  }, [stream]);

  // Les pistes sont coupées en quittant l'écran : le voyant de la caméra s'éteint.
  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  useEffect(() => {
    if (state !== "recording") return;
    const timer = window.setInterval(() => setElapsed((value) => value + 0.25), 250);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (state === "recording" && elapsed >= MAX_VIDEO_SECONDS) recorder.current?.stop();
  }, [elapsed, state]);

  async function open(mode = facing) {
    setError(null);
    stream?.getTracks().forEach((track) => track.stop());
    const video = { facingMode: mode, width: { ideal: 720 }, height: { ideal: 1280 } };
    try {
      setStream(await navigator.mediaDevices.getUserMedia({ video, audio: true }));
    } catch (first) {
      // Sans micro, on filme quand même : la voix et la musique s'ajoutent au montage.
      try {
        setStream(await navigator.mediaDevices.getUserMedia({ video, audio: false }));
      } catch {
        setError(cameraError(first));
      }
    }
  }

  function start() {
    if (!stream) return;
    const type = recorderType()!;
    chunks.current = [];
    const instance = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_500_000 });
    instance.ondataavailable = (event) => {
      if (event.data.size) chunks.current.push(event.data);
    };
    instance.onstop = () => {
      setState("idle");
      const base = type.split(";")[0];
      const blob = new Blob(chunks.current, { type: base });
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      if (blob.size) onDone(new File([blob], base === "video/mp4" ? "video.mp4" : "video.webm", { type: base }));
    };
    recorder.current = instance;
    setElapsed(0);
    instance.start(500);
    setState("recording");
  }

  function pause() {
    if (recorder.current?.state === "recording" && typeof recorder.current.pause === "function") {
      recorder.current.pause();
      setState("paused");
    }
  }

  function resume() {
    if (recorder.current?.state === "paused") {
      recorder.current.resume();
      setState("recording");
    }
  }

  const fileInputs = (
    <>
      <input
        ref={native}
        type="file"
        accept="video/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-label={t("nativeCamera")}
        onChange={(event) => event.target.files?.[0] && onDone(event.target.files[0])}
      />
      <input
        ref={picker}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="sr-only"
        tabIndex={-1}
        aria-label={t("importVideo")}
        onChange={(event) => event.target.files?.[0] && onDone(event.target.files[0])}
      />
    </>
  );

  return (
    <div className="grid gap-4">
      <div className="studio-screen">
        {stream ? (
          <video
            ref={preview}
            autoPlay
            muted
            playsInline
            aria-label={t("cameraPreview")}
            className={facing === "user" ? "-scale-x-100" : undefined}
          />
        ) : (
          <div className="studio-screen__empty">
            <Camera className="size-10" aria-hidden="true" />
            <p>{supported ? t("cameraIntro") : t("cameraUnsupported")}</p>
          </div>
        )}
        {state !== "idle" ? (
          <span className="studio-timer" role="timer" aria-live="off">
            <span className={state === "recording" ? "studio-timer__dot" : "studio-timer__dot is-paused"} aria-hidden="true" />
            {clock(elapsed)} / {clock(MAX_VIDEO_SECONDS)}
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {t(error)}
        </p>
      ) : null}

      {supported ? (
        stream ? (
          <div className="studio-controls">
            {state === "idle" ? (
              <>
                <Button type="button" variant="outline" size="lg" onClick={() => {
                  const next = facing === "environment" ? "user" : "environment";
                  setFacing(next);
                  void open(next);
                }}>
                  <RefreshCcw aria-hidden="true" />
                  {t("switchCamera")}
                </Button>
                <button type="button" className="studio-record" onClick={start} aria-label={t("start")}>
                  <Circle className="size-7 fill-current" aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                {state === "recording" ? (
                  <Button type="button" variant="outline" size="lg" onClick={pause}>
                    <Pause aria-hidden="true" />
                    {t("pause")}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="lg" onClick={resume}>
                    <Play aria-hidden="true" />
                    {t("resume")}
                  </Button>
                )}
                <button type="button" className="studio-record is-recording" onClick={() => recorder.current?.stop()} aria-label={t("stop")}>
                  <Square className="size-6 fill-current" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        ) : (
          <Button type="button" size="lg" className="h-14 text-base" onClick={() => void open()}>
            <Camera aria-hidden="true" />
            {t("openCamera")}
          </Button>
        )
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" size="lg" onClick={() => native.current?.click()}>
          <Camera aria-hidden="true" />
          {t("nativeCamera")}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => picker.current?.click()}>
          <Upload aria-hidden="true" />
          {t("importVideo")}
        </Button>
      </div>
      {fileInputs}
    </div>
  );
}
