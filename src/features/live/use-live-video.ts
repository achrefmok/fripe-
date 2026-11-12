"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { reportLiveViewers } from "./actions";

export type ViewerVideoState = "idle" | "connecting" | "waiting" | "playing" | "full" | "error";
export type HostVideoState = "idle" | "preview" | "denied" | "connecting" | "live" | "error";

// La vidéo va directement du téléphone de la boutique à chaque spectateur (WebRTC, de pair à pair),
// sans service de diffusion : c'est gratuit, mais c'est le téléphone qui porte chaque spectateur.
// On plafonne donc la salle et le débit envoyé à chacun.
export const LIVE_MAX_VIEWERS = 12;
// 720p à 24 images/s, en portrait : le format d'un téléphone tenu à la main.
const VIDEO = { width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 24, max: 24 } };
const AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
// Plafond par spectateur ; WebRTC descend tout seul si le réseau ne suit pas.
const MAX_BITRATE = 1_200_000;
// Serveurs publics qui aident deux appareils à se trouver ; ils ne voient jamais la vidéo.
const STUN: RTCIceServer = { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] };
const MAX_SDP = 20_000;

// Un canal broadcast par Live, en deux sujets privés (voir la migration de signalisation) :
// les demandes des spectateurs, et les réponses que seule la boutique peut écrire.
const requestsTopic = (liveId: string) => `live-video:${liveId}`;
const shopTopic = (liveId: string) => `live-video:${liveId}:shop`;

// Relais TURN : identifiants temporaires donnés par /api/turn à un utilisateur connecté. Sans
// session ou sans relais configuré, on se contente du STUN public.
let relay: { servers: RTCIceServer[]; until: number } | null = null;

async function iceConfig(): Promise<RTCConfiguration> {
  if (!relay || Date.now() > relay.until) {
    try {
      const response = await fetch("/api/turn", { cache: "no-store" });
      const body = response.ok ? ((await response.json()) as { iceServers?: unknown; ttl?: unknown }) : {};
      const servers = Array.isArray(body.iceServers) ? (body.iceServers as RTCIceServer[]) : [];
      const ttl = typeof body.ttl === "number" ? body.ttl : 0;
      // On renouvelle dix minutes avant l'expiration, et au plus souvent toutes les cinq minutes.
      relay = { servers, until: Date.now() + Math.max(300, ttl - 600) * 1000 };
    } catch {
      return { iceServers: [STUN] };
    }
  }

  return { iceServers: [STUN, ...relay.servers] };
}

// Rejoindre un canal privé. Une erreur avant l'arrivée est un refus ; après, une coupure.
function join(channel: RealtimeChannel, onDrop: () => void) {
  return new Promise<void>((resolve, reject) => {
    let joined = false;
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        joined = true;
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        if (joined) onDrop();
        else reject(new Error(status));
      }
    });
  });
}

// On attend que l'appareil ait listé ses chemins réseau (relais compris) : la description part
// alors en un seul message.
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
    const timer = window.setTimeout(done, 3000);
    connection.addEventListener("icegatheringstatechange", check);
  });
}

