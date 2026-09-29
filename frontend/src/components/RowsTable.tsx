import { ClipboardEvent, CSSProperties, Dispatch, SetStateAction } from 'react';

export type RowsColumn<Row> = { key: keyof Row & string; label: string; placeholder: string; wide?: boolean };

// An editable, numbered table for entering many people at once (teachers,
// students) on the school's public details page. Pasting several cells —
// tab/newline separated, as Excel and Google Sheets copy them — fills the
// table from the cell pasted into, adding rows as needed.
export function RowsTable<Row extends Record<string, string>>({
  columns,
  rows,
  setRows,
  emptyRow,
  maxRows,
  rowLabel,
}: {
  columns: RowsColumn<Row>[];
  rows: Row[];
  setRows: Dispatch<SetStateAction<Row[]>>;
  emptyRow: () => Row;
  maxRows: number;
  rowLabel: string;
}) {
  // A CSS variable (not an inline grid-template-columns) so the phone layout's media query can still override it.
  const gridStyle = { '--row-columns': `28px ${columns.map((c) => (c.wide ? '1.4fr' : '1fr')).join(' ')} 40px` } as CSSProperties;

  function setCell(i: number, key: keyof Row, value: string) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: value } : row)));
  }

  function addRows(n: number) {
    setRows((r) => [...r, ...Array.from({ length: Math.min(n, maxRows - r.length) }, emptyRow)]);
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) {
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return; // a single value — let it paste normally
    e.preventDefault();
    const pasted = text
      .replace(/\r/g, '')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.split('\t'));
    setRows((current) => {
      const next = [...current];
      pasted.forEach((cells, offset) => {
        const i = rowIndex + offset;
        if (i >= maxRows) return;
        const row = { ...(next[i] ?? emptyRow()) };
        cells.forEach((value, c) => {
          const column = columns[colIndex + c];
          if (column) (row as Record<string, string>)[column.key] = value.trim();
        });
        next[i] = row;
      });
      return next;
    });
  }

  return (
    <>
      <div className="public-form-rows">
        <div className="public-form-row public-form-head" style={gridStyle} aria-hidden="true">
          <span>#</span>
          {columns.map((c) => (
            <span key={c.key}>{c.label}</span>
          ))}
          <span />
        </div>
        {rows.map((row, i) => (
          <div key={i} className="public-form-row" style={gridStyle}>
            <span className="public-form-num" data-label={rowLabel}>
              {i + 1}
            </span>
            {columns.map((c, colIndex) => (
              <input
                key={c.key}
                placeholder={c.placeholder}
                value={row[c.key]}
                onChange={(e) => setCell(i, c.key, e.target.value)}
                onPaste={(e) => onPaste(e, i, colIndex)}
                aria-label={`${rowLabel} ${i + 1} ${c.label.replace(' *', '').toLowerCase()}`}
              />
            ))}
            <button
              type="button"
              className="secondary"
              onClick={() => setRows((r) => (r.length > 1 ? r.filter((_, j) => j !== i) : [emptyRow()]))}
              aria-label={`Remove ${rowLabel.toLowerCase()} ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="button-row">
        <button type="button" className="secondary" onClick={() => addRows(1)} disabled={rows.length >= maxRows}>
          + Add a row
        </button>
        <button type="button" className="secondary" onClick={() => addRows(10)} disabled={rows.length >= maxRows}>
          + Add 10 rows
        </button>
      </div>
    </>
  );
}
