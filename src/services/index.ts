// Repository pattern — components never touch Dexie directly.
// Swapping to RemoteAdapter (Supabase/Firebase) means implementing this interface.

import { db } from '@/db/database';
import { uuidGen, nowGen } from '@/config/seed';
import type {
  BaseEntity, UserEntity, FileEntity, FolderEntity, SectionEntity,
  AnnouncementEntity, ForumTopicEntity, ForumReplyEntity, ChatRoomEntity,
  ChatMessageEntity, SeminarEntity, AcademicYearEntity, SchoolEntity,
  SettingsEntity, ActivityLogEntity, UserRole, Permission, InviteCodeEntity,
} from '@/types';

const DEFAULT_SCHOOL_ID = 'school-001';
const DEFAULT_YEAR_ID = 'year-default-001';

function withBase<T extends BaseEntity>(data: Omit<T, keyof BaseEntity> & Partial<BaseEntity>, ownerId: string): T {
  return {
    id: data.id ?? uuidGen(),
    createdAt: data.createdAt ?? nowGen(),
    updatedAt: nowGen(),
    deletedAt: null,
    syncStatus: 'local' as const,
    ownerId,
    schoolId: DEFAULT_SCHOOL_ID,
    academicYearId: data.academicYearId ?? DEFAULT_YEAR_ID,
    ...data,
  } as T;
}

