import Dexie, { type Table } from 'dexie';
import type {
  UserEntity, InviteCodeEntity, SectionEntity, FolderEntity, FileEntity,
  AnnouncementEntity, ForumTopicEntity, ForumReplyEntity, ChatRoomEntity,
  ChatMessageEntity, SeminarEntity, AcademicYearEntity, SchoolEntity,
  SettingsEntity, ActivityLogEntity,
  StudentClassEntity, StudentListFileEntity,
} from '@/types';

export class AppDatabase extends Dexie {
  users!: Table<UserEntity, string>;
  inviteCodes!: Table<InviteCodeEntity, string>;
  sections!: Table<SectionEntity, string>;
  folders!: Table<FolderEntity, string>;
  files!: Table<FileEntity, string>;
  announcements!: Table<AnnouncementEntity, string>;
  forumTopics!: Table<ForumTopicEntity, string>;
  forumReplies!: Table<ForumReplyEntity, string>;
  chatRooms!: Table<ChatRoomEntity, string>;
  chatMessages!: Table<ChatMessageEntity, string>;
  seminars!: Table<SeminarEntity, string>;
  academicYears!: Table<AcademicYearEntity, string>;
  schools!: Table<SchoolEntity, string>;
  settings!: Table<SettingsEntity, string>;
  activityLogs!: Table<ActivityLogEntity, string>;
  studentClasses!: Table<StudentClassEntity, string>;
  studentListFiles!: Table<StudentListFileEntity, string>;

  constructor() {
    super('teacher_portfolio_db');
    this.version(1).stores({
      users: 'id, username, role, deletedAt, syncStatus, ownerId, schoolId, academicYearId',
      inviteCodes: 'id, code, createdBy, deletedAt',
      sections: 'id, key, order, deletedAt, schoolId, academicYearId',
      folders: 'id, key, sectionKey, parentFolderId, order, deletedAt, schoolId, academicYearId',
      files: 'id, folderId, sectionKey, name, favorite, lastOpened, deletedAt, schoolId, academicYearId, order, *tags',
      announcements: 'id, pinned, deletedAt, createdAt, schoolId, academicYearId',
      forumTopics: 'id, deletedAt, createdAt, schoolId, academicYearId',
      forumReplies: 'id, topicId, deletedAt, schoolId, academicYearId',
      chatRooms: 'id, type, deletedAt, schoolId, academicYearId',
      chatMessages: 'id, roomId, deletedAt, createdAt, schoolId, academicYearId',
      seminars: 'id, type, date, deletedAt, schoolId, academicYearId',
      academicYears: 'id, year, isCurrent, isArchived, schoolId',
      schools: 'id, deletedAt',
      settings: 'id',
      activityLogs: 'id, userId, deletedAt, createdAt, schoolId, academicYearId',
    });
    this.version(2).stores({
      studentClasses: 'id, level, order, deletedAt, schoolId, academicYearId',
      studentListFiles: 'id, classId, term, deletedAt, schoolId, academicYearId',
    });
  }
}

export const db = new AppDatabase();
