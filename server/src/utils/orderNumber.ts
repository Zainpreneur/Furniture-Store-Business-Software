// Generates a human-friendly, sortable order/PO number, e.g. SO-20260822-4F2A
export function generateOrderNumber(prefix: 'SO' | 'PO'): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `${prefix}-${y}${m}${d}-${rand}`;
}
