import { describe, expect, it } from "vitest";
import { installPlatform, isIos } from "@/components/layout/install-platform";
import ar from "@/messages/ar.json";
import fr from "@/messages/fr.json";

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1",
  ipadAsMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0",
  samsung: "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36",
  instagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0",
  facebookAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0;]",
  tiktok: "Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36 musical_ly_2023",
  desktopFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
};

describe("bouton d'installation", () => {
  it("utilise la fenêtre du navigateur dès qu'elle est proposée", () => {
    for (const userAgent of [UA.androidChrome, UA.samsung, UA.desktopFirefox]) {
      expect(installPlatform({ userAgent, canPrompt: true })).toBe("prompt");
    }
  });

  it("iPhone et iPad : les gestes du menu Partager, quel que soit le navigateur", () => {
    expect(installPlatform({ userAgent: UA.iphoneSafari, canPrompt: false })).toBe("ios");
    expect(installPlatform({ userAgent: UA.iphoneChrome, canPrompt: false })).toBe("ios");
    expect(installPlatform({ userAgent: UA.ipadAsMac, maxTouchPoints: 5, canPrompt: false })).toBe("ios");
  });

  it("un Mac sans écran tactile n'est pas un iPad", () => {
    expect(isIos(UA.ipadAsMac, 0)).toBe(false);
    expect(installPlatform({ userAgent: UA.ipadAsMac, maxTouchPoints: 0, canPrompt: false })).toBe("desktop");
  });

  it("navigateurs d'Instagram, Facebook, TikTok : ouvrir d'abord le vrai navigateur", () => {
    for (const userAgent of [UA.instagram, UA.facebookAndroid, UA.tiktok]) {
      expect(installPlatform({ userAgent, canPrompt: false })).toBe("inapp");
    }
  });

  it("Android sans fenêtre proposée (Firefox) : le menu du navigateur", () => {
    expect(installPlatform({ userAgent: UA.androidFirefox, canPrompt: false })).toBe("android");
    expect(installPlatform({ userAgent: UA.androidChrome, canPrompt: false })).toBe("android");
  });

  it("chaque cas a son texte en français et en arabe", () => {
    for (const platform of ["ios", "android", "desktop", "inapp"] as const) {
      expect(fr.install.lead[platform]).toBeTruthy();
      expect(ar.install.lead[platform]).toBeTruthy();
    }
  });
});
