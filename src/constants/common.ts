import { colors } from '@/lib/design/theme';

export const LEVELS = [
    { id: 'A1-A2', label: 'Начальный', color: colors.cefr.A1 },
    { id: 'B1-B2', label: 'Средний', color: colors.cefr.B1 },
    { id: 'C1-C2', label: 'Продвинутый', color: colors.cefr.C1 },
] as const;

export type LevelId = typeof LEVELS[number]['id'];
