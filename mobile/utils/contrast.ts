/** WCAG colour contrast for #RRGGBB colours. */

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Not a #RRGGBB colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

const linear = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio between two colours, from 1 to 21. 4.5 is the minimum for body text. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `top` drawn at `alpha` (0–1) over `bottom`, as the screen shows it. */
export function blend(top: string, bottom: string, alpha: number): string {
  const t = channels(top);
  const b = channels(bottom);
  const mixed = t.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
