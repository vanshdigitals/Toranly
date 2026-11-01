/**
 * Date formatting helpers for Toranly
 * Format dates strictly as "15 Feb 2027" (Intl en-GB day/month/year).
 */

export function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return 'Date unset';
  try {
    const trimmed = dateStr.trim();
    if (!trimmed) return 'Date unset';

    // Parse YYYY-MM-DD directly to prevent local timezone shifts across midnight
    const datePart = trimmed.split('T')[0].trim();
    const parts = datePart.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
    }

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}
