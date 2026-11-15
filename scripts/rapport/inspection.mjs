// Ce que Playwright exécute dans chaque page : textes latins sur une page arabe, débordement
// horizontal (et les éléments qui le causent), contraste des champs et des options de listes.
// Les couleurs passent par un canvas : il convertit oklch(), lab()… en sRGB comme le navigateur.
export function inspectPage({ arabic }) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const rgba = (color) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = "#000";
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255 };
  };
  const luminance = ({ r, g, b }) => {
    const channel = (value) => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const ratio = (one, two) => {
    const [high, low] = [luminance(one), luminance(two)].sort((a, b) => b - a);
    return (high + 0.05) / (low + 0.05);
  };
  const background = (element) => {
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      const color = rgba(getComputedStyle(node).backgroundColor);
      if (color.a > 0.5) return color;
    }
    return rgba(getComputedStyle(document.body).backgroundColor);
  };
  const visible = (element) => {
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };
  const describe = (element) => {
    const id = element.id ? `#${element.id}` : "";
    const classes = typeof element.className === "string" ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}` : "";
    return `${element.tagName.toLowerCase()}${id}${classes === "." ? "" : classes}`;
  };

  // 1. Textes latins sur une page arabe
  const latin = [];
  if (arabic) {
    const allowed = /^(Friptex|FRIPE|Fripe|Fripe Walk|Walk|N|TND|OK|PDF|QR|SMS|Live|AI|Wi-?Fi|Google|Apple|WhatsApp|Facebook|Instagram|TikTok|Visa|Mastercard|https?:\/\/\S+|\S+@\S+|\+?[\d\s.\-()]+|[A-Z]{1,3}\d*|R-\d+)$/;
    // Noms propres et formats techniques qu'une phrase arabe peut citer tels quels.
    const names = /\b(Friptex|FRIPE|Fripe Walk|Fripe|G-Mall|g-mall\.tn|CSV|MP4|WebM|MOV|JPEG|JPG|PNG|WebP|GIF|PDF|alt\+T|TOTP|QR|DT|TND)\b/g;
    const foreign = (element) => {
      const tagged = element.closest("[lang]");
      return tagged && tagged !== document.documentElement && !tagged.lang.startsWith(document.documentElement.lang);
    };
    const leftover = (text) => text.replace(names, "").replace(/[؀-ۿ]+/g, "");
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || parent.closest("script, style, noscript, svg, [dir='ltr'], code, pre, nextjs-portal, [data-nextjs-toast]")) continue;
      const text = node.textContent.replace(/\s+/g, " ").trim();
      if (!/[A-Za-zÀ-ÿ]{2,}/.test(leftover(text)) || allowed.test(text) || foreign(parent) || !visible(parent)) continue;
      latin.push({ text: text.slice(0, 80), where: describe(parent) });
    }
    for (const element of document.querySelectorAll("[placeholder], [aria-label], [title], img[alt]")) {
      if (element.closest("[dir='ltr'], nextjs-portal")) continue;
      for (const attribute of ["placeholder", "aria-label", "title", "alt"]) {
        const value = element.getAttribute(attribute)?.trim();
        if (value && /[A-Za-zÀ-ÿ]{3,}/.test(leftover(value)) && !allowed.test(value) && !foreign(element)) latin.push({ text: `${attribute}="${value.slice(0, 60)}"`, where: describe(element) });
      }
    }
  }

  // 2. Débordement horizontal
  const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  const culprits = [];
  if (overflow > 1) {
    const width = document.documentElement.clientWidth;
    for (const element of document.body.querySelectorAll("*")) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || (box.right <= width + 1 && box.left >= -1)) continue;
      let clipped = false;
      for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.overflowX !== "visible" || style.position === "fixed") {
          clipped = true;
          break;
        }
      }
      if (!clipped && visible(element)) culprits.push(`${describe(element)} (${Math.round(box.left)}→${Math.round(box.right)})`);
      if (culprits.length >= 5) break;
    }
  }

  // 3. Contraste des champs, boutons et options
  const contrast = [];
  const controls = document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]), select, textarea, button, [role=option], [role=menuitem]");
  for (const element of controls) {
    if (!visible(element) || element.closest("nextjs-portal")) continue;
    const style = getComputedStyle(element);
    const value = ratio(rgba(style.color), background(element));
    const text = (element.innerText || element.value || element.getAttribute("placeholder") || "").trim().slice(0, 40);
    if (value < 3 && text) contrast.push({ what: `${describe(element)} « ${text} »`, ratio: Math.round(value * 100) / 100 });
  }
  // Les options d'un <select> s'affichent dans une liste dessinée par le navigateur. Firefox, Edge et
  // Android ignorent souvent color-scheme et la dessinent blanche : on se place dans ce pire cas,
  // sauf si l'option porte son propre fond.
  for (const select of document.querySelectorAll("select")) {
    if (!visible(select)) continue;
    const scheme = getComputedStyle(select).colorScheme;
    for (const option of [...select.options].slice(0, 3)) {
      const style = getComputedStyle(option);
      const own = rgba(style.backgroundColor);
      const popup = own.a > 0.5 ? own : { r: 255, g: 255, b: 255, a: 1 };
      const value = ratio(rgba(style.color), popup);
      if (value < 4.5) {
        contrast.push({ what: `option « ${option.textContent.trim().slice(0, 30)} » dans ${describe(select)} (color-scheme: ${scheme})`, ratio: Math.round(value * 100) / 100 });
        break;
      }
    }
  }

  // 4. Sens de lecture
  const dir = document.documentElement.dir;
  const title = document.querySelector("h1")?.innerText.trim().slice(0, 80) ?? "";
  const fieldErrors = /404|introuvable|غير موجودة|Application error|Unhandled Runtime Error/.test(document.body.innerText.slice(0, 2000)) ? document.body.innerText.slice(0, 200) : "";

  return { latin, overflow, culprits, contrast, dir, title, fieldErrors };
}
