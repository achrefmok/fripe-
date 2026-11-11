"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { reportLiveViewers, sendLiveSignal } from "./actions";

export type ViewerVideoState = "idle" | "connecting" | "waiting" | "playing" | "full" | "error";
export type HostVideoState = "idle" | "preview" | "denied" | "connecting" | "live" | "error";

// La vidéo va directement du téléphone de la boutique à chaque spectateur (WebRTC), sans service de
// diffusion : c'est gratuit, mais c'est le téléphone qui porte chaque spectateur. On plafonne donc
// la salle, et on garde une image légère pour tenir sur un réseau mobile.
export const LIVE_MAX_VIEWERS = 12;
const VIDEO = { width: { ideal: 480 }, height: { ideal: 854 }, frameRate: { ideal: 24, max: 24 } };
const MAX_BITRATE = 600_000;
// Serveurs publics qui aident deux appareils à se trouver ; ils ne voient jamais la vidéo.
const ICE: RTCConfiguration = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

const channelName = (liveId: string) => `live-video-${liveId}`;

// On attend que l'appareil ait listé ses chemins réseau : la description part alors en une fois.
function gathered(connection: RTCPeerConnection) {
  if (connection.iceGatheringState === "complete") return Promise.resolve();

  return new Promise<void>((resolve) => {
    const done = () => {
      connection.removeEventListener("icegatheringstatechange", check);
      window.clearTimeout(timer);
      resolve();
    };
    const check = () => {
      if (connection.iceGatheringState === "complete") done();
    };
    const timer = window.setTimeout(done, 2500);
    connection.addEventListener("icegatheringstatechange", check);
  });
}

// Côté client : on demande la vidéo à la boutique et on l'affiche. La demande part par le canal
// temps réel ; la réponse n'est acceptée que si elle vient de la table écrite par la boutique.
export function useLiveViewerVideo(liveId: string, enabled: boolean) {
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ViewerVideoState>("idle");
  const [viewers, setViewers] = useState(0);
  const [needsAudio, setNeedsAudio] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const key = crypto.randomUUID();
    let cancelled = false;
    let connection: RTCPeerConnection | null = null;
    let retry = 0;
    let failures = 0;

    const channel = supabase.channel(channelName(liveId), { config: { broadcast: { self: false } } });

    async function ask() {
      if (cancelled) return;
      connection?.close();

      const current = new RTCPeerConnection(ICE);
      connection = current;
      current.addTransceiver("video", { direction: "recvonly" });
      current.addTransceiver("audio", { direction: "recvonly" });

      current.ontrack = (event) => {
        const element = video.current;
        if (!element || cancelled) return;
        const [stream] = event.streams;
        if (stream && element.srcObject !== stream) {
          // Un navigateur refuse souvent de lancer le son sans geste : on démarre muet, un bouton l'active.
          element.muted = true;
          element.srcObject = stream;
          setNeedsAudio(true);
          void element.play().catch(() => undefined);
        }
      };

      current.onconnectionstatechange = () => {
        if (cancelled || connection !== current) return;
        if (current.connectionState === "connected") {
          failures = 0;
          window.clearTimeout(retry);
          setState("playing");
        } else if (current.connectionState === "failed" || current.connectionState === "disconnected" || current.connectionState === "closed") {
          failures += 1;
          // Trois échecs de suite : le réseau ne laisse pas passer la liaison directe.
          setState(failures >= 3 ? "error" : "waiting");
          if (failures < 3) retry = window.setTimeout(() => void ask(), 2500);
        }
      };

      await current.setLocalDescription(await current.createOffer());
      await gathered(current);
      if (cancelled || connection !== current) return;

      await channel.send({ type: "broadcast", event: "offer", payload: { key, sdp: current.localDescription?.sdp } });
      // La boutique n'a peut-être pas encore ouvert sa caméra : on redemande un peu plus tard.
      retry = window.setTimeout(() => {
        if (current.connectionState !== "connected") void ask();
      }, 8000);
    }

    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_signals", filter: `live_id=eq.${liveId}` }, (change) => {
        const signal = change.new as { viewer_key: string; kind: string; payload: { sdp?: string } };
        if (cancelled || signal.viewer_key !== key || !connection) return;

        if (signal.kind === "full") {
          window.clearTimeout(retry);
          setState("full");
        } else if (signal.kind === "answer" && signal.payload.sdp && connection.signalingState === "have-local-offer") {
          void connection.setRemoteDescription({ type: "answer", sdp: signal.payload.sdp }).catch(() => setState("error"));
        }
      })
      // Le nombre de spectateurs, annoncé par la boutique : un simple affichage.
      .on("broadcast", { event: "count" }, ({ payload }) => {
        const count = Number((payload as { count?: number }).count);
        if (Number.isInteger(count) && count >= 0 && count <= LIVE_MAX_VIEWERS) setViewers(count);
      })
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setState("waiting");
          void ask().catch(() => setState("error"));
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setState("error");
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(retry);
      connection?.close();
      void supabase.removeChannel(channel);
    };
  }, [liveId, enabled, attempt]);

  const startAudio = useCallback(() => {
    const element = video.current;
    if (!element) return;
    element.muted = false;
    void element.play().catch(() => undefined);
    setNeedsAudio(false);
  }, []);

  const retry = useCallback(() => {
    setState("connecting");
    setAttempt((value) => value + 1);
  }, []);

  return { video, audio, state: enabled ? (state === "idle" ? "connecting" : state) : "idle", viewers, needsAudio, startAudio, retry };
}

