#!/usr/bin/env node
// Draws the Kvali app icon (a Svaneti tower in front of snowy twin peaks, with a dotted trail,
// hand-drawn like the app's own icons) and writes every image the app build needs:
//
//   mobile/assets/icon.png                       1024, full square (iOS, old Android launchers)
//   mobile/assets/adaptive-icon.png              1024, the drawing alone (Android adaptive icon;
//                                                its background colour is set in app.json)
//   mobile/assets/adaptive-icon-monochrome.png   1024, one colour (Android 13 themed icons)
//   mobile/assets/splash-icon.png                1024, the drawing alone, smaller (splash screen)
//   mobile/assets/notification-icon.png          96, white shape (Android notification icon)
//   mobile/assets/favicon.png                    48 (web)
//
// Needs @resvg/resvg-js, which is not a dependency of the app:
//   npm install --no-save @resvg/resvg-js@2.6.2 && node scripts/app-icon/build.cjs
// (from the repository root)

const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const ROOT = path.resolve(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'mobile', 'assets');

const PINE = '#1F4D35';
const PINE_LIGHT = '#2E6B49';
const CREAM = '#F3EBD3';

// The share of the 1024 canvas the drawing takes: an adaptive icon only shows its middle 2/3
// (72 of 108 dp) and keeps a circle of 66 dp safe from every mask shape
const ADAPTIVE_SCALE = 0.62;
const FULL_SCALE = 0.9;
const SPLASH_SCALE = 0.5;

