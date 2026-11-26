"use client";

import { Check, Copy, Download, EllipsisVertical, Share, SquarePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState, useSyncExternalStore } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { installPlatform, type InstallPlatform } from "./install-platform";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// L'événement du navigateur peut arriver avant l'affichage du bouton : il est gardé au niveau du module.
let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    notify();
  });
}

function standalone() {
  return (
    installed ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

type Snapshot = { hidden: boolean; platform: InstallPlatform };
let last: Snapshot | null = null;

function snapshot(): Snapshot {
  const next: Snapshot = {
    hidden: standalone(),
    platform: installPlatform({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints, canPrompt: deferred !== null }),
  };
  if (last && last.hidden === next.hidden && last.platform === next.platform) return last;
  last = next;
  return next;
}

const SERVER: Snapshot = { hidden: true, platform: "desktop" };

function subscribe(listener: () => void) {
  listeners.add(listener);
  const display = window.matchMedia("(display-mode: standalone)");
  display.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    display.removeEventListener("change", listener);
  };
}

function Step({ index, icon, children }: { index: number; icon?: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-xs font-bold text-background" aria-hidden="true">
        {index}
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 pt-1 leading-snug">
        {children}
        {icon ? <span className="inline-grid size-7 place-items-center rounded-md border bg-[var(--surface)]" aria-hidden="true">{icon}</span> : null}
      </span>
    </li>
  );
}

// Le bouton « Installer l'app » de l'en-tête. Là où le navigateur le permet, il ouvre sa fenêtre
// d'installation ; ailleurs (iPhone, iPad, Firefox, navigateurs d'Instagram ou de Facebook), il montre
// les gestes à faire, adaptés à l'appareil. Il disparaît une fois l'application installée.
export function InstallButton() {
  const t = useTranslations("install");
  const { hidden, platform } = useSyncExternalStore(subscribe, snapshot, () => SERVER);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (hidden) return null;

  async function install() {
    if (deferred) {
      const event = deferred;
      deferred = null;
      notify();
      await event.prompt();
      await event.userChoice.catch(() => null);
      return;
    }
    setOpen(true);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  const steps: Record<Exclude<InstallPlatform, "prompt">, ReactNode> = {
    ios: (
      <>
        <Step index={1} icon={<Share className="size-4" />}>{t("iosStep1")}</Step>
        <Step index={2} icon={<SquarePlus className="size-4" />}>{t("iosStep2")}</Step>
        <Step index={3}>{t("iosStep3")}</Step>
      </>
    ),
    android: (
      <>
        <Step index={1} icon={<EllipsisVertical className="size-4" />}>{t("androidStep1")}</Step>
        <Step index={2}>{t("androidStep2")}</Step>
        <Step index={3}>{t("androidStep3")}</Step>
      </>
    ),
    desktop: (
      <>
        <Step index={1} icon={<Download className="size-4" />}>{t("desktopStep1")}</Step>
        <Step index={2}>{t("desktopStep2")}</Step>
      </>
    ),
    inapp: (
      <>
        <Step index={1} icon={<EllipsisVertical className="size-4" />}>{t("inappStep1")}</Step>
        <Step index={2}>{t("inappStep2")}</Step>
      </>
    ),
  };

  const manual = platform === "prompt" ? "android" : platform;

  return (
    <>
      <button type="button" onClick={() => void install()} className="luxe-install" aria-label={t("button")} data-testid="install-button">
        <Download className="size-[17px]" strokeWidth={1.8} aria-hidden="true" />
        <span className="luxe-install__label">{t("short")}</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="px-5 pt-5 pb-0">
            <SheetTitle className="font-display text-2xl">{t("title")}</SheetTitle>
            <SheetDescription>{t(`lead.${manual}`)}</SheetDescription>
          </SheetHeader>
          <ol className="grid gap-3.5 px-5 text-[0.95rem]" data-platform={manual}>
            {steps[manual]}
          </ol>
          {manual === "inapp" ? (
            <div className="px-5">
              <button type="button" onClick={() => void copyLink()} className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-semibold">
                {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                {copied ? t("copied") : t("copyLink")}
              </button>
            </div>
          ) : null}
          <p className="px-5 text-sm text-muted-foreground">{t("benefits")}</p>
        </SheetContent>
      </Sheet>
    </>
  );
}