// ---- Auth Service ----
export const AuthService = {
  async hashPassword(password: string, salt: string): Promise<string> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const hashBuf = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  async login(username: string, password: string): Promise<UserEntity | null> {
    const user = await db.users.where('username').equals(username).and(u => u.deletedAt === null).first();
    if (!user) return null;
    if (user.role === 'banned') throw new Error('تم حظرك. يرجى الاتصال بالمسؤول');
    const hash = await this.hashPassword(password, user.passwordSalt);
    if (hash !== user.passwordHash) return null;
    await db.users.update(user.id, { lastSeen: nowGen(), isOnline: true, updatedAt: nowGen() });
    return { ...user, lastSeen: nowGen(), isOnline: true };
  },

  async logout(userId: string): Promise<void> {
    await db.users.update(userId, { isOnline: false, updatedAt: nowGen() });
  },

  async createUser(username: string, displayName: string, password: string, role: UserRole, permissions: Permission[], ownerId: string): Promise<UserEntity> {
    const salt = crypto.randomUUID();
    const hash = await this.hashPassword(password, salt);
    const user = withBase<UserEntity>({
      username, displayName, passwordHash: hash, passwordSalt: salt,
      role, permissions, avatarColor: ['#0ea5e9', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'][Math.floor(Math.random() * 5)],
      lastSeen: 0, isOnline: false,
    }, ownerId);
    await db.users.add(user);
    return user;
  },

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const salt = crypto.randomUUID();
    const hash = await this.hashPassword(newPassword, salt);
    await db.users.update(userId, { passwordHash: hash, passwordSalt: salt, updatedAt: nowGen() });
  },

  async banUser(userId: string): Promise<void> {
    await db.users.update(userId, { role: 'banned' as UserRole, updatedAt: nowGen() });
  },

  async unbanUser(userId: string, restoreRole?: UserRole): Promise<void> {
    await db.users.update(userId, { role: (restoreRole ?? 'teacher_read') as UserRole, updatedAt: nowGen() });
  },

  async getAllUsers(): Promise<UserEntity[]> {
    const all = await db.users.toArray();
    return all.filter(u => u.deletedAt === null);
  },

  async getOnlineCount(): Promise<number> {
    return db.users.filter(u => u.isOnline && u.deletedAt === null).count();
  },

  async getUserById(id: string): Promise<UserEntity | undefined> {
    return db.users.get(id);
  },

  async registerWithInvite(code: string, username: string, displayName: string, password: string): Promise<UserEntity> {
    const invite = await InviteCodesService.consume(code);
    if (!invite) throw new Error('invalid_code');
    const existing = await db.users.where('username').equals(username).first();
    if (existing) throw new Error('username_taken');
    const salt = crypto.randomUUID();
    const hash = await this.hashPassword(password, salt);
    const user = withBase<UserEntity>({
      username,
      displayName,
      passwordHash: hash,
      passwordSalt: salt,
      role: invite.role,
      permissions: [],
      avatarColor: ['#0ea5e9', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'][Math.floor(Math.random() * 6)],
      lastSeen: 0,
      isOnline: false,
    }, invite.createdBy);
    await db.users.add(user);
    return user;
  },

  async updatePermissions(userId: string, permissions: Permission[]): Promise<void> {
    await db.users.update(userId, { permissions, updatedAt: nowGen() });
  },

  async updateRole(userId: string, role: UserRole): Promise<void> {
    await db.users.update(userId, { role, updatedAt: nowGen() });
  },
};

// ---- Files Service ----
export const FilesService = {
  async getFilesByFolder(folderId: string): Promise<FileEntity[]> {
    return db.files
      .where('folderId').equals(folderId)
      .and(f => f.deletedAt === null)
      .sortBy('order');
  },

  async getFilesBySection(sectionKey: string): Promise<FileEntity[]> {
    return db.files
      .where('sectionKey').equals(sectionKey)
      .and(f => f.deletedAt === null)
      .toArray();
  },

  async uploadFile(folderId: string, sectionKey: string, file: File, tags: string[], ownerId: string, order?: number): Promise<FileEntity> {
    const existing = await db.files.where('folderId').equals(folderId).and(f => f.deletedAt === null).count();
    let blob: Blob = file;
    // Compress images on upload
    if (file.type.startsWith('image/') && file.size > 500 * 1024) {
      blob = await this.compressImage(file);
    }
    const entity = withBase<FileEntity>({
      folderId, sectionKey,
      name: file.name,
      type: file.type.split('/')[1] || 'file',
      mimeType: file.type,
      size: blob.size,
      blob,
      tags,
      favorite: false,
      lastOpened: null,
      order: order ?? existing,
      linkedFileId: null,
    }, ownerId);
    await db.files.add(entity);
    return entity;
  },

  async compressImage(file: File, maxDim = 1920, quality = 0.8): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(b => resolve(b || file), 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  },

  async deleteFile(id: string): Promise<void> {
    await db.files.update(id, { deletedAt: nowGen(), updatedAt: nowGen() });
  },

  async toggleFavorite(id: string): Promise<void> {
    const file = await db.files.get(id);
    if (file) await db.files.update(id, { favorite: !file.favorite, updatedAt: nowGen() });
  },

  async markOpened(id: string): Promise<void> {
    await db.files.update(id, { lastOpened: nowGen() });
  },

  async renameFile(id: string, name: string): Promise<void> {
    await db.files.update(id, { name, updatedAt: nowGen() });
  },

  async updateTags(id: string, tags: string[]): Promise<void> {
    await db.files.update(id, { tags, updatedAt: nowGen() });
  },

  async linkFiles(fileId: string, linkedId: string): Promise<void> {
    await db.files.update(fileId, { linkedFileId: linkedId, updatedAt: nowGen() });
    await db.files.update(linkedId, { linkedFileId: fileId, updatedAt: nowGen() });
  },

  async getLinkedFile(fileId: string): Promise<FileEntity | null> {
    const file = await db.files.get(fileId);
    if (!file?.linkedFileId) return null;
    return (await db.files.get(file.linkedFileId)) ?? null;
  },

  async getFavorites(): Promise<FileEntity[]> {
    const all = await db.files.toArray();
    return all.filter(f => f.favorite && f.deletedAt === null);
  },

  async getRecent(limit = 10): Promise<FileEntity[]> {
    const all = await db.files.where('lastOpened').notEqual(0).and(f => f.deletedAt === null && f.lastOpened !== null).toArray();
    return all.sort((a, b) => (b.lastOpened ?? 0) - (a.lastOpened ?? 0)).slice(0, limit);
  },

  async search(query: string): Promise<FileEntity[]> {
    const normalized = query.replace(/[\u064B-\u0652]/g, '').toLowerCase();
    const all = await db.files.toArray();
    return all.filter(f => f.deletedAt === null && (() => {
      const name = f.name.replace(/[\u064B-\u0652]/g, '').toLowerCase();
      const tags = f.tags.map(t => t.replace(/[\u064B-\u0652]/g, '').toLowerCase());
      return name.includes(normalized) || tags.some(t => t.includes(normalized));
    })());
  },

  async getFolderStats(folderId: string): Promise<{ count: number; size: number }> {
    const files = await db.files.where('folderId').equals(folderId).and(f => f.deletedAt === null).toArray();
    return { count: files.length, size: files.reduce((s, f) => s + f.size, 0) };
  },

  async getSectionStats(sectionKey: string): Promise<{ count: number; size: number }> {
    const files = await db.files.where('sectionKey').equals(sectionKey).and(f => f.deletedAt === null).toArray();
    return { count: files.length, size: files.reduce((s, f) => s + f.size, 0) };
  },

  async searchAll(query: string): Promise<FileEntity[]> {
    const normalized = query.replace(/[\u064B-\u0652]/g, '').toLowerCase().trim();
    if (!normalized) return [];
    const all = await db.files.toArray();
    return all.filter(f => f.deletedAt === null && (() => {
      const name = f.name.replace(/[\u064B-\u0652]/g, '').toLowerCase();
      const tags = f.tags.map(tg => tg.replace(/[\u064B-\u0652]/g, '').toLowerCase());
      return name.includes(normalized) || tags.some(tg => tg.includes(normalized));
    })());
  },

  async moveFile(id: string, targetFolderId: string, targetSectionKey: string): Promise<void> {
    await db.files.update(id, { folderId: targetFolderId, sectionKey: targetSectionKey, updatedAt: nowGen() });
  },
};

// ---- Folders Service ----
export const FoldersService = {
  async getBySection(sectionKey: string): Promise<FolderEntity[]> {
    return db.folders.where('sectionKey').equals(sectionKey).and(f => f.deletedAt === null).sortBy('order');
  },
  async getByParent(parentId: string | null): Promise<FolderEntity[]> {
    if (parentId === null) {
      return db.folders.where('parentFolderId').equals(null as any).and(f => f.deletedAt === null).sortBy('order');
    }
    return db.folders.where('parentFolderId').equals(parentId).and(f => f.deletedAt === null).sortBy('order');
  },
  async getRootBySection(sectionKey: string): Promise<FolderEntity[]> {
    const all = await this.getBySection(sectionKey);
    return all.filter(f => f.parentFolderId === null);
  },
  async getById(id: string): Promise<FolderEntity | undefined> {
    return db.folders.get(id);
  },
  async create(sectionKey: string, parentId: string | null, name: string, ownerId: string): Promise<FolderEntity> {
    const siblings = await this.getByParent(parentId);
    const folder = withBase<FolderEntity>({
      key: uuidGen(), sectionKey, parentFolderId: parentId,
      name, nameEn: name, nameFr: name, order: siblings.length,
    }, ownerId);
    await db.folders.add(folder);
    return folder;
  },
  async rename(id: string, name: string): Promise<void> {
    await db.folders.update(id, { name, nameEn: name, nameFr: name, updatedAt: nowGen() });
  },
  async delete(id: string): Promise<void> {
    await db.folders.update(id, { deletedAt: nowGen(), updatedAt: nowGen() });
    const children = await this.getByParent(id);
    for (const child of children) await this.delete(child.id);
  },
  async getFolderTree(sectionKey: string): Promise<{ folder: FolderEntity; depth: number }[]> {
    const all = await this.getBySection(sectionKey);
    const result: { folder: FolderEntity; depth: number }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      all.filter(f => f.parentFolderId === parentId).forEach(f => {
        result.push({ folder: f, depth });
        walk(f.id, depth + 1);
      });
    };
    walk(null, 0);
    return result;
  },
};

