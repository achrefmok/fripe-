"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { refreshLive } from "./actions";
import type { Live, LiveComment } from "./queries";

type CommentRow = { id: number; author_name: string; body: string; hidden_at: string | null; created_at: string };

// L'état d'un Live, tenu à jour en direct : le temps réel pousse les changements dès qu'ils
// arrivent, et une relecture régulière rattrape ce qu'il aurait manqué (commentaire masqué,
// coupure réseau, onglet resté en arrière-plan).
export function useLiveSync(initialLive: Live, initialComments: LiveComment[]) {
  const [live, setLive] = useState(initialLive);
  const [comments, setComments] = useState(initialComments);
  const liveId = initialLive.id;
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const result = await refreshLive(liveId, 0);
      if (result.live) setLive(result.live);
      setComments(result.comments);
    } catch {
      // Hors ligne un instant : la prochaine relecture rattrapera.
    } finally {
      busy.current = false;
    }
  }, [liveId]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);

      channel = supabase
        .channel(`live:${liveId}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "lives", filter: `id=eq.${liveId}` }, () => void refresh())
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_comments", filter: `live_id=eq.${liveId}` }, (payload) => {
          const row = payload.new as CommentRow;
          setComments((current) =>
            current.some((known) => known.id === row.id)
              ? current
              : [...current, { id: row.id, authorName: row.author_name, body: row.body, hidden: Boolean(row.hidden_at), createdAt: row.created_at }].slice(-120),
          );
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_comments", filter: `live_id=eq.${liveId}` }, () => void refresh())
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [liveId, refresh]);

  // Un Live terminé ne bouge plus : inutile de continuer à relire.
  const settled = live.status === "ended" || live.status === "cancelled";

  useEffect(() => {
    if (settled) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [refresh, settled]);

  return { live, comments, setComments, refresh };
}
