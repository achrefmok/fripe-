"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { deleteVideo, setVideoProducts, setVideoStatus } from "@/features/walk/actions";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/utils/action-result";
import { publicVideoUrl } from "@/lib/utils/storage";

export function VideoRow({
  shopId,
  video,
  products,
}: {
  shopId: string;
  video: {
    id: string;
    description: string | null;
    status: string;
    moderated_at: string | null;
    duration_seconds: number | null;
    thumbnail_path: string | null;
    favorite_count: number;
    video_products: { product_id: string }[];
  };
  products: { id: string; label: string }[];
}) {
  const t = useTranslations("walk");
  const router = useRouter();
  const [selected, setSelected] = useState(new Set(video.video_products.map((item) => item.product_id)));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>, message?: string) {
    setError(null);

    startTransition(async () => {
      const result = await action();

      if (result.ok) {
        if (message) toast.success(message);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-3 py-4">
      <div className="flex gap-3">
        <div className="relative h-24 w-16 shrink-0 overflow-hidden bg-secondary">
          {video.thumbnail_path ? (
            <Image src={publicVideoUrl(video.thumbnail_path)} alt="" fill sizes="64px" className="object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{video.description ?? t("noDescription")}</p>
          <p className="text-sm text-muted-foreground">
            {t(`status.${video.status}`)}
            {video.moderated_at ? ` · ${t("moderated")}` : ""}
            {video.duration_seconds ? ` · ${video.duration_seconds} s` : ""} · {video.favorite_count} ♥
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {video.status === "published" ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setVideoStatus(shopId, video.id, "archived"))}>
                {t("unpublish")}
              </Button>
            ) : null}
            {video.status === "archived" && !video.moderated_at ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setVideoStatus(shopId, video.id, "published"))}>
                {t("republish")}
              </Button>
            ) : null}
            {!video.moderated_at ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => deleteVideo(shopId, video.id), t("deleted"))}>
                {t("delete")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {products.length ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">{t("linkPieces", { count: selected.size })}</summary>
          <ul className="mt-2 max-h-56 divide-y overflow-y-auto border-y">
            {products.map((product) => (
              <li key={product.id}>
                <label className="flex items-center gap-2 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--harissa)]"
                    checked={selected.has(product.id)}
                    disabled={!selected.has(product.id) && selected.size >= 8}
                    onChange={() => toggle(product.id)}
                  />
                  <span className="truncate">{product.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            className="mt-2"
            onClick={() => run(() => setVideoProducts(shopId, video.id, [...selected]), t("piecesSaved"))}
          >
            {t("savePieces")}
          </Button>
        </details>
      ) : null}
      <FormError error={error} />
    </li>
  );
}
