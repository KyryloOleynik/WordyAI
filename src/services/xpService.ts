// XP & Level System Service
// Duolingo-inspired gamification

export interface XPState {
    xp: number;
    level: number;
    streak: number;
    dailyGoal: number;
    dailyProgress: number;
    xpToNextLevel: number;
}

// XP required per level (Duolingo-style curve)
const XP_PER_LEVEL = [
    0,      // Level 1
    100,    // Level 2
    250,    // Level 3
    500,    // Level 4
    850,    // Level 5
    1300,   // Level 6
    1900,   // Level 7
    2700,   // Level 8
    3700,   // Level 9
    5000,   // Level 10
    6500,   // Level 11
    8300,   // Level 12
    10500,  // Level 13
    13200,  // Level 14
    16500,  // Level 15
    20500,  // Level 16
    25500,  // Level 17
    31500,  // Level 18
    38800,  // Level 19
    48000,  // Level 20
];

// XP rewards (reduced by 2x)
export const XP_REWARDS = {
    WORD_CORRECT: 5,
    WORD_CORRECT_STREAK: 8,
    WORD_EASY: 3,
    STORY_COMPLETE: 25,
    STORY_PERFECT: 50,
    TRANSLATION_CORRECT: 10,
    CHAT_MESSAGE: 3,
    DAILY_GOAL_COMPLETE: 15,
    STREAK_BONUS: 5,
};

export function calculateLevel(totalXP: number): number {
    for (let i = XP_PER_LEVEL.length - 1; i >= 0; i--) {
        if (totalXP >= XP_PER_LEVEL[i]) {
            return i + 1;
        }
    }
    return 1;
}

export function getXPToNextLevel(totalXP: number): number {
    const currentLevel = calculateLevel(totalXP);
    if (currentLevel >= XP_PER_LEVEL.length) {
        return 0; // Max level
    }
    return XP_PER_LEVEL[currentLevel] - totalXP;
}

export function getLevelProgress(totalXP: number): number {
    const currentLevel = calculateLevel(totalXP);
    if (currentLevel >= XP_PER_LEVEL.length) return 1;

    const currentLevelXP = XP_PER_LEVEL[currentLevel - 1];
    const nextLevelXP = XP_PER_LEVEL[currentLevel];
    const progressInLevel = totalXP - currentLevelXP;
    const xpNeededForLevel = nextLevelXP - currentLevelXP;

    return progressInLevel / xpNeededForLevel;
}

export function isNewDay(lastActiveTimestamp: number | null): boolean {
    if (!lastActiveTimestamp) return true;

    const lastDate = new Date(lastActiveTimestamp);
    const today = new Date();

    return lastDate.toDateString() !== today.toDateString();
}

export function calculateStreak(
    currentStreak: number,
    lastActiveTimestamp: number | null
): number {
    if (!lastActiveTimestamp) return 1;

    const lastDate = new Date(lastActiveTimestamp);
    const today = new Date();
    const diffDays = Math.floor(
        (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
        return currentStreak; // Same day
    } else if (diffDays === 1) {
        return currentStreak + 1; // Consecutive day
    } else {
        return 1; // Streak broken
    }
}

// Level titles for gamification
export const LEVEL_TITLES = [
    'Beginner',          // 1
    'Novice',            // 2
    'Apprentice',        // 3
    'Student',           // 4
    'Learner',           // 5
    'Scholar',           // 6
    'Enthusiast',        // 7
    'Practitioner',      // 8
    'Adept',             // 9
    'Expert',            // 10
    'Master',            // 11
    'Virtuoso',          // 12
    'Sage',              // 13
    'Guardian',          // 14
    'Champion',          // 15
    'Legend',            // 16
    'Mythic',            // 17
    'Transcendent',      // 18
    'Immortal',          // 19
    'Supreme',           // 20
];

export function getLevelTitle(level: number): string {
    return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] || 'Supreme';
}