// ---- Sections Service ----
export const SectionsService = {
  async getAll(): Promise<SectionEntity[]> {
    const all = await db.sections.toArray();
    const active = all.filter(s => s.deletedAt === null);
    const byKey = new Map<string, SectionEntity>();
    for (const s of active.sort((a, b) => a.order - b.order)) {
      if (!byKey.has(s.key)) byKey.set(s.key, s);
    }
    return Array.from(byKey.values()).sort((a, b) => a.order - b.order);
  },
  async getByKey(key: string): Promise<SectionEntity | undefined> {
    const matches = await db.sections.where('key').equals(key).and(s => s.deletedAt === null).toArray();
    return matches[0];
  },
  async create(key: string, name: string, nameEn: string, nameFr: string, icon: string, ownerId: string): Promise<SectionEntity> {
    const all = await this.getAll();
    const section = withBase<SectionEntity>({
      key, name, nameEn, nameFr, icon, order: all.length,
    }, ownerId);
    await db.sections.add(section);
    return section;
  },
  async rename(id: string, name: string, nameEn?: string, nameFr?: string): Promise<void> {
    const patch: Record<string, unknown> = { name, updatedAt: nowGen() };
    if (nameEn) patch.nameEn = nameEn;
    if (nameFr) patch.nameFr = nameFr;
    await db.sections.update(id, patch);
  },
  async updateAppearance(id: string, icon?: string, color?: string): Promise<void> {
    const patch: Record<string, unknown> = { updatedAt: nowGen() };
    if (icon !== undefined) patch.icon = icon;
    if (color !== undefined) patch.color = color;
    await db.sections.update(id, patch);
  },
  async delete(id: string): Promise<void> {
    const section = await db.sections.get(id);
    if (!section) return;
    await db.sections.update(id, { deletedAt: nowGen(), updatedAt: nowGen() });
    const folders = await db.folders.where('sectionKey').equals(section.key).and(f => f.deletedAt === null).toArray();
    for (const f of folders) await FoldersService.delete(f.id);
  },
};

