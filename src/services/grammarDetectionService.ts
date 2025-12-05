// src/services/grammarDetectionService.ts
// AI-powered grammar error detection from user translations

import { unifiedAI } from './unifiedAIManager';
import { addOrUpdateGrammarConcept, GrammarConcept, initDatabase } from './database';

// Common grammar patterns for English learners
export interface GrammarError {
    pattern: string;       // e.g., "Present Perfect"
    patternRu: string;     // Russian name
    description: string;   // Short explanation
    example: string;       // Correct example
    userMistake: string;   // What user wrote wrong
}

// Predefined grammar concepts for quick matching
const GRAMMAR_PATTERNS: Record<string, { nameRu: string; description: string; rule: string }> = {
    'Present Perfect': {
        nameRu: 'Настоящее совершённое',
        description: 'Действие завершено, но связано с настоящим',
        rule: 'have/has + V3 (Past Participle). Используется для опыта, результата, или действий начатых в прошлом и продолжающихся сейчас.',
    },
    'Past Simple': {
        nameRu: 'Простое прошедшее',
        description: 'Действие произошло в определённый момент в прошлом',
        rule: 'V2 (Past form) или did + V. Используется для завершённых действий с указанием времени.',
    },
    'Present Continuous': {
        nameRu: 'Настоящее продолженное',
        description: 'Действие происходит прямо сейчас или временно',
        rule: 'am/is/are + V-ing. Для действий в процессе или временных ситуаций.',
    },
    'Articles': {
        nameRu: 'Артикли (a/an/the)',
        description: 'Определённый и неопределённый артикли',
        rule: 'a/an для впервые упоминаемого, the для известного или единственного. Без артикля для абстрактных и множественных.',
    },
    'Subject-Verb Agreement': {
        nameRu: 'Согласование подлежащего и сказуемого',
        description: 'Глагол должен согласовываться с подлежащим в числе',
        rule: 'He/She/It + Vs (goes, does). I/We/They + V (go, do).',
    },
    'Word Order': {
        nameRu: 'Порядок слов',
        description: 'Английский требует фиксированного порядка слов',
        rule: 'Subject + Verb + Object. В вопросах: Aux + S + V + O?',
    },
    'Conditionals': {
        nameRu: 'Условные предложения',
        description: 'If-предложения для выражения условий',
        rule: 'Zero: If + Present, Present. First: If + Present, will + V. Second: If + Past, would + V.',
    },
    'Passive Voice': {
        nameRu: 'Страдательный залог',
        description: 'Когда объект становится подлежащим',
        rule: 'be + V3. "The book was written" вместо "Someone wrote the book".',
    },
    'Gerund vs Infinitive': {
        nameRu: 'Герундий или инфинитив',
        description: 'Выбор формы глагола после другого глагола',
        rule: 'Enjoy/finish/avoid + V-ing. Want/need/decide + to V.',
    },
    'Prepositions': {
        nameRu: 'Предлоги',
        description: 'Выбор правильного предлога',
        rule: 'in (внутри, в году/месяце), on (поверхность, день), at (точка, время).',
    },
    'Modal Verbs': {
        nameRu: 'Модальные глаголы',
        description: 'can, could, may, might, must, should, would',
        rule: 'Modal + V (без to). Must = обязательство. Should = рекомендация. Can = возможность.',
    },
    'Comparative/Superlative': {
        nameRu: 'Степени сравнения',
        description: 'Сравнительная и превосходная степени прилагательных',
        rule: 'Short: -er, -est. Long: more/most. Irregular: good-better-best.',
    },
};

/**
 * Analyze a translation for grammar errors using AI
 */
