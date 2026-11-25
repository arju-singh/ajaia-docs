// SQLite stores UTC as "YYYY-MM-DD HH:MM:SS" with no zone marker.
export function parseDbDate(value) {
  return new Date(value.replace(' ', 'T') + 'Z');
}

export function timeAgo(value) {
  const seconds = Math.round((Date.now() - parseDbDate(value).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return parseDbDate(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