// ---- Announcements ----
export const AnnouncementsService = {
  async getAll(): Promise<AnnouncementEntity[]> {
    const all = await db.announcements.toArray();
    return all.filter(a => a.deletedAt === null).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt);
  },
  async create(title: string, content: string, ownerId: string): Promise<AnnouncementEntity> {
    const ann = withBase<AnnouncementEntity>({ title, content, pinned: false }, ownerId);
    await db.announcements.add(ann);
    return ann;
  },
  async delete(id: string): Promise<void> {
    await db.announcements.update(id, { deletedAt: nowGen() });
  },
  async togglePin(id: string): Promise<void> {
    const ann = await db.announcements.get(id);
    if (ann) await db.announcements.update(id, { pinned: !ann.pinned });
  },
};

// ---- Forum ----
export const ForumService = {
  async getTopics(): Promise<ForumTopicEntity[]> {
    const all = await db.forumTopics.toArray();
    return all.filter(t => t.deletedAt === null).sort((a, b) => b.createdAt - a.createdAt);
  },
  async createTopic(title: string, content: string, tags: string[], authorName: string, ownerId: string): Promise<ForumTopicEntity> {
    const topic = withBase<ForumTopicEntity>({ title, content, tags, authorName, repliesCount: 0 }, ownerId);
    await db.forumTopics.add(topic);
    return topic;
  },
  async getReplies(topicId: string): Promise<ForumReplyEntity[]> {
    const all = await db.forumReplies.where('topicId').equals(topicId).and(r => r.deletedAt === null).toArray();
    return all.sort((a, b) => a.createdAt - b.createdAt);
  },
  async addReply(topicId: string, content: string, authorName: string, ownerId: string): Promise<ForumReplyEntity> {
    const reply = withBase<ForumReplyEntity>({ topicId, content, authorName }, ownerId);
    await db.forumReplies.add(reply);
    const topic = await db.forumTopics.get(topicId);
    if (topic) await db.forumTopics.update(topicId, { repliesCount: topic.repliesCount + 1 });
    return reply;
  },
  async deleteTopic(id: string): Promise<void> {
    await db.forumTopics.update(id, { deletedAt: nowGen() });
  },
};