export async function analyzeGrammarErrors(
    originalSentence: string,
    userTranslation: string,
    correctTranslation?: string
): Promise<GrammarError[]> {
    try {
        await initDatabase();
        // Use AI to detect grammar patterns in errors
        const prompt = `Analyze this English translation for grammar errors.

Original (Russian): ${originalSentence}
User wrote: ${userTranslation}
${correctTranslation ? `Correct: ${correctTranslation}` : ''}

Identify up to 2 SPECIFIC grammar errors.
IMPORTANT: Note these errors for the user's personal dictionary.
Be precise.

For each error, respond in this EXACT JSON format:
[
  {
    "pattern": "Grammar Pattern Name (e.g., Present Perfect, Articles, Word Order)",
    "mistake": "What user wrote wrong",
    "correction": "How it should be"
  }
]

If no grammar errors, return empty array [].
Only return the JSON array, nothing else.`;

        const response = await unifiedAI.generateText(prompt);
        const responseText = typeof response === 'string' ? response : response?.text || '';

        // Parse AI response
        let errors: { pattern: string; mistake: string; correction: string }[] = [];
        try {
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                errors = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.warn('Failed to parse grammar errors:', e);
            return [];
        }

        // Map to our GrammarError interface and save to database
        const grammarErrors: GrammarError[] = [];

        for (const error of errors) {
            const patternName = error.pattern;
            const patternInfo = GRAMMAR_PATTERNS[patternName] || {
                nameRu: patternName,
                description: `Ошибка в использовании: ${patternName}`,
                rule: error.correction,
            };

            grammarErrors.push({
                pattern: patternName,
                patternRu: patternInfo.nameRu,
                description: patternInfo.description,
                example: error.correction,
                userMistake: error.mistake,
            });

            // Add or update grammar concept in database - only pass required fields
            await addOrUpdateGrammarConcept({
                name: patternName,
                nameRu: patternInfo.nameRu,
                description: patternInfo.description,
                examples: JSON.stringify([error.correction, userTranslation]),
                rule: patternInfo.rule,
            });
        }

        return grammarErrors;
    } catch (error) {
        console.error('Grammar analysis error:', error);
        return [];
    }
}

/**
 * Get a simple grammar tip for a detected error
 */
export function getGrammarTip(pattern: string): string {
    const info = GRAMMAR_PATTERNS[pattern];
    if (info) {
        return `${info.nameRu}: ${info.rule}`;
    }
    return `Проверьте использование: ${pattern}`;
}

/**
 * Get all available grammar patterns for reference
 */
export function getAllGrammarPatterns() {
    return Object.entries(GRAMMAR_PATTERNS).map(([name, info]) => ({
        name,
        nameRu: info.nameRu,
        description: info.description,
    }));
}

/**
 * Analyze chat message for grammar errors (specifically for Dictionary saving)
 */
export async function analyzeChatGrammar(
    userMessage: string,
    context?: string
): Promise<GrammarError[]> {
    try {
        await initDatabase();
        const prompt = `Analyze this student's English message for grammar mistakes.
Context: ${context || 'General conversation'}
Student wrote: "${userMessage}"

If there are grammar mistakes, identify the most important one.
Respond in JSON:
[
  {
    "pattern": "Grammar Pattern Name",
    "mistake": "exact user mistake substring",
    "correction": "corrected version",
    "explanation": "short explanation in Russian"
  }
]

If no mistakes, return []. JSON only.`;

        const response = await unifiedAI.generateText(prompt);
        const responseText = typeof response === 'string' ? response : response?.text || '';

        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];

        const errors = JSON.parse(jsonMatch[0]);
        const grammarErrors: GrammarError[] = [];

        for (const error of errors) {
            const patternInfo = GRAMMAR_PATTERNS[error.pattern] || {
                nameRu: error.pattern,
                description: error.explanation || `Ошибка: ${error.pattern}`,
                rule: error.correction,
            };

            await addOrUpdateGrammarConcept({
                name: error.pattern,
                nameRu: patternInfo.nameRu,
                description: patternInfo.description,
                examples: JSON.stringify([error.correction, userMessage]),
                rule: patternInfo.rule || patternInfo.description,
            });

            grammarErrors.push({
                pattern: error.pattern,
                patternRu: patternInfo.nameRu,
                description: error.explanation || patternInfo.description,
                example: error.correction,
                userMistake: error.mistake,
            });
        }

        return grammarErrors;
    } catch (e) {
        console.error('Chat grammar analysis failed:', e);
        return [];
    }
}
