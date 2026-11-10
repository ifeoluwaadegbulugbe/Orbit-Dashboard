/**
 * Orbit's logo: the Pixel O. A 6-unit grid O with notched corners, its
 * top-right block stepped out ("one task off your plate").
 *
 * Below 40px the blocks are drawn heavier so the O and the stepped-out
 * block stay crisp (browser tab, small headers). The same artwork is in
 * src/app/icon.svg and the PNG icons in public/icons.
 */

const LARGE = [
  [23, 17, 18, 6], [23, 41, 18, 6], [17, 23, 6, 18], [41, 23, 6, 18], [47, 11, 6, 6],
] as const;
const SMALL = [
  [22, 16, 20, 8], [22, 40, 20, 8], [14, 24, 8, 16], [42, 24, 8, 16], [48, 8, 8, 8],
] as const;

export function OrbitMark({
  size = 32,
  tile = true,
  className,
  title = "Orbit",
}: {
  size?: number;
  /** Pink rounded tile behind the O (app-icon look). False: just the O, in the current text colour. */
  tile?: boolean;
  className?: string;
  title?: string;
}) {
  const blocks = size < 40 ? SMALL : LARGE;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} className={className}>
      {tile && <rect width="64" height="64" rx="16" fill="#E8557A" />}
      <g fill={tile ? "#FFF8F0" : "currentColor"}>
        {blocks.map(([x, y, w, h]) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} />)}
      </g>
    </svg>
  );
}