// ---- Chat ----
export const ChatService = {
  async getRooms(): Promise<ChatRoomEntity[]> {
    const all = await db.chatRooms.toArray();
    return all.filter(r => r.deletedAt === null);
  },
  async createRoom(name: string, type: 'coordination' | 'direct', members: string[], ownerId: string): Promise<ChatRoomEntity> {
    const room = withBase<ChatRoomEntity>({ name, type, members }, ownerId);
    await db.chatRooms.add(room);
    return room;
  },
  async getMessages(roomId: string): Promise<ChatMessageEntity[]> {
    const all = await db.chatMessages.where('roomId').equals(roomId).and(m => m.deletedAt === null).toArray();
    return all.sort((a, b) => a.createdAt - b.createdAt);
  },
  async sendMessage(roomId: string, senderId: string, senderName: string, text: string, ownerId: string): Promise<ChatMessageEntity> {
    const msg = withBase<ChatMessageEntity>({ roomId, senderId, senderName, text }, ownerId);
    await db.chatMessages.add(msg);
    // Simulate a local bot reply for demo
    setTimeout(() => {
      const botMsg = withBase<ChatMessageEntity>({
        roomId, senderId: 'bot', senderName: 'أستاذ (محاكاة)',
        text: 'تم استلام رسالتك. هذه محاكاة محلية للدردشة.',
      }, 'system');
      db.chatMessages.add(botMsg);
    }, 1500);
    return msg;
  },
};

// ---- Seminars ----
export const SeminarsService = {
  async getAll(): Promise<SeminarEntity[]> {
    const all = await db.seminars.toArray();
    return all.filter(s => s.deletedAt === null).sort((a, b) => a.date - b.date);
  },
  async create(title: string, type: 'internal' | 'external', date: number, content: string, location: string, ownerId: string): Promise<SeminarEntity> {
    const sem = withBase<SeminarEntity>({ title, type, date, content, location, notified: false }, ownerId);
    await db.seminars.add(sem);
    return sem;
  },
  async delete(id: string): Promise<void> {
    await db.seminars.update(id, { deletedAt: nowGen() });
  },
  async getUpcoming(limit = 5): Promise<SeminarEntity[]> {
    const all = await this.getAll();
    const now = nowGen();
    return all.filter(s => s.date >= now).slice(0, limit);
  },
};

