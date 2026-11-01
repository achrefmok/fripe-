"use client";

import { Clapperboard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { createVideoDraft, finalizeVideo } from "@/features/walk/actions";
import {
  captureThumbnail,
  compressVideo,
  exceedsResolution,
  inspectVideo,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  needsCompression,
} from "@/features/walk/video-file";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

const EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function VideoUploader({ shopId }: { shopId: string }) {
  const t = useTranslations("walk");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upload(picked: File | undefined) {
    if (!picked) return;

    setError(null);

    startTransition(async () => {
      try {
        setStep(t("stepChecking"));

        if (!EXTENSIONS[picked.type]) {
          setError("invalidVideo");
          return;
        }

        const info = await inspectVideo(picked);

        if (info.duration > MAX_VIDEO_SECONDS) {
          setError("video_too_long");
          return;
        }

        let file: File = picked;

        if (needsCompression(picked, info)) {
          setStep(t("stepCompressing", { percent: 0 }));
          const compressed = await compressVideo(picked, info, (ratio) =>
            setStep(t("stepCompressing", { percent: Math.round(ratio * 100) })),
          );

          // Une définition trop haute est réduite même si le fichier reste de taille comparable.
          if (compressed && (compressed.size < picked.size || exceedsResolution(info))) file = compressed;
        }

        if (file.size > MAX_VIDEO_BYTES) {
          setError("video_too_large");
          return;
        }

        const finalInfo = file === picked ? info : await inspectVideo(file);

        setStep(t("stepThumbnail"));
        const thumbnail = await captureThumbnail(file, finalInfo);

        setStep(t("stepUploading"));
        const draft = await createVideoDraft(shopId, description);

        if (!draft.ok) {
          setError(draft.error);
          return;
        }

        const { videoId } = draft.data;
        const folder = `${shopId}/${videoId}`;
        const videoPath = `${folder}/video.${EXTENSIONS[file.type]}`;
        const thumbnailPath = `${folder}/thumbnail.jpg`;
        const bucket = createClient().storage.from("shop-videos");

        const [uploadedVideo, uploadedThumbnail] = await Promise.all([
          bucket.upload(videoPath, file, { contentType: file.type, cacheControl: "31536000" }),
          bucket.upload(thumbnailPath, thumbnail, { contentType: "image/jpeg", cacheControl: "31536000" }),
        ]);

        if (uploadedVideo.error || uploadedThumbnail.error) {
          setError("unexpected");
          return;
        }

        const result = await finalizeVideo(shopId, {
          videoId,
          videoPath,
          thumbnailPath,
          durationSeconds: Math.max(1, Math.round(finalInfo.duration)),
          width: finalInfo.width,
          height: finalInfo.height,
        });

        if (result.ok) {
          toast.success(t("published"));
          setDescription("");
          router.refresh();
        } else {
          setError(result.error);
        }
      } catch {
        setError("invalidVideo");
      } finally {
        setStep(null);
        if (input.current) input.current.value = "";
      }
    });
  }

  return (
    <div className="grid gap-3">
      <Field id="video-description" label={t("description")}>
        <Textarea
          id="video-description"
          maxLength={300}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="sr-only"
        aria-label={t("choose")}
        onChange={(event) => upload(event.target.files?.[0])}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending} onClick={() => input.current?.click()}>
          <Clapperboard />
          {t("choose")}
        </Button>
        {step ? <span role="status" className="text-sm text-muted-foreground">{step}</span> : null}
      </div>
      <p className="text-[0.8rem] text-muted-foreground">{t("limits")}</p>
      <FormError error={error} />
    </div>
  );
}
