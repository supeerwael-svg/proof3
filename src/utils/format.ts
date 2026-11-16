export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(timestamp: number, lang: string = 'ar'): string {
  const d = new Date(timestamp);
  const locale = lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US';
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatTime(timestamp: number, lang: string = 'ar'): string {
  const d = new Date(timestamp);
  const locale = lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US';
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(timestamp: number, lang: string = 'ar'): string {
  const diff = Date.now() - timestamp;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (lang === 'ar') {
    if (min < 1) return 'الآن';
    if (min < 60) return `منذ ${min} دقيقة`;
    if (hr < 24) return `منذ ${hr} ساعة`;
    return `منذ ${day} يوم`;
  }
  if (min < 1) return 'now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  return `${day}d ago`;
}

export function getFileIconName(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'excel';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'ppt';
  return 'file';
}
