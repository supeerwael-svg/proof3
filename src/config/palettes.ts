export interface ColorShades {
  50: string; 100: string; 200: string; 300: string; 400: string;
  500: string; 600: string; 700: string; 800: string; 900: string;
}

export interface Palette {
  id: string;
  name: string;
  nameEn: string;
  nameFr: string;
  shades: ColorShades;
}

export const PALETTES: Palette[] = [
  {
    id: 'blue',
    name: 'أزرق',
    nameEn: 'Blue',
    nameFr: 'Bleu',
    shades: { 50:'#f0f9ff',100:'#e0f2fe',200:'#bae6fd',300:'#7dd3fc',400:'#38bdf8',500:'#0ea5e9',600:'#0284c7',700:'#0369a1',800:'#075985',900:'#0c4a6e' },
  },
  {
    id: 'green',
    name: 'أخضر',
    nameEn: 'Green',
    nameFr: 'Vert',
    shades: { 50:'#f0fdf4',100:'#dcfce7',200:'#bbf7d0',300:'#86efac',400:'#4ade80',500:'#22c55e',600:'#16a34a',700:'#15803d',800:'#166534',900:'#14532d' },
  },
  {
    id: 'teal',
    name: 'فيروزي',
    nameEn: 'Teal',
    nameFr: 'Sarcelle',
    shades: { 50:'#f0fdfa',100:'#ccfbf1',200:'#99f6e4',300:'#5eead4',400:'#2dd4bf',500:'#14b8a6',600:'#0d9488',700:'#0f766e',800:'#115e59',900:'#134e4a' },
  },
  {
    id: 'amber',
    name: 'برتقالي',
    nameEn: 'Amber',
    nameFr: 'Ambre',
    shades: { 50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309',800:'#92400e',900:'#78350f' },
  },
  {
    id: 'rose',
    name: 'أحمر',
    nameEn: 'Rose',
    nameFr: 'Rose',
    shades: { 50:'#fff1f2',100:'#ffe4e6',200:'#fecdd3',300:'#fda4af',400:'#fb7185',500:'#f43f5e',600:'#e11d48',700:'#be123c',800:'#9f1239',900:'#881337' },
  },
  {
    id: 'brown',
    name: 'بني',
    nameEn: 'Brown',
    nameFr: 'Marron',
    shades: { 50:'#fdf8f3',100:'#f5e9d9',200:'#e9d3bc',300:'#dab693',400:'#c89770',500:'#b87b54',600:'#a06543',700:'#7d4f37',800:'#5f3d2e',900:'#4a3024' },
  },
  {
    id: 'slate',
    name: 'رمادي مزرق',
    nameEn: 'Slate',
    nameFr: 'Ardoise',
    shades: { 50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155',800:'#1e293b',900:'#0f172a' },
  },
  {
    id: 'indigo',
    name: 'بنفسجي',
    nameEn: 'Indigo',
    nameFr: 'Indigo',
    shades: { 50:'#eef2ff',100:'#e0e7ff',200:'#c7d2fe',300:'#a5b4fc',400:'#818cf8',500:'#6366f1',600:'#4f46e5',700:'#4338ca',800:'#3730a3',900:'#312e81' },
  },
];

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return [14, 165, 233];
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.round(Math.max(0, Math.min(255, v)));
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

function mix(rgb: [number, number, number], weight: number, target: [number, number, number] = [255, 255, 255]): [number, number, number] {
  return [
    rgb[0] + (target[0] - rgb[0]) * weight,
    rgb[1] + (target[1] - rgb[1]) * weight,
    rgb[2] + (target[2] - rgb[2]) * weight,
  ];
}

export function deriveShades(baseHex: string): ColorShades {
  const rgb = hexToRgb(baseHex);
  return {
    50:  rgbToHex(...mix(rgb, 0.95)),
    100: rgbToHex(...mix(rgb, 0.9)),
    200: rgbToHex(...mix(rgb, 0.75)),
    300: rgbToHex(...mix(rgb, 0.55)),
    400: rgbToHex(...mix(rgb, 0.3)),
    500: rgbToHex(...rgb),
    600: rgbToHex(...mix(rgb, 0.2, [0, 0, 0])),
    700: rgbToHex(...mix(rgb, 0.4, [0, 0, 0])),
    800: rgbToHex(...mix(rgb, 0.6, [0, 0, 0])),
    900: rgbToHex(...mix(rgb, 0.75, [0, 0, 0])),
  };
}

export function applyShades(shades: ColorShades) {
  const root = document.documentElement;
  (Object.keys(shades) as unknown as (keyof ColorShades)[]).forEach(key => {
    root.style.setProperty(`--c-primary-${key}`, shades[key]);
  });
  root.style.setProperty('--c-primary', shades[500]);
  root.style.setProperty('--c-primary-dark', shades[700]);
}

export function getPaletteById(id: string): Palette | undefined {
  return PALETTES.find(p => p.id === id);
}

export function getPaletteName(palette: Palette, lang: 'ar' | 'en' | 'fr'): string {
  return lang === 'ar' ? palette.name : lang === 'fr' ? palette.nameFr : palette.nameEn;
}

export const SECTION_COLORS: string[] = [
  '#0ea5e9', '#22c55e', '#14b8a6', '#f59e0b',
  '#f43f5e', '#8b5cf6', '#ec4899', '#64748b',
  '#b87b54', '#0891b2', '#65a30d', '#c2410c',
];