// ---- Academic Years ----
export const AcademicYearsService = {
  async getAll(): Promise<AcademicYearEntity[]> {
    return db.academicYears.toArray();
  },
  async getCurrent(): Promise<AcademicYearEntity | undefined> {
    const all = await db.academicYears.toArray();
    return all.find(y => y.isCurrent && y.deletedAt === null);
  },
  async getArchived(): Promise<AcademicYearEntity[]> {
    const all = await this.getAll();
    return all.filter(y => y.isArchived).sort((a, b) => b.year.localeCompare(a.year));
  },
  async create(year: string, ownerId: string): Promise<AcademicYearEntity> {
    const current = await this.getCurrent();
    if (current) await db.academicYears.update(current.id, { isCurrent: false, isArchived: true });
    const entity = withBase<AcademicYearEntity>({ year, isCurrent: true, isArchived: false, structureCopied: false }, ownerId);
    await db.academicYears.add(entity);
    return entity;
  },
  async createWithStructure(year: string, copyFiles: boolean, ownerId: string): Promise<AcademicYearEntity> {
    const oldCurrent = await this.getCurrent();
    const newYear = await this.create(year, ownerId);

    const allSections = await db.sections.toArray();
    const oldYearId = oldCurrent?.id;
    const currentSections = allSections
      .filter(s => s.deletedAt === null && (!oldYearId || s.academicYearId === oldYearId))
      .sort((a, b) => a.order - b.order);
    const allFolders = await db.folders.toArray();
    const currentFolders = allFolders
      .filter(f => f.deletedAt === null && (!oldYearId || f.academicYearId === oldYearId));

    const sectionIdMap = new Map<string, string>();
    const folderIdMap = new Map<string, string>();
    const newSections: SectionEntity[] = [];
    const newFolders: FolderEntity[] = [];

    for (const s of currentSections) {
      const newId = uuidGen();
      sectionIdMap.set(s.id, newId);
      newSections.push({
        ...s,
        id: newId,
        createdAt: nowGen(),
        updatedAt: nowGen(),
        academicYearId: newYear.id,
        syncStatus: 'local' as const,
      });
    }

    for (const f of currentFolders) {
      const newId = uuidGen();
      folderIdMap.set(f.id, newId);
    }

    for (const f of currentFolders) {
      newFolders.push({
        ...f,
        id: folderIdMap.get(f.id)!,
        parentFolderId: f.parentFolderId ? (folderIdMap.get(f.parentFolderId) ?? null) : null,
        createdAt: nowGen(),
        updatedAt: nowGen(),
        academicYearId: newYear.id,
        syncStatus: 'local' as const,
      });
    }

    await db.sections.bulkAdd(newSections);
    await db.folders.bulkAdd(newFolders);

    if (copyFiles) {
      const allFiles = await db.files.toArray();
      const currentFiles = allFiles.filter(f => f.deletedAt === null);
      const newFiles: FileEntity[] = [];
      for (const f of currentFiles) {
        const newFolderId = folderIdMap.get(f.folderId);
        if (!newFolderId) continue;
        newFiles.push({
          ...f,
          id: uuidGen(),
          folderId: newFolderId,
          createdAt: nowGen(),
          updatedAt: nowGen(),
          academicYearId: newYear.id,
          syncStatus: 'local' as const,
          lastOpened: null,
        });
      }
      if (newFiles.length > 0) await db.files.bulkAdd(newFiles);
    }

    await db.academicYears.update(newYear.id, { structureCopied: true });
    return newYear;
  },
  async switchTo(yearId: string): Promise<void> {
    const all = await this.getAll();
    for (const y of all) {
      await db.academicYears.update(y.id, { isCurrent: y.id === yearId, isArchived: y.id !== yearId ? y.isArchived : false });
    }
  },
};

// ---- Settings ----
export const SettingsService = {
  async get(): Promise<SettingsEntity | undefined> {
    return db.settings.get('app-settings');
  },
  async update(patch: Partial<SettingsEntity>): Promise<void> {
    await db.settings.update('app-settings', patch);
  },
};

// ---- Activity Log ----
export const ActivityLogService = {
  async log(userId: string, userName: string, action: string, entity: string, entityId: string): Promise<void> {
    const entry = withBase<ActivityLogEntity>({ userId, userName, action, entity, entityId }, userId);
    await db.activityLogs.add(entry);
  },
  async getRecent(limit = 20): Promise<ActivityLogEntity[]> {
    const all = await db.activityLogs.toArray();
    return all.filter(a => a.deletedAt === null).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  },
};

