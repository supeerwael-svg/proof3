import { db } from '@/db/database';
import { uuidGen, nowGen } from '@/config/seed';
import type { BaseEntity, StudentClassEntity, StudentListFileEntity, StudentLevelKey } from '@/types';

export const STUDENT_LEVELS: StudentLevelKey[] = ['first', 'second', 'third', 'fourth'];

export const STUDENT_TERMS: { term: 1 | 2 | 3; key: string }[] = [
  { term: 1, key: 'term1' },
  { term: 2, key: 'term2' },
  { term: 3, key: 'term3' },
];

export const StudentListsService = {
  async getClasses(level: StudentLevelKey): Promise<StudentClassEntity[]> {
    return db.studentClasses
      .where('level').equals(level)
      .and(c => c.deletedAt === null)
      .sortBy('order');
  },

  async createClass(level: StudentLevelKey, name: string, nameEn: string, nameFr: string, ownerId: string): Promise<StudentClassEntity> {
    const siblings = await this.getClasses(level);
    const entity = withBase<StudentClassEntity>({
      level,
      name,
      nameEn,
      nameFr,
      order: siblings.length,
    }, ownerId);
    await db.studentClasses.add(entity);
    return entity;
  },

  async renameClass(id: string, name: string, nameEn: string, nameFr: string): Promise<void> {
    await db.studentClasses.update(id, { name, nameEn, nameFr, updatedAt: nowGen() });
  },

  async reorderClass(id: string, direction: -1 | 1): Promise<void> {
    const cls = await db.studentClasses.get(id);
    if (!cls) return;
    const siblings = await this.getClasses(cls.level);
    const idx = siblings.findIndex(c => c.id === id);
    const swapWith = siblings[idx + direction];
    if (!swapWith) return;
    await db.studentClasses.update(id, { order: swapWith.order, updatedAt: nowGen() });
    await db.studentClasses.update(swapWith.id, { order: cls.order, updatedAt: nowGen() });
  },

  async deleteClass(id: string): Promise<void> {
    await db.studentClasses.update(id, { deletedAt: nowGen(), updatedAt: nowGen() });
    const files = await db.studentListFiles.where('classId').equals(id).and(f => f.deletedAt === null).toArray();
    for (const f of files) {
      await db.studentListFiles.update(f.id, { deletedAt: nowGen(), updatedAt: nowGen() });
    }
  },

  async getFiles(classId: string, term: 1 | 2 | 3): Promise<StudentListFileEntity[]> {
    return db.studentListFiles
      .where('classId').equals(classId)
      .and(f => f.deletedAt === null && f.term === term)
      .sortBy('order');
  },

  async uploadFile(classId: string, term: 1 | 2 | 3, file: File, ownerId: string): Promise<void> {
    const existing = await this.getFiles(classId, term);
    const entity = withBase<StudentListFileEntity>({
      classId,
      term,
      name: file.name,
      mimeType: file.type || 'application/vnd.ms-excel',
      size: file.size,
      blob: file,
      order: existing.length,
    }, ownerId);
    await db.studentListFiles.add(entity);
  },

  async deleteFile(id: string): Promise<void> {
    await db.studentListFiles.update(id, { deletedAt: nowGen(), updatedAt: nowGen() });
  },

  async getFileStats(classId: string, term: 1 | 2 | 3): Promise<{ count: number; lastUpdate: number | null }> {
    const files = await this.getFiles(classId, term);
    if (files.length === 0) return { count: 0, lastUpdate: null };
    return { count: files.length, lastUpdate: Math.max(...files.map(f => f.updatedAt)) };
  },

  async copyTerm(fromTerm: 1 | 2 | 3, toTerm: 1 | 2 | 3, ownerId: string): Promise<number> {
    if (fromTerm === toTerm) return 0;
    const all = await db.studentListFiles
      .where('term').equals(fromTerm)
      .and(f => f.deletedAt === null)
      .toArray();
    let copied = 0;
    for (const src of all) {
      const existing = await db.studentListFiles
        .where('classId').equals(src.classId)
        .and(f => f.deletedAt === null && f.term === toTerm)
        .count();
      if (existing > 0) continue;
      const copy = withBase<StudentListFileEntity>({
        classId: src.classId,
        term: toTerm,
        name: src.name,
        mimeType: src.mimeType,
        size: src.size,
        blob: src.blob,
        order: src.order,
      }, ownerId);
      await db.studentListFiles.add(copy);
      copied++;
    }
    return copied;
  },
};

function withBase<T extends StudentClassEntity | StudentListFileEntity>(
  data: Omit<T, keyof BaseEntity>,
  ownerId: string
): T {
  return {
    id: uuidGen(),
    createdAt: nowGen(),
    updatedAt: nowGen(),
    deletedAt: null,
    syncStatus: 'local' as const,
    ownerId,
    schoolId: 'school-001',
    academicYearId: 'year-default-001',
    ...data,
  } as T;
}