// Côté boutique : l'aperçu de la caméra avant le direct, puis une liaison vidéo par spectateur dès
// que le Live démarre.
export function useLiveHostVideo(liveId: string, onAir: boolean) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const peers = useRef(new Map<string, RTCPeerConnection>());
  const [state, setState] = useState<HostVideoState>("idle");
  const [viewers, setViewers] = useState(0);
  const [micOn, setMicOn] = useState(true);
  // Une référence, pas un état : changer de caméra ne doit pas relancer les liaisons.
  const facing = useRef<"user" | "environment">("user");

  const startPreview = useCallback(async () => {
    if (stream.current) return true;
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { ...VIDEO, facingMode: facing.current },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      stream.current = media;
      if (video.current) video.current.srcObject = media;
      setState((value) => (value === "live" || value === "connecting" ? value : "preview"));
      return true;
    } catch {
      setState("denied");
      return false;
    }
  }, []);

  // Changer de caméra : on remplace la piste vidéo, y compris chez les spectateurs déjà connectés.
  const flip = useCallback(async () => {
    const media = stream.current;
    if (!media) return;
    const next = facing.current === "user" ? "environment" : "user";

    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ video: { ...VIDEO, facingMode: next } });
      const [track] = fresh.getVideoTracks();
      const [old] = media.getVideoTracks();
      if (!track) return;

      await Promise.all(
        [...peers.current.values()].flatMap((connection) =>
          connection.getSenders().filter((sender) => sender.track?.kind === "video").map((sender) => sender.replaceTrack(track)),
        ),
      );
      if (old) {
        media.removeTrack(old);
        old.stop();
      }
      media.addTrack(track);
      if (video.current) video.current.srcObject = media;
      facing.current = next;
    } catch {
      // Une seule caméra sur cet appareil : on garde celle qui tourne.
    }
  }, []);

  const toggleMic = useCallback(() => {
    const [track] = stream.current?.getAudioTracks() ?? [];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }, []);

  useEffect(() => {
    if (!onAir) return;

    const supabase = createClient();
    const connections = peers.current;
    let cancelled = false;
    let reporter = 0;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const connected = () => [...connections.values()].filter((connection) => connection.connectionState === "connected").length;
    const announce = () => {
      const count = connected();
      setViewers(count);
      void channel?.send({ type: "broadcast", event: "count", payload: { count } });
    };

    function drop(key: string, connection: RTCPeerConnection) {
      if (connections.get(key) === connection) connections.delete(key);
      connection.close();
      announce();
    }

    async function answer(key: string, sdp: string) {
      const media = stream.current;
      if (cancelled || !media) return;

      // Le même spectateur redemande : on remplace son ancienne liaison.
      const previous = connections.get(key);
      if (previous) drop(key, previous);

      if (connections.size >= LIVE_MAX_VIEWERS) {
        await sendLiveSignal(liveId, key, "full", "");
        return;
      }

      const connection = new RTCPeerConnection(ICE);
      connections.set(key, connection);
      for (const track of media.getTracks()) connection.addTrack(track, media);

      connection.onconnectionstatechange = () => {
        if (connection.connectionState === "connected") announce();
        else if (connection.connectionState === "failed" || connection.connectionState === "disconnected" || connection.connectionState === "closed") drop(key, connection);
      };

      await connection.setRemoteDescription({ type: "offer", sdp });
      await connection.setLocalDescription(await connection.createAnswer());

      // Débit plafonné : dix spectateurs doivent tenir sur une connexion mobile.
      for (const sender of connection.getSenders()) {
        if (sender.track?.kind !== "video") continue;
        const parameters = sender.getParameters();
        parameters.encodings = (parameters.encodings.length ? parameters.encodings : [{}]).map((encoding) => ({ ...encoding, maxBitrate: MAX_BITRATE }));
        await sender.setParameters(parameters).catch(() => undefined);
      }

      await gathered(connection);
      if (cancelled || connections.get(key) !== connection || !connection.localDescription) return;
      await sendLiveSignal(liveId, key, "answer", connection.localDescription.sdp);

      // Un spectateur qui ne termine pas la liaison libère sa place.
      window.setTimeout(() => {
        if (connection.connectionState !== "connected") drop(key, connection);
      }, 20_000);
    }

    (async () => {
      setState("connecting");
      if (!(await startPreview()) || cancelled) return;

      channel = supabase
        .channel(channelName(liveId), { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "offer" }, ({ payload }) => {
          const offer = payload as { key?: unknown; sdp?: unknown };
          if (typeof offer.key !== "string" || typeof offer.sdp !== "string") return;
          if (offer.key.length < 16 || offer.key.length > 64 || offer.sdp.length > 20_000) return;
          void answer(offer.key, offer.sdp).catch(() => undefined);
        })
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") setState("live");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setState("error");
        });

      reporter = window.setInterval(() => {
        announce();
        void reportLiveViewers(liveId, connected());
      }, 15_000);
    })().catch(() => {
      if (!cancelled) setState("error");
    });

    return () => {
      cancelled = true;
      window.clearInterval(reporter);
      for (const connection of connections.values()) connection.close();
      connections.clear();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [liveId, onAir, startPreview]);

  // En quittant le studio, la caméra et le micro s'éteignent.
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    },
    [],
  );

  return { video, state, viewers, micOn, startPreview, flip, toggleMic };
}
