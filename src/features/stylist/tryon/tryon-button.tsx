"use client";

import { ScanFace, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Slot, StyleItem } from "../engine";
import "./tryon.css";

// L'essayage et MediaPipe ne sont chargés qu'à l'ouverture de la fenêtre, jamais avec la cabine.
const VirtualTryOn = dynamic(() => import("./virtual-tryon").then((module) => module.VirtualTryOn), { ssr: false });

// La fenêtre d'essayage : un en-tête fixe (titre et bouton Fermer toujours visibles), puis un corps
// qui défile seul. Sur mobile, le mannequin et la photo sont bornés en hauteur (tryon.css) :
// le vêtement ne recouvre plus l'écran et la fenêtre se referme toujours d'un geste.
export function TryOnButton({ pieces, className }: { pieces: Partial<Record<Slot, StyleItem>>; className?: string }) {
  const t = useTranslations("tryon");
  const close = useTranslations("common")("close");
  const [open, setOpen] = useState(false);
  const ready = Object.values(pieces).some((piece) => piece?.imagePath);

  return (
    <>
      <button type="button" className={className} disabled={!ready} onClick={() => setOpen(true)}>
        <ScanFace className="size-4" aria-hidden="true" />
        {t("open")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="vt-dialog" data-testid="tryon-dialog">
          <div className="vt-dialog__head">
            <DialogHeader className="vt-dialog__titles">
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>
            <DialogClose className="vt-dialog__close">
              <X className="size-5" aria-hidden="true" />
              <span className="vt-dialog__close-label">{close}</span>
            </DialogClose>
          </div>
          <div className="vt-dialog__body">{open ? <VirtualTryOn pieces={pieces} /> : null}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
