"use client";

import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { publishVideoFile, type PublishStep } from "@/features/walk/publish-video";
import { useRouter } from "@/i18n/navigation";

export function useStepLabel() {
  const t = useTranslations("walk");
  return (step: PublishStep) =>
    step.key === "compressing"
      ? t("stepCompressing", { percent: step.percent })
      : t(step.key === "checking" ? "stepChecking" : step.key === "thumbnail" ? "stepThumbnail" : "stepUploading");
}

// Import d'une vidéo déjà filmée : le même circuit de publication que le studio.
export function VideoUploader({ shopId, label }: { shopId: string; label?: string }) {
  const t = useTranslations("walk");
  const stepLabel = useStepLabel();
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
        const result = await publishVideoFile(shopId, picked, {
          description,
          onStep: (current) => setStep(stepLabel(current)),
        });

        if ("error" in result) {
          setError(result.error);
          return;
        }

        toast.success(t("published"));
        setDescription("");
        router.refresh();
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
        <Button type="button" variant="outline" disabled={pending} onClick={() => input.current?.click()}>
          <Upload />
          {label ?? t("choose")}
        </Button>
        {step ? <span role="status" className="text-sm text-muted-foreground">{step}</span> : null}
      </div>
      <p className="text-[0.8rem] text-muted-foreground">{t("limits")}</p>
      <FormError error={error} />
    </div>
  );
}
