// Formatting helpers reused by the tray and the drop confirmation
// affordance. The byte formatter mirrors the dedicated meeting form
// — kept here so both surfaces render the same string for the same
// file size without diverging.

export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
