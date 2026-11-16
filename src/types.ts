// Base record shape shared by all tables
export interface BaseEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  syncStatus: 'local' | 'pending' | 'synced';
  ownerId: string;
  schoolId: string;
  academicYearId: string;
}

export type UserRole = 'super_admin' | 'teacher_write' | 'teacher_read' | 'banned';

export type SyncStatus = 'local' | 'pending' | 'synced';

export interface Permission {
  section: string;
  access: 'read' | 'write' | 'comment' | 'none';
}

export interface UserEntity extends BaseEntity {
  username: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
  permissions: Permission[];
  avatarColor: string;
  lastSeen: number;
  isOnline: boolean;
}

export interface InviteCodeEntity extends BaseEntity {
  code: string;
  createdBy: string;
  maxUses: number;
  usedCount: number;
  expiresAt: number;
  role: UserRole;
}

export interface SectionEntity extends BaseEntity {
  key: string;
  name: string;
  nameEn: string;
  nameFr: string;
  icon: string;
  order: number;
  color?: string;
}

export interface FolderEntity extends BaseEntity {
  key: string;
  sectionKey: string;
  parentFolderId: string | null;
  name: string;
  nameEn: string;
  nameFr: string;
  order: number;
  metadata?: Record<string, unknown>;
}

export interface FileEntity extends BaseEntity {
  folderId: string;
  sectionKey: string;
  name: string;
  type: string;
  mimeType: string;
  size: number;
  blob: Blob;
  tags: string[];
  favorite: boolean;
  lastOpened: number | null;
  order: number;
  linkedFileId?: string | null;
  academicYearId: string;
}

export interface AnnouncementEntity extends BaseEntity {
  title: string;
  content: string;
  pinned: boolean;
}

export interface ForumTopicEntity extends BaseEntity {
  title: string;
  content: string;
  tags: string[];
  authorName: string;
  repliesCount: number;
}

export interface ForumReplyEntity extends BaseEntity {
  topicId: string;
  content: string;
  authorName: string;
}

export interface ChatRoomEntity extends BaseEntity {
  name: string;
  type: 'coordination' | 'direct';
  members: string[];
}

export interface ChatMessageEntity extends BaseEntity {
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
}

export interface SeminarEntity extends BaseEntity {
  title: string;
  type: 'internal' | 'external';
  date: number;
  content: string;
  location: string;
  notified: boolean;
}

export interface AcademicYearEntity extends BaseEntity {
  year: string;
  isCurrent: boolean;
  isArchived: boolean;
  structureCopied: boolean;
}

export interface SchoolEntity extends BaseEntity {
  name: string;
  nameEn: string;
  address: string;
}

export type StudentLevelKey = 'first' | 'second' | 'third' | 'fourth';

export interface StudentClassEntity extends BaseEntity {
  level: StudentLevelKey;
  name: string;
  nameEn: string;
  nameFr: string;
  order: number;
}

export interface StudentListFileEntity extends BaseEntity {
  classId: string;
  term: 1 | 2 | 3;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  order: number;
}

export interface HomeCardState {
  sectionKey: string;
  pinned: boolean;
  hidden: boolean;
  order: number;
}

export interface SettingsEntity {
  id: string;
  theme: 'light' | 'dark';
  language: 'ar' | 'en' | 'fr';
  lastBackupReminder: number;
  fontSize: 'small' | 'medium' | 'large';
  paletteId: string;
  customColor: string | null;
  homeCards: HomeCardState[];
}

export interface ActivityLogEntity extends BaseEntity {
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
}
