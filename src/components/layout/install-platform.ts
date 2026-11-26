// Comment installer FRIPE sur l'appareil en cours. Sans dépendance au navigateur : testé tel quel.
//   prompt  : le navigateur propose sa fenêtre d'installation (Chrome, Edge, Samsung Internet, Opera…).
//   ios     : iPhone et iPad, aucune fenêtre possible : Partager > Sur l'écran d'accueil.
//   inapp   : navigateur intégré d'Instagram, Facebook, TikTok… : il faut d'abord ouvrir le vrai navigateur.
//   android : Android sans fenêtre proposée (Firefox, ou fenêtre déjà refusée) : menu > Installer.
//   desktop : ordinateur sans fenêtre proposée : menu du navigateur ou icône de la barre d'adresse.
export type InstallPlatform = "prompt" | "ios" | "inapp" | "android" | "desktop";

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|Bytedance|Snapchat|Pinterest|LinkedInApp|Twitter|MicroMessenger|; wv\)/i;

export function isIos(userAgent: string, maxTouchPoints = 0) {
  // L'iPad récent se présente comme un Mac : on le reconnaît à son écran tactile.
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

export function installPlatform(input: { userAgent: string; maxTouchPoints?: number; canPrompt: boolean }): InstallPlatform {
  if (input.canPrompt) return "prompt";
  if (IN_APP.test(input.userAgent)) return "inapp";
  if (isIos(input.userAgent, input.maxTouchPoints)) return "ios";
  if (/Android/i.test(input.userAgent)) return "android";
  return "desktop";
}
