import { FileText, Image, Video, AudioLines, FileSpreadsheet, Presentation, FileType } from 'lucide-react';
import { getFileIconName } from '@/utils/format';

interface FileIconProps {
  mimeType: string;
  size?: number;
}

export function FileIcon({ mimeType, size = 40 }: FileIconProps) {
  const type = getFileIconName(mimeType);
  const config: Record<string, { icon: typeof FileText; color: string; bg: string }> = {
    image: { icon: Image, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
    video: { icon: Video, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
    audio: { icon: AudioLines, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    pdf: { icon: FileType, color: 'text-red-700 dark:text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
    word: { icon: FileText, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    excel: { icon: FileSpreadsheet, color: 'text-green-700 dark:text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    ppt: { icon: Presentation, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    file: { icon: FileText, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700/30' },
  };
  const { icon: Icon, color, bg } = config[type] ?? config.file;
  return (
    <div className={`rounded-xl flex items-center justify-center shrink-0 ${bg}`} style={{ width: size, height: size }}>
      <Icon size={size * 0.5} className={color} />
    </div>
  );
}
