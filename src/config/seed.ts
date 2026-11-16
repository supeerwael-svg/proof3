import { db } from '@/db/database';
import { SECTIONS, type SectionDef, type FolderDef } from './structure';
import type {
  SectionEntity, FolderEntity, UserEntity, AcademicYearEntity,
  SchoolEntity, SettingsEntity,
} from '@/types';

const DEFAULT_SCHOOL_ID = 'school-001';
const DEFAULT_YEAR_ID = 'year-default-001';
const DEFAULT_YEAR_KEY = '2026-2027';
const uuid = () => crypto.randomUUID();
const now = () => Date.now();

function baseEntity(overrides: Partial<{ ownerId: string; schoolId: string; academicYearId: string }>) {
  return {
    id: uuid(),
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
    syncStatus: 'local' as const,
    ownerId: overrides.ownerId ?? 'system',
    schoolId: overrides.schoolId ?? DEFAULT_SCHOOL_ID,
    academicYearId: overrides.academicYearId ?? DEFAULT_YEAR_ID,
  };
}

async function seedSectionsAndFolders(yearId: string) {
  const existingSections = await db.sections.where('academicYearId').equals(yearId).count();
  if (existingSections > 0) return;

  // Clear any stale sections/folders from a previous ID scheme
  await db.sections.clear();
  await db.folders.clear();

  const sectionEntities: SectionEntity[] = [];
  const folderEntities: FolderEntity[] = [];

  function walkFolders(sectionKey: string, folders: FolderDef[], parentId: string | null) {
    folders.forEach((f, i) => {
      const folderId = uuid();
      folderEntities.push({
        ...baseEntity({ academicYearId: yearId }),
        key: f.key,
        sectionKey,
        parentFolderId: parentId,
        name: f.name,
        nameEn: f.nameEn,
        nameFr: f.nameFr,
        order: i,
      });
      if (f.folders) walkFolders(sectionKey, f.folders, folderId);
    });
  }

  SECTIONS.forEach((s: SectionDef, i) => {
    const sectionId = uuid();
    sectionEntities.push({
      ...baseEntity({ academicYearId: yearId }),
      key: s.key,
      name: s.name,
      nameEn: s.nameEn,
      nameFr: s.nameFr,
      icon: s.icon,
      order: i,
    });
    walkFolders(s.key, s.folders, null);
  });

  await db.sections.bulkAdd(sectionEntities);
  await db.folders.bulkAdd(folderEntities);
}

async function seedSchool() {
  const existing = await db.schools.count();
  if (existing > 0) return;
  const school: SchoolEntity = {
    ...baseEntity({}),
    name: 'متوسطة',
    nameEn: 'Middle School',
    address: '',
  };
  await db.schools.add(school);
}

async function seedAcademicYear() {
  const existing = await db.academicYears.where('year').equals(DEFAULT_YEAR_KEY).count();
  if (existing > 0) return;
  const year: AcademicYearEntity = {
    ...baseEntity({}),
    id: DEFAULT_YEAR_ID,
    year: DEFAULT_YEAR_KEY,
    isCurrent: true,
    isArchived: false,
    structureCopied: true,
  };
  await db.academicYears.add(year);
}

async function seedDefaultAdmin() {
  const existing = await db.users.where('username').equals('admin').count();
  if (existing > 0) return;

  const salt = crypto.randomUUID();
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode('admin'), 'PBKDF2', false, ['deriveBits']);
  const hashBuf = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  const admin: UserEntity = {
    ...baseEntity({ ownerId: 'system' }),
    username: 'admin',
    displayName: 'المسؤول الأول',
    passwordHash: hash,
    passwordSalt: salt,
    role: 'super_admin',
    permissions: [],
    avatarColor: '#0ea5e9',
    lastSeen: now(),
    isOnline: false,
  };
  await db.users.add(admin);
}

async function seedSettings() {
  const existing = await db.settings.count();
  if (existing > 0) return;
  const settings: SettingsEntity = {
    id: 'app-settings',
    theme: 'light',
    language: 'ar',
    lastBackupReminder: now(),
    fontSize: 'medium',
    paletteId: 'blue',
    customColor: null,
    homeCards: [],
  };
  await db.settings.add(settings);
}

export async function seedDatabase() {
  await seedSchool();
  await seedAcademicYear();
  await seedDefaultAdmin();
  await seedSettings();
  await seedSectionsAndFolders(DEFAULT_YEAR_ID);
}

export { DEFAULT_SCHOOL_ID, DEFAULT_YEAR_ID, DEFAULT_YEAR_KEY };
export const uuidGen = uuid;
export const nowGen = now;
