import structureData from './structure.json';

export interface FolderDef {
  key: string;
  name: string;
  nameEn: string;
  nameFr: string;
  folders?: FolderDef[];
  generate?: GenerateSpec;
}

export interface SectionDef {
  key: string;
  name: string;
  nameEn: string;
  nameFr: string;
  icon: string;
  order: number;
  folders: FolderDef[];
  generate?: GenerateSpec;
}

interface SubfolderName {
  ar: string;
  en: string;
  fr: string;
}

interface GenerateSpec {
  type: 'levels' | 'levels_subjects' | 'levels_subjects_chapters' | 'levels_classes_chapters' | 'levels_subfolders';
  subjects?: string[];
  suffix?: string;
  suffixEn?: string;
  suffixFr?: string;
  subfolders?: string[];
  subfolderNames?: SubfolderName[];
}

interface StructureConfig {
  levels: string[];
  levelNames: Record<string, { ar: string; en: string; fr: string }>;
  subjects: string[];
  subjectNames: Record<string, { ar: string; en: string; fr: string }>;
  chapters: string[];
  chapterNames: Record<string, { ar: string; en: string; fr: string }>;
  sections: SectionDef[];
}

const config = structureData as StructureConfig;

const combinedSubjects: Record<string, { ar: string; en: string; fr: string }> = {
  history_geo: { ar: 'تاريخ وجغرافيا', en: 'History & Geo', fr: 'Histoire-Géo' },
};

function subjectName(s: string): { ar: string; en: string; fr: string } {
  return config.subjectNames[s] ?? combinedSubjects[s] ?? { ar: s, en: s, fr: s };
}

function expandGenerate(spec: GenerateSpec, parentKey: string): FolderDef[] {
  const levels = config.levels;
  const levelNames = config.levelNames;
  const chapters = config.chapters;
  const chapterNames = config.chapterNames;

  if (spec.type === 'levels') {
    return levels.map(l => ({
      key: `${parentKey}_${l}`,
      name: levelNames[l].ar,
      nameEn: levelNames[l].en,
      nameFr: levelNames[l].fr,
    }));
  }

  if (spec.type === 'levels_subjects') {
    return levels.map(l => ({
      key: `${parentKey}_lvl_${l}`,
      name: levelNames[l].ar,
      nameEn: levelNames[l].en,
      nameFr: levelNames[l].fr,
      folders: (spec.subjects ?? []).map(s => {
        const n = subjectName(s);
        return {
          key: `${parentKey}_${s}_${l}`,
          name: n.ar,
          nameEn: n.en,
          nameFr: n.fr,
        };
      }),
    }));
  }

  if (spec.type === 'levels_subjects_chapters') {
    return levels.map(l => ({
      key: `${parentKey}_${l}`,
      name: levelNames[l].ar,
      nameEn: levelNames[l].en,
      nameFr: levelNames[l].fr,
      folders: (spec.subjects ?? []).map(s => {
        const n = subjectName(s);
        return {
          key: `${parentKey}_${s}_${l}`,
          name: n.ar,
          nameEn: n.en,
          nameFr: n.fr,
          folders: chapters.map(c => ({
            key: `${parentKey}_${s}_${c}_${l}`,
            name: `${chapterNames[c].ar}${spec.suffix ?? ''}`,
            nameEn: `${chapterNames[c].en}${spec.suffixEn ?? ''}`,
            nameFr: `${chapterNames[c].fr}${spec.suffixFr ?? ''}`,
          })),
        };
      }),
    }));
  }

  if (spec.type === 'levels_classes_chapters') {
    return levels.map(l => ({
      key: `${parentKey}_${l}`,
      name: levelNames[l].ar,
      nameEn: levelNames[l].en,
      nameFr: levelNames[l].fr,
      folders: [
        {
          key: `${parentKey}_${l}_cls_a`,
          name: 'القسم أ', nameEn: 'Class A', nameFr: 'Classe A',
          folders: chapters.map(c => ({
            key: `${parentKey}_${l}_a_${c}`,
            name: chapterNames[c].ar, nameEn: chapterNames[c].en, nameFr: chapterNames[c].fr,
          })),
        },
        {
          key: `${parentKey}_${l}_cls_b`,
          name: 'القسم ب', nameEn: 'Class B', nameFr: 'Classe B',
          folders: chapters.map(c => ({
            key: `${parentKey}_${l}_b_${c}`,
            name: chapterNames[c].ar, nameEn: chapterNames[c].en, nameFr: chapterNames[c].fr,
          })),
        },
      ],
    }));
  }

  if (spec.type === 'levels_subfolders') {
    const subKeys = spec.subfolders ?? [];
    const subNames = spec.subfolderNames ?? [];
    const subjects = spec.subjects ?? [];
    return levels.map(l => ({
      key: `${parentKey}_${l}`,
      name: levelNames[l].ar,
      nameEn: levelNames[l].en,
      nameFr: levelNames[l].fr,
      folders: subKeys.map((subKey, idx) => {
        const nm = subNames[idx] ?? { ar: subKey, en: subKey, fr: subKey };
        return {
          key: `${subKey}_${l}`,
          name: nm.ar,
          nameEn: nm.en,
          nameFr: nm.fr,
          folders: subjects.map(s => {
            const n = subjectName(s);
            return {
              key: `${subKey}_${s}_${l}`,
              name: n.ar,
              nameEn: n.en,
              nameFr: n.fr,
            };
          }),
        };
      }),
    }));
  }

  return [];
}

function resolveFolders(folders: FolderDef[] | undefined, parentKey: string): FolderDef[] {
  if (!folders || folders.length === 0) {
    return [];
  }
  return folders.map(f => {
    if (f.generate) {
      return {
        ...f,
        folders: expandGenerate(f.generate, f.key),
      };
    }
    return {
      ...f,
      folders: resolveFolders(f.folders, f.key),
    };
  });
}

export const SECTIONS: SectionDef[] = config.sections.map(s => {
  if (s.generate) {
    return { ...s, folders: expandGenerate(s.generate, s.key) };
  }
  return { ...s, folders: resolveFolders(s.folders, s.key) };
});

export { config as structureConfig };
