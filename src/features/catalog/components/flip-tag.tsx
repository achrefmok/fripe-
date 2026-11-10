"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";

// L'étiquette de la pièce : la face montre taille, état, marque et couleur ; le dos, les défauts
// signalés et la référence. On la retourne d'un geste, comme une vraie étiquette.
export function FlipTag({
  specs,
  defectsTitle,
  defects,
  reference,
  flipLabel,
  backLabel,
}: {
  specs: { label: string; value: string }[];
  defectsTitle: string;
  defects: string;
  reference: string | null;
  flipLabel: string;
  backLabel: string;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <button type="button" className="lx-flip" aria-pressed={flipped} onClick={() => setFlipped((value) => !value)}>
      <span className="lx-flip__card" data-flipped={flipped ? "" : undefined}>
        <span className="lx-flip__face" aria-hidden={flipped}>
          <span className="lx-flip__specs">
            {specs.map((spec) => (
              <span key={spec.label} className="lx-flip__spec">
                <span className="lx-flip__key">{spec.label}</span>
                <span className="lx-flip__value" dir="auto">{spec.value}</span>
              </span>
            ))}
          </span>
          <span className="lx-flip__hint">
            {flipLabel} <RotateCcw className="inline size-3.5" aria-hidden="true" />
          </span>
        </span>
        <span className="lx-flip__face lx-flip__face--back" aria-hidden={!flipped}>
          <span className="lx-flip__key text-gold">{defectsTitle}</span>
          <span className="text-[15px] leading-relaxed" dir="auto">{defects}</span>
          <span className="mt-auto flex justify-between gap-3 text-xs opacity-70">
            {reference ? <span dir="ltr">{reference}</span> : <span />}
            <span>{backLabel}</span>
          </span>
        </span>
      </span>
    </button>
  );
}
