import {
  BookOpen, FileText, ClipboardCheck, GraduationCap, Library, Map,
  Briefcase, Users, PartyPopper, Video, Award, FolderOpen, CalendarDays,
  MessageSquare, Folder, NotebookPen, TestTube, Microscope, Trophy,
  Image, Film, FileBadge, ScrollText, BookMarked, MapPin, Lightbulb,
  type LucideIcon,
} from 'lucide-react';

export const iconMap: Record<string, LucideIcon> = {
  BookOpen, FileText, ClipboardCheck, GraduationCap, Library, Map,
  Briefcase, Users, PartyPopper, Video, Award, FolderOpen, CalendarDays,
  MessageSquare, Folder, NotebookPen, TestTube, Microscope, Trophy,
  Image, Film, FileBadge, ScrollText, BookMarked, MapPin, Lightbulb,
};

export const iconChoices = Object.keys(iconMap);

export function getIcon(name: string): LucideIcon {
  return iconMap[name] ?? FolderOpen;
}
