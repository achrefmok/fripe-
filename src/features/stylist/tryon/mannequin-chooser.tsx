"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { mannequinThumbnails } from "./mannequin";
import { setMannequinChoice } from "./mannequin-choice";
import type { Gender } from "./mannequin/mannequin-types";

// À la première ouverture : deux grandes cartes, chacune avec son mannequin en miniature.
export function MannequinChooser({ onPhoto }: { onPhoto: () => void }) {
  const t = useTranslations("tryon");
  const [images, setImages] = useState<Record<Gender, string> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    mannequinThumbnails()
      .then((result) => live && setImages(result))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) {
    return (
      <div className="vt-intro">
        <p>{t("status.mannequinError")}</p>
        <button type="button" className="vt-btn vt-btn--primary" onClick={onPhoto}>
          {t("choosePhoto")}
        </button>
      </div>
    );
  }

  return (
    <div className="vt-choose">
      <p className="vt-choose__lead">{t("chooseLead")}</p>
      <div className="vt-choose__cards" role="group" aria-label={t("chooseLead")}>
        {(["femme", "homme"] as const).map((gender) => (
          <button key={gender} type="button" className="vt-card" onClick={() => setMannequinChoice({ gender })}>
            <span className="vt-card__figure" aria-hidden="true">
              {images ? <Image src={images[gender]} alt="" width={240} height={320} unoptimized /> : <span className="vt-card__placeholder" />}
            </span>
            <span className="vt-card__label">{t(`gender.${gender}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
