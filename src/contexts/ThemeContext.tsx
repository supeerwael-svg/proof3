import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { SettingsService } from '@/services';
import { PALETTES, applyShades, getPaletteById, deriveShades, type ColorShades } from '@/config/palettes';
import type { SettingsEntity, HomeCardState } from '@/types';

type Theme = 'light' | 'dark';
type FontSize = 'small' | 'medium' | 'large';

interface ThemeContextType {
  theme: Theme;
  fontSize: FontSize;
  paletteId: string;
  customColor: string | null;
  homeCards: HomeCardState[];
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  setFontSize: (s: FontSize) => void;
  setPalette: (id: string) => void;
  setCustomColor: (hex: string) => void;
  setHomeCards: (cards: HomeCardState[]) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [fontSize, setFontSizeState] = useState<FontSize>('medium');
  const [paletteId, setPaletteId] = useState<string>('blue');
  const [customColor, setCustomColorState] = useState<string | null>(null);
  const [homeCards, setHomeCardsState] = useState<HomeCardState[]>([]);

  useEffect(() => {
    SettingsService.get().then(s => {
      if (s) {
        setThemeState(s.theme);
        setFontSizeState(s.fontSize);
        setPaletteId(s.paletteId ?? 'blue');
        setCustomColorState(s.customColor ?? null);
        if (s.homeCards) setHomeCardsState(s.homeCards);
      }
    });
  }, []);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = fontSize === 'small' ? '14px' : fontSize === 'large' ? '18px' : '16px';
  }, [fontSize]);

  useEffect(() => {
    let shades: ColorShades;
    if (customColor) {
      shades = deriveShades(customColor);
    } else {
      const p = getPaletteById(paletteId);
      shades = p ? p.shades : PALETTES[0].shades;
    }
    applyShades(shades);
  }, [paletteId, customColor]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    SettingsService.update({ theme: t });
  };
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
  const setFontSize = (s: FontSize) => {
    setFontSizeState(s);
    SettingsService.update({ fontSize: s });
  };
  const setPalette = (id: string) => {
    setPaletteId(id);
    setCustomColorState(null);
    SettingsService.update({ paletteId: id, customColor: null });
  };
  const setCustomColor = (hex: string) => {
    setCustomColorState(hex);
    setPaletteId('custom');
    SettingsService.update({ customColor: hex, paletteId: 'custom' });
  };
  const setHomeCards = (cards: HomeCardState[]) => {
    setHomeCardsState(cards);
    SettingsService.update({ homeCards: cards });
  };

  return (
    <ThemeContext.Provider value={{ theme, fontSize, paletteId, customColor, homeCards, toggleTheme, setTheme, setFontSize, setPalette, setCustomColor, setHomeCards }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