function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** A wobbly line through the points: one cubic per segment, control points nudged sideways. */
function sketch(points, seed, wobble = 7, closed = false) {
  const rand = rng(seed);
  const pts = closed ? [...points, points[0]] : points;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const o1 = (rand() - 0.5) * 2 * wobble;
    const o2 = (rand() - 0.5) * 2 * wobble;
    const c1 = [ax + dx / 3 + nx * o1, ay + dy / 3 + ny * o1];
    const c2 = [ax + (2 * dx) / 3 + nx * o2, ay + (2 * dy) / 3 + ny * o2];
    const end = [bx + (rand() - 0.5) * wobble * 0.6, by + (rand() - 0.5) * wobble * 0.6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${end[0].toFixed(1)} ${end[1].toFixed(1)}`;
  }
  return d;
}

/** A shape's outline drawn twice (the hand-drawn double line), or as dots for a trail. */
function lines(points, { seed = 1, color, width, closed = false, wobble = 7, dash = null }) {
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';
  const common = (w) =>
    `fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${dashAttr}`;
  const first = `<path d="${sketch(points, seed, wobble, closed)}" ${common(width)}/>`;
  return dash ? first : first + `<path d="${sketch(points, seed + 977, wobble, closed)}" ${common(width * 0.55)}/>`;
}

/** A flat fill, offset a little from its outline, like an imperfect print. */
function fill(points, color, offset = [7, 9], seed = 5) {
  const moved = points.map(([x, y]) => [x + offset[0], y + offset[1]]);
  return `<path d="${sketch(moved, seed, 4, true)} Z" fill="${color}"/>`;
}

const SHAPES = {
  mountains: [[150, 800], [340, 470], [420, 560], [560, 250], [640, 370], [700, 310], [880, 800]],
  capBig: [[560, 250], [628, 362], [598, 350], [574, 392], [548, 352], [516, 376], [500, 344]],
  capSmall: [[700, 310], [748, 384], [722, 374], [700, 402], [676, 366], [664, 372]],
  capLeft: [[340, 470], [378, 534], [354, 524], [336, 548], [316, 512], [304, 522]],
  tower: [[292, 812], [304, 470], [392, 470], [404, 812]],
  roof: [[280, 482], [348, 386], [416, 482]],
  win1: [[332, 526], [364, 526], [364, 568], [332, 568]],
  win2: [[334, 628], [362, 628], [362, 660], [334, 660]],
  door: [[330, 812], [330, 766], [366, 766], [366, 812]],
  ground: [[130, 814], [520, 806], [900, 816]],
  trail: [[700, 790], [610, 720], [690, 650], [600, 580], [660, 512], [596, 452], [586, 420]],
};

/** The drawing in colour: cream lines, light green mountains, snow. */
function colourDrawing(back) {
  const s = SHAPES;
  return [
    fill(s.mountains, PINE_LIGHT, [8, 10], 3),
    fill(s.capBig, CREAM, [6, 7], 11),
    fill(s.capSmall, CREAM, [6, 7], 12),
    fill(s.capLeft, CREAM, [6, 7], 13),
    lines(s.mountains, { seed: 21, color: CREAM, width: 30 }),
    lines(s.trail, { seed: 61, color: CREAM, width: 24, dash: '2 44', wobble: 10 }),
    // The tower stands in front: its body hides the mountain lines behind it
    `<path d="${sketch(s.tower, 31, 3, true)} Z" fill="${back}"/>`,
    `<path d="${sketch(s.roof, 32, 3, true)} Z" fill="${back}"/>`,
    fill(s.roof, CREAM, [5, 6], 33),
    lines(s.tower, { seed: 41, color: CREAM, width: 26, closed: true }),
    lines(s.roof, { seed: 42, color: CREAM, width: 26, closed: true }),
    lines(s.win1, { seed: 43, color: CREAM, width: 16, closed: true, wobble: 3 }),
    lines(s.win2, { seed: 44, color: CREAM, width: 16, closed: true, wobble: 3 }),
    lines(s.door, { seed: 45, color: CREAM, width: 16, wobble: 3 }),
    lines(s.ground, { seed: 51, color: CREAM, width: 26 }),
  ].join('');
}

/**
 * The drawing in one colour on nothing (themed icons, notifications): lines and snow only. The
 * tower cuts the mountain lines behind it out, since there is no background to paint them over.
 */
function monoDrawing(color) {
  const s = SHAPES;
  const knockout = `<mask id="tower-cut"><rect x="-200" y="-200" width="1500" height="1500" fill="#fff"/><path d="${sketch(s.tower, 31, 3, true)} Z" fill="#000"/><path d="${sketch(s.roof, 32, 3, true)} Z" fill="#000"/></mask>`;
  return [
    `<defs>${knockout}</defs>`,
    `<g mask="url(#tower-cut)">`,
    fill(s.capBig, color, [6, 7], 11),
    fill(s.capSmall, color, [6, 7], 12),
    fill(s.capLeft, color, [6, 7], 13),
    lines(s.mountains, { seed: 21, color, width: 30 }),
    lines(s.trail, { seed: 61, color, width: 24, dash: '2 44', wobble: 10 }),
    lines(s.ground, { seed: 51, color, width: 26 }),
    `</g>`,
    fill(s.roof, color, [5, 6], 33),
    lines(s.tower, { seed: 41, color, width: 26, closed: true }),
    lines(s.roof, { seed: 42, color, width: 26, closed: true }),
    lines(s.win1, { seed: 43, color, width: 16, closed: true, wobble: 3 }),
    lines(s.win2, { seed: 44, color, width: 16, closed: true, wobble: 3 }),
    lines(s.door, { seed: 45, color, width: 16, wobble: 3 }),
  ].join('');
}

/** The drawing scaled around the canvas middle (its own middle is about 515, 560). */
function placed(content, scale) {
  return `<g transform="translate(${512 - 515 * scale} ${512 - 560 * scale}) scale(${scale})">${content}</g>`;
}

function svg(inner, background = null) {
  const bg = background ? `<rect width="1024" height="1024" fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${bg}${inner}</svg>`;
}

function write(name, svgText, size = 1024) {
  const png = new Resvg(svgText, { fitTo: { mode: 'width', value: size } }).render().asPng();
  fs.writeFileSync(path.join(ASSETS, name), png);
  console.log(`${name.padEnd(32)} ${size}px  ${Math.round(png.length / 1024)} KB`);
}

write('icon.png', svg(placed(colourDrawing(PINE), FULL_SCALE), PINE));
write('adaptive-icon.png', svg(placed(colourDrawing(PINE), ADAPTIVE_SCALE)));
write('adaptive-icon-monochrome.png', svg(placed(monoDrawing('#FFFFFF'), ADAPTIVE_SCALE)));
write('splash-icon.png', svg(placed(colourDrawing(PINE), SPLASH_SCALE)));
// Notification icons are drawn small: the drawing fills most of the square
write('notification-icon.png', svg(placed(monoDrawing('#FFFFFF'), 1.05)), 96);
write('favicon.png', svg(placed(colourDrawing(PINE), FULL_SCALE), PINE), 48);
