import { CSSProperties } from 'react';

// Shared loading placeholders. Pages used to render nothing (or briefly
// flash an empty state) while the first fetch was in flight; these give a
// stable shape instead so the layout doesn't jump once data arrives.

export function Skeleton({
  width,
  height = 13,
  style,
}: {
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
}) {
  return <div className="skeleton skeleton-line" style={{ width, height, ...style }} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '55%' : '100%'} />
      ))}
    </div>
  );
}

export function SkeletonTableRows({ rows = 4, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: columns }).map((__, c) => (
            <td key={c}>
              <Skeleton width={c === 0 ? '70%' : '50%'} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
