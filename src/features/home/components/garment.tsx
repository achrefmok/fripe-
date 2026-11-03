import type { CSSProperties } from "react";
import type { GarmentKind, Universe } from "../universes";

const HOOK = "M100 6c8 0 11 9 5 13-3 2-5 4-5 9";

function Hook() {
  return <path fill="none" stroke="var(--hanger)" strokeWidth="3" strokeLinecap="round" d={HOOK} />;
}

// Le cintre : même objet partout, c'est lui qui accroche le vêtement au portant.
function Hanger() {
  return (
    <g fill="none" stroke="var(--hanger)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d={HOOK} />
      <path d="M100 28 34 56h132z" />
    </g>
  );
}

function Sneaker() {
  return (
    <>
      <path fill="var(--cloth)" d="M0 2h32q10 16 34 22l30 8q14 4 14 16v2H0z" />
      <path fill="var(--seam)" d="M0 44h112v8q0 2-2 2H0z" />
      <path fill="none" stroke="var(--seam)" strokeWidth="2" d="M36 10 28 22M46 18l-8 12M57 23l-7 12M0 26h22" />
    </>
  );
}

const SHAPES: Record<GarmentKind, React.ReactNode> = {
  top: (
    <>
      <path fill="var(--cloth)" d="M62 50 86 42q14 15 28 0l24 8 40 44-25 20-13-14v112H60V100l-13 14-25-20z" />
      <g fill="none" stroke="var(--seam)" strokeWidth="2">
        <path d="M86 42q14 22 28 0" />
        <path d="M60 100V78M140 100V78" />
        <path d="M112 112h20v22l-10 6-10-6z" />
      </g>
    </>
  ),
  bottom: (
    <>
      <path fill="var(--cloth)" d="M56 50h88l10 208h-42l-12-132-12 132H46z" />
      <g fill="none" stroke="var(--seam)" strokeWidth="2">
        <path d="M56 66h88" />
        <path d="M100 66v60" />
        <path d="M59 92q18-2 24-26M141 92q-18-2-24-26" strokeDasharray="4 4" />
        <path d="M112 126l11 132M88 126 77 258" strokeDasharray="4 4" />
      </g>
      <g fill="var(--seam)">
        <path d="M70 50h6v16h-6zM97 50h6v16h-6zM124 50h6v16h-6z" />
      </g>
    </>
  ),
  coat: (
    <>
      <path fill="var(--cloth)" d="M64 50 88 42l12 26 12-26 24 8 38 40-6 128h-24l-6-96v144H62V122l-6 96H32l-6-128z" />
      <g fill="none" stroke="var(--seam)" strokeWidth="2.5">
        <path d="M88 42 78 84l22 26 22-26-10-42" />
        <path d="M100 110v152" />
        <path d="M70 176h20v16H70zM110 176h20v16h-20z" />
      </g>
      <g fill="var(--seam)">
        <circle cx="108" cy="134" r="3" />
        <circle cx="108" cy="160" r="3" />
      </g>
    </>
  ),
  dress: (
    <>
      <path fill="var(--cloth)" d="M74 48 88 42q12 20 24 0l14 6 6 56q4 16 38 148-70 18-140 0 34-132 38-148z" />
      <g fill="none" stroke="var(--seam)" strokeWidth="2">
        <path d="M68 104q32 10 64 0" />
        <path d="M84 110 62 256M100 112v150M116 110l22 146" strokeLinecap="round" />
      </g>
    </>
  ),
  // La paire pend par ses lacets, l'une sous l'autre : le profil dit tout de suite « basket ».
  shoes: (
    <>
      <path fill="none" stroke="var(--hanger)" strokeWidth="1.8" d="M100 28 72 100M100 28l18 150" />
      <g transform="translate(22 84) rotate(-5 78 38) scale(1.4)">
        <Sneaker />
      </g>
      <g transform="translate(26 172) rotate(4 78 38) scale(1.4)">
        <Sneaker />
      </g>
    </>
  ),
  accessory: (
    <>
      <path fill="none" stroke="var(--cloth)" strokeWidth="7" strokeLinecap="round" d="M66 136Q68 30 100 30t34 106" />
      <path fill="var(--cloth)" d="M42 130h116l14 112H28z" />
      <g fill="none" stroke="var(--seam)" strokeWidth="2">
        <path d="M42 130q58 62 116 0" />
        <path d="M40 150l-3 72" strokeDasharray="4 4" />
        <path d="M160 150l3 72" strokeDasharray="4 4" />
      </g>
      <path fill="var(--seam)" d="M92 158h16v18H92z" />
    </>
  ),
  tag: (
    <>
      <path fill="var(--cloth)" d="M78 70h44l22 24v150H56V94z" />
      <circle cx="100" cy="92" r="7" fill="var(--seam)" />
      <path fill="none" stroke="var(--hanger)" strokeWidth="1.8" d="M100 28v60" />
    </>
  ),
};

export function Garment({ universe, className }: { universe: Universe; className?: string }) {
  const style = { "--cloth": universe.cloth, "--seam": universe.seam } as CSSProperties;

  return (
    <svg viewBox="0 0 200 280" aria-hidden="true" focusable="false" className={className} style={style}>
      {universe.garment === "shoes" || universe.garment === "accessory" ? <Hook /> : <Hanger />}
      {SHAPES[universe.garment]}
    </svg>
  );
}
