"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Link, useRouter } from "@/i18n/navigation";

const EASE = "cubic-bezier(0.76, 0, 0.24, 1)";
const WIPE_MS = 520;
const LIFT_MS = 420;
// Si la page d'arrivée tarde, le rideau se lève quand même : il ne doit jamais bloquer l'écran.
const LIFT_AT_LATEST_MS = 4000;

type Curtain = { opened: Promise<unknown>; lift: () => void };

// Le rideau vit hors de React : il doit survivre au changement de page pour se lever dessus.
function dropCurtain(name: string, surface: string, ink: string, x: number, y: number): Curtain {
  const element = document.createElement("div");
  const label = document.createElement("span");

  element.className = "universe-wipe";
  element.setAttribute("aria-hidden", "true");
  element.style.setProperty("--u-surface", surface);
  element.style.setProperty("--u-ink", ink);
  label.textContent = name;
  element.append(label);
  document.body.append(element);

  const at = `at ${x}px ${y}px`;
  const opened = element.animate([{ clipPath: `circle(0 ${at})` }, { clipPath: `circle(150vmax ${at})` }], {
    duration: WIPE_MS,
    easing: EASE,
    fill: "forwards",
  }).finished;

  label.animate(
    [
      { opacity: 0, transform: "translateY(1rem)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { delay: 160, duration: 300, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" },
  );

  let lifted = false;
  const fallback = window.setTimeout(lift, LIFT_AT_LATEST_MS);

  function lift() {
    if (lifted) return;
    lifted = true;
    window.clearTimeout(fallback);

    element
      .animate([{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }], {
        duration: LIFT_MS,
        easing: EASE,
        fill: "forwards",
      })
      .finished.finally(() => element.remove());
  }

  return { opened, lift };
}

// Le vêtement touché envahit l'écran de sa couleur : on entre dans son univers, et la page
// d'arrivée reprend le même aplat. Le lien reste un vrai lien, ouvrable dans un nouvel onglet.
export function UniverseLink({
  href,
  name,
  surface,
  ink,
  className,
  children,
}: {
  href: { pathname: string; query: Record<string, string> };
  name: string;
  surface: string;
  ink: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const curtain = useRef<Curtain | null>(null);

  // Ce lien disparaît quand la page d'arrivée s'affiche : c'est le signal pour lever le rideau.
  useEffect(() => () => curtain.current?.lift(), []);

  function enter(event: MouseEvent<HTMLAnchorElement>) {
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

    if (modified || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    event.preventDefault();
    if (curtain.current) return;

    const box = event.currentTarget.getBoundingClientRect();
    const fromPointer = event.clientX > 0 || event.clientY > 0;

    curtain.current = dropCurtain(
      name,
      surface,
      ink,
      fromPointer ? event.clientX : box.left + box.width / 2,
      fromPointer ? event.clientY : box.top + box.height / 2,
    );
    curtain.current.opened.finally(() => router.push(href));
  }

  return (
    <Link href={href} className={className} onClick={enter}>
      {children}
    </Link>
  );
}
