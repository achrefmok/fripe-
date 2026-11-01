export type ImageKind = { mime: string; extension: string };

// Le type annoncé par le navigateur n'est pas fiable : on lit la signature du fichier.
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  const startsWith = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (startsWith([0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", extension: "jpg" };
  }

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", extension: "png" };
  }

  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: "image/webp", extension: "webp" };
  }

  return null;
}

export function detectVideoKind(bytes: Uint8Array): ImageKind | null {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));

  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { mime: "video/webm", extension: "webm" };
  }

  if (text(4, 8) === "ftyp") {
    return text(8, 10) === "qt"
      ? { mime: "video/quicktime", extension: "mov" }
      : { mime: "video/mp4", extension: "mp4" };
  }

  return null;
}