// ---- Storage ----
export const StorageService = {
  async requestPersistent(): Promise<boolean> {
    if (navigator.storage?.persist) return navigator.storage.persist();
    return false;
  },
  async getUsage(): Promise<{ usage: number; quota: number }> {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
    }
    return { usage: 0, quota: 0 };
  },
  async exportAll(): Promise<Blob> {
    const tables = ['users', 'inviteCodes', 'sections', 'folders', 'files', 'announcements',
      'forumTopics', 'forumReplies', 'chatRooms', 'chatMessages', 'seminars',
      'academicYears', 'schools', 'settings', 'activityLogs'];
    const data: Record<string, unknown[]> = {};
    for (const t of tables) {
      const records = await (db as any)[t].toArray();
      data[t] = await Promise.all(records.map(async (r: any) => {
        if (r.blob instanceof Blob) {
          const b64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(r.blob);
          });
          return { ...r, blob: b64, _isBlob: true };
        }
        return r;
      }));
    }
    return new Blob([JSON.stringify({ version: 1, exportedAt: nowGen(), data })], { type: 'application/json' });
  },
  async importAll(json: string): Promise<void> {
    const parsed = JSON.parse(json);
    const data = parsed.data;
    const tables = Object.keys(data);
    for (const t of tables) {
      await (db as any)[t].clear();
      const records = await Promise.all(data[t].map(async (r: any) => {
        if (r._isBlob && typeof r.blob === 'string') {
          const blob = await fetch(r.blob).then(res => res.blob());
          return { ...r, blob, _isBlob: undefined };
        }
        return r;
      }));
      await (db as any)[t].bulkAdd(records);
    }
  },
  async exportZip(): Promise<Blob> {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const tables = ['users', 'inviteCodes', 'sections', 'folders', 'files', 'announcements',
      'forumTopics', 'forumReplies', 'chatRooms', 'chatMessages', 'seminars',
      'academicYears', 'schools', 'settings', 'activityLogs'];
    const data: Record<string, unknown[]> = {};
    const filesFolder = zip.folder('files');
    for (const t of tables) {
      const records = await (db as any)[t].toArray();
      data[t] = await Promise.all(records.map(async (r: any) => {
        if (r.blob instanceof Blob) {
          const ext = r.name?.split('.').pop() || 'bin';
          const fileName = `${r.id}.${ext}`;
          if (filesFolder) filesFolder.file(fileName, r.blob);
          return { ...r, blob: undefined, _blobFile: fileName };
        }
        return r;
      }));
    }
    zip.file('database.json', JSON.stringify({ version: 2, exportedAt: nowGen(), data }));
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  },
  async importZip(blob: Blob): Promise<void> {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(blob);
    const dbFile = zip.file('database.json');
    if (!dbFile) throw new Error('Invalid ZIP: no database.json');
    const json = await dbFile.async('string');
    const parsed = JSON.parse(json);
    const data = parsed.data;
    const tables = Object.keys(data);
    for (const t of tables) {
      await (db as any)[t].clear();
      const records = await Promise.all(data[t].map(async (r: any) => {
        if (r._blobFile) {
          const fileEntry = zip.file(`files/${r._blobFile}`);
          if (fileEntry) {
            const fileBlob = await fileEntry.async('blob');
            return { ...r, blob: fileBlob, _blobFile: undefined };
          }
        }
        return r;
      }));
      await (db as any)[t].bulkAdd(records);
    }
  },
};

// ---- School ----
export const SchoolService = {
  async get(): Promise<SchoolEntity | undefined> {
    const all = await db.schools.toArray();
    return all.find(s => s.deletedAt === null);
  },
  async update(id: string, patch: Partial<SchoolEntity>): Promise<void> {
    await db.schools.update(id, { ...patch, updatedAt: nowGen() });
  },
};

// ---- Invite Codes ----
export const InviteCodesService = {
  async getAll(): Promise<InviteCodeEntity[]> {
    const all = await db.inviteCodes.toArray();
    return all.filter(i => i.deletedAt === null).sort((a, b) => b.createdAt - a.createdAt);
  },
  async create(role: UserRole, maxUses: number, validDays: number, ownerId: string): Promise<InviteCodeEntity> {
    const code = Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    const entity = withBase<InviteCodeEntity>({
      code,
      createdBy: ownerId,
      maxUses,
      usedCount: 0,
      expiresAt: nowGen() + validDays * 86400000,
      role,
    }, ownerId);
    await db.inviteCodes.add(entity);
    return entity;
  },
  async validate(code: string): Promise<InviteCodeEntity | null> {
    const invite = await db.inviteCodes.where('code').equals(code.toUpperCase()).and(c => c.deletedAt === null).first();
    if (!invite) return null;
    if (invite.usedCount >= invite.maxUses) return null;
    if (invite.expiresAt < nowGen()) return null;
    return invite;
  },
  async consume(code: string): Promise<InviteCodeEntity | null> {
    const invite = await this.validate(code);
    if (!invite) return null;
    await db.inviteCodes.update(invite.id, { usedCount: invite.usedCount + 1, updatedAt: nowGen() });
    return { ...invite, usedCount: invite.usedCount + 1 };
  },
  async delete(id: string): Promise<void> {
    await db.inviteCodes.update(id, { deletedAt: nowGen() });
  },
};
