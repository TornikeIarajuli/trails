import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { File as FSFile, Paths } from 'expo-file-system';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  CardStat,
  LatLng,
  routeDrawing,
  titleFontSize,
  wrapTitle,
} from '../../utils/shareCard';

export interface ShareCardData {
  trailName: string;
  /** "Kazbegi · 14 November 2026" */
  subtitle: string;
  stats: CardStat[];
  route: LatLng[];
}

export interface ShareCardHandle {
  /** Renders the card at full size (1080 × 1920) into a PNG in the cache; returns its uri. */
  exportPng: () => Promise<string>;
}

const ROUTE_BOX = { x: 150, y: 250, size: 780 };

// Contour-like lines in the background; the same for every card
const CONTOURS = [
  'M-40 1420 C 180 1340, 380 1500, 620 1410 S 1000 1330, 1140 1400',
  'M-40 1500 C 200 1430, 400 1590, 640 1500 S 1010 1420, 1140 1490',
  'M-40 1590 C 220 1520, 420 1680, 660 1590 S 1020 1510, 1140 1580',
  'M-40 160 C 220 100, 460 230, 700 150 S 1020 80, 1140 140',
];

/**
 * The picture shared for a finished hike: the route's shape, the trail, the date and the
 * numbers, on a dark green background, sized for an Instagram story. Drawn with SVG, so it can
 * be turned into a PNG on the phone (react-native-svg's toDataURL).
 */
export const ShareCard = forwardRef<ShareCardHandle, { data: ShareCardData; width: number }>(function ShareCard(
  { data, width },
  ref,
) {
  const svgRef = useRef<Svg>(null);
  const drawing = useMemo(() => routeDrawing(data.route, ROUTE_BOX), [data.route]);
  const fontSize = titleFontSize(data.trailName);
  const titleLines = wrapTitle(data.trailName, fontSize >= 92 ? 18 : fontSize >= 80 ? 21 : 26, 2);
  const titleTop = 1210;

  useImperativeHandle(ref, () => ({
    exportPng: () =>
      new Promise<string>((resolve, reject) => {
        const svg = svgRef.current as unknown as {
          toDataURL?: (callback: (base64: string) => void, options?: object) => void;
        } | null;
        if (!svg?.toDataURL) {
          reject(new Error('The picture cannot be made on this device'));
          return;
        }
        svg.toDataURL(
          (base64) => {
            try {
              const file = new FSFile(Paths.cache, `hike-${Date.now()}.png`);
              file.write(base64.replace(/\s/g, ''), { encoding: 'base64' });
              resolve(file.uri);
            } catch (error) {
              reject(error);
            }
          },
          { width: CARD_WIDTH, height: CARD_HEIGHT },
        );
      }),
  }));

  const statWidth = data.stats.length > 0 ? CARD_WIDTH / data.stats.length : CARD_WIDTH;

  return (
    <Svg ref={svgRef} width={width} height={(width * CARD_HEIGHT) / CARD_WIDTH} viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1B4332" />
          <Stop offset="1" stopColor="#081C15" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#sky)" />
      <G opacity={0.12}>
        {CONTOURS.map((d) => (
          <Path key={d} d={d} stroke="#D8F3DC" strokeWidth={3} fill="none" />
        ))}
      </G>

      <SvgText x={CARD_WIDTH / 2} y={150} fill="#D8F3DC" fontSize={34} fontWeight="700" letterSpacing={8} textAnchor="middle" opacity={0.85}>
        MIKIRI TRAILS
      </SvgText>

      {drawing ? (
        <G>
          <Path d={drawing.d} stroke="#95D5B2" strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.3} />
          <Path d={drawing.d} stroke="#FFFFFF" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Circle cx={drawing.start.x} cy={drawing.start.y} r={20} fill="#52B788" stroke="#FFFFFF" strokeWidth={7} />
          <Circle cx={drawing.end.x} cy={drawing.end.y} r={20} fill="#FFB703" stroke="#FFFFFF" strokeWidth={7} />
        </G>
      ) : (
        // No route to draw: mountains instead
        <G opacity={0.9}>
          <Path d="M200 1000 L460 560 L600 780 L720 620 L900 1000 Z" fill="#2D6A4F" />
          <Path d="M460 560 L520 662 L470 640 L420 690 Z" fill="#D8F3DC" />
          <Path d="M720 620 L760 690 L725 675 L690 700 Z" fill="#D8F3DC" />
        </G>
      )}

      {titleLines.map((line, i) => (
        <SvgText
          key={`${i}-${line}`}
          x={CARD_WIDTH / 2}
          y={titleTop + i * fontSize * 1.12}
          fill="#FFFFFF"
          fontSize={fontSize}
          fontWeight="800"
          textAnchor="middle"
        >
          {line}
        </SvgText>
      ))}
      {data.subtitle ? (
        <SvgText
          x={CARD_WIDTH / 2}
          y={titleTop + titleLines.length * fontSize * 1.12 + 30}
          fill="#B7E4C7"
          fontSize={38}
          textAnchor="middle"
        >
          {data.subtitle}
        </SvgText>
      ) : null}

      {data.stats.map((stat, i) => (
        <G key={stat.label}>
          <SvgText x={statWidth * i + statWidth / 2} y={1640} fill="#FFFFFF" fontSize={68} fontWeight="800" textAnchor="middle">
            {stat.value}
          </SvgText>
          <SvgText x={statWidth * i + statWidth / 2} y={1700} fill="#B7E4C7" fontSize={32} textAnchor="middle" letterSpacing={2}>
            {stat.label.toUpperCase()}
          </SvgText>
        </G>
      ))}

      <SvgText x={CARD_WIDTH / 2} y={1840} fill="#D8F3DC" fontSize={32} textAnchor="middle" opacity={0.7}>
        #GeorgiaTrails
      </SvgText>
    </Svg>
  );
});