// Côté client : on demande la vidéo à la boutique et on l'affiche. La demande part sur le sujet
// ouvert du Live ; la réponse n'est écoutée que sur le sujet que seule la boutique peut écrire.
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

    const requests = supabase.channel(requestsTopic(liveId), { config: { private: true, broadcast: { self: false } } });
    const shop = supabase.channel(shopTopic(liveId), { config: { private: true } });
    const broken = () => {
      if (!cancelled) setState("error");
    };

    // La liaison n'a pas abouti alors que la boutique a répondu. Trois échecs de suite, et on le
    // dit au lieu de faire patienter sans fin.
    function fail(current: RTCPeerConnection) {
      if (cancelled || connection !== current) return;
      window.clearTimeout(retry);
      current.close();
      connection = null;
      failures += 1;
      if (failures >= 3) {
        setState("error");
        return;
      }
      setState("waiting");
      retry = window.setTimeout(() => void ask().catch(broken), 1500);
    }

    async function ask() {
      if (cancelled) return;
      connection?.close();

      const current = new RTCPeerConnection(await iceConfig());
      if (cancelled) {
        current.close();
        return;
      }
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
          fail(current);
        }
      };

      await current.setLocalDescription(await current.createOffer());
      await gathered(current);
      if (cancelled || connection !== current) return;

      await requests.send({ type: "broadcast", event: "offer", payload: { key, sdp: current.localDescription?.sdp } });
      // Sans réponse, la boutique n'a peut-être pas encore ouvert sa caméra : on redemande un peu
      // plus tard. Une fois la réponse reçue, c'est le délai de liaison qui prend le relais.
      retry = window.setTimeout(() => {
        if (connection === current && current.signalingState === "have-local-offer") void ask().catch(broken);
      }, 8000);
    }

    shop
      .on("broadcast", { event: "answer" }, ({ payload }) => {
        const signal = payload as { key?: unknown; sdp?: unknown };
        if (cancelled || signal.key !== key || !connection) return;
        if (typeof signal.sdp !== "string" || signal.sdp.length > MAX_SDP || connection.signalingState !== "have-local-offer") return;

        const current = connection;
        window.clearTimeout(retry);
        void current.setRemoteDescription({ type: "answer", sdp: signal.sdp }).catch(broken);
        // La boutique a répondu : la liaison doit s'établir en quelques secondes.
        retry = window.setTimeout(() => {
          if (current.connectionState !== "connected") fail(current);
        }, 15_000);
      })
      .on("broadcast", { event: "full" }, ({ payload }) => {
        if (cancelled || (payload as { key?: unknown }).key !== key) return;
        window.clearTimeout(retry);
        setState("full");
      })
      // Le nombre de spectateurs, annoncé par la boutique : un simple affichage.
      .on("broadcast", { event: "count" }, ({ payload }) => {
        const count = Number((payload as { count?: number }).count);
        if (Number.isInteger(count) && count >= 0 && count <= LIVE_MAX_VIEWERS) setViewers(count);
      });

    (async () => {
      // Les canaux privés s'ouvrent avec la session du visiteur, ou la clé publique sans session.
      await supabase.realtime.setAuth();
      await Promise.all([join(requests, broken), join(shop, broken)]);
      if (cancelled) return;
      setState("waiting");
      await ask();
    })().catch(broken);

    return () => {
      cancelled = true;
      window.clearTimeout(retry);
      connection?.close();
      void supabase.removeChannel(requests);
      void supabase.removeChannel(shop);
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
// que le Live démarre (`start_live`). `end_live` coupe le direct, et ferme les deux sujets.
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
        audio: AUDIO,
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

    const requests = supabase.channel(requestsTopic(liveId), { config: { private: true, broadcast: { self: false } } });
    const shop = supabase.channel(shopTopic(liveId), { config: { private: true, broadcast: { self: false } } });

    const reply = (event: "answer" | "full" | "count", payload: Record<string, unknown>) =>
      shop.send({ type: "broadcast", event, payload });

    const connected = () => [...connections.values()].filter((connection) => connection.connectionState === "connected").length;
    const announce = () => {
      const count = connected();
      setViewers(count);
      void reply("count", { count });
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
        await reply("full", { key });
        return;
      }

      const connection = new RTCPeerConnection(await iceConfig());
      if (cancelled) {
        connection.close();
        return;
      }
      connections.set(key, connection);
      for (const track of media.getTracks()) connection.addTrack(track, media);

      connection.onconnectionstatechange = () => {
        if (connection.connectionState === "connected") announce();
        else if (connection.connectionState === "failed" || connection.connectionState === "disconnected" || connection.connectionState === "closed") drop(key, connection);
      };

      await connection.setRemoteDescription({ type: "offer", sdp });
      await connection.setLocalDescription(await connection.createAnswer());

      // Débit plafonné : chaque spectateur coûte un envoi complet au téléphone de la boutique.
      for (const sender of connection.getSenders()) {
        if (sender.track?.kind !== "video") continue;
        const parameters = sender.getParameters();
        parameters.encodings = (parameters.encodings.length ? parameters.encodings : [{}]).map((encoding) => ({ ...encoding, maxBitrate: MAX_BITRATE }));
        await sender.setParameters(parameters).catch(() => undefined);
      }

      await gathered(connection);
      if (cancelled || connections.get(key) !== connection || !connection.localDescription) return;
      await reply("answer", { key, sdp: connection.localDescription.sdp });

      // Un spectateur qui ne termine pas la liaison libère sa place.
      window.setTimeout(() => {
        if (connection.connectionState !== "connected") drop(key, connection);
      }, 20_000);
    }

    requests.on("broadcast", { event: "offer" }, ({ payload }) => {
      const offer = payload as { key?: unknown; sdp?: unknown };
      if (typeof offer.key !== "string" || typeof offer.sdp !== "string") return;
      if (offer.key.length < 16 || offer.key.length > 64 || offer.sdp.length > MAX_SDP) return;
      void answer(offer.key, offer.sdp).catch(() => undefined);
    });

    const broken = () => {
      if (!cancelled) setState("error");
    };

    (async () => {
      setState("connecting");
      if (!(await startPreview()) || cancelled) return;

      await supabase.realtime.setAuth();
      // Le sujet des réponses n'accepte que l'équipe de la boutique : un refus ici est une erreur.
      await Promise.all([join(shop, broken), join(requests, broken)]);
      if (cancelled) return;
      setState("live");

      reporter = window.setInterval(() => {
        announce();
        void reportLiveViewers(liveId, connected());
      }, 15_000);
    })().catch(broken);

    return () => {
      cancelled = true;
      window.clearInterval(reporter);
      for (const connection of connections.values()) connection.close();
      connections.clear();
      void supabase.removeChannel(requests);
      void supabase.removeChannel(shop);
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
