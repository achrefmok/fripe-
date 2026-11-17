"use client";

import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";

// Les collections en onglets : les rails sont rendus par le serveur, ce composant ne fait que choisir
// lequel est visible. Flèches, Début et Fin au clavier, comme le prévoit le motif d'onglets ARIA.
export function CollectionTabs({ label, tabs, panels }: { label: string; tabs: { key: string; label: string; hint: string }[]; panels: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[event.key];
    let next = active;
    if (step) next = (active + step + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    buttons.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className="hp-tabs rail-scroll" onKeyDown={move}>
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={index === active}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={index === active ? 0 : -1}
            className="hp-tab"
            onClick={() => setActive(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {panels.map((panel, index) => (
        <div
          key={tabs[index].key}
          role="tabpanel"
          id={`${id}-panel-${index}`}
          aria-labelledby={`${id}-tab-${index}`}
          hidden={index !== active}
          className="hp-panel"
        >
          <p className="hp-panel__hint">{tabs[index].hint}</p>
          {panel}
        </div>
      ))}
    </div>
  );
}
