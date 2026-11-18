// La caméra de la cabine et ses limites : on tourne autour du mannequin de ±40° au plus (les photos
// des pièces ne montrent que leur face : rien n'est inventé pour le dos), on zoome sans le traverser.
import { PerspectiveCamera } from "three";

export const MAX_TURN = (40 * Math.PI) / 180;
export const VIEWS = { front: 0, left: -(35 * Math.PI) / 180, right: (35 * Math.PI) / 180 } as const;
export type View = keyof typeof VIEWS;

export function createCamera(aspect: number) {
  const camera = new PerspectiveCamera(24, aspect, 0.1, 30);
  return camera;
}

// La distance qui fait tenir le mannequin entier dans le cadre, avec une marge.
export function framingDistance(camera: PerspectiveCamera, height: number) {
  const vertical = ((camera.fov / 2) * Math.PI) / 180;
  const fitHeight = (height * 1.12) / 2 / Math.tan(vertical);
  const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
  const fitWidth = 0.75 / Math.tan(horizontal);
  return Math.max(fitHeight, fitWidth);
}
