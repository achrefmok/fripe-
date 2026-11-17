"use client";

import { ScanFace } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Slot, StyleItem } from "../engine";

// L'essayage et MediaPipe ne sont chargés qu'à l'ouverture de la fenêtre, jamais avec la cabine.
const VirtualTryOn = dynamic(() => import("./virtual-tryon").then((module) => module.VirtualTryOn), { ssr: false });

export function TryOnButton({ pieces, className }: { pieces: Partial<Record<Slot, StyleItem>>; className?: string }) {
  const t = useTranslations("tryon");
  const [open, setOpen] = useState(false);
  const ready = Object.values(pieces).some((piece) => piece?.imagePath);

  return (
    <>
      <button type="button" className={className} disabled={!ready} onClick={() => setOpen(true)}>
        <ScanFace className="size-4" aria-hidden="true" />
        {t("open")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          {open ? <VirtualTryOn pieces={pieces} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
