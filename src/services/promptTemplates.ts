// src/services/promptTemplates.ts
// Shared templates and schemas for AI prompts

// ============ REUSABLE COMPONENTS ============

export const JSON_INSTRUCTION = `Output strictly valid JSON.`;

export const COMMON_SCHEMAS = {
    // Shared Grammar Concept Schema
    grammarConcept: `{
        "name": "English Name",
        "nameRu": "Русское название",
        "description": "Описание на русском",
        "rule": "short rule (e.g. have/has + V3)",
        "example": "Example sentence"
    }`,

    // Shared Vocabulary Schema
    vocabulary: `{
        "word": "english word",
        "translation": "русский перевод",
        "definition": "english definition",
        "level": "CEFR level (A1-C2)"
    }`,

    // Shared Correction Schema
    correction: `{
        "wrong": "exact wrong text",
        "correct": "corrected text",
        "type": "spelling OR grammar"
    }`
};

// ============ INTERFACES ============

export interface ParsedGrammar {
    name: string;
    nameRu: string;
    description: string;
    rule: string;
    example: string;
}

export interface ParsedWord {
    word: string;
    translation: string;
    definition: string;
    level: string;
}

export interface ParsedCorrection {
    wrong: string;
    correct: string;
    type: 'spelling' | 'grammar';
}

// ============ PROMPT GENERATORS ============

export const PromptTemplates = {

    /**
     * Generate a single sentence with a missing word for exercises.
     */
    generateSentenceForWord(word: string, translation: string, level: string): string {
        return `Generate ONE English sentence using the word "${word}" (${translation}).
Level: ${level}. 
The sentence should be natural and help learn this word.
Output JSON only: {"sentence": "The ___ was beautiful.", "missingWord": "${word}"}
Replace the target word with ___ in the sentence.`;
    },

    /**
     * Vision: Extract words from image context.
     */
    extractWordsFromImage(): string {
        return `Look at this image and extract ALL English words or vocabulary you can see.
For each word, provide its Russian translation.
Only include actual English words, not numbers or symbols.
Output JSON array only: [{"word": "example", "translation": "пример"}, ...]`;
    },

    /**
     * Generate a Russian sentence for translation practice.
     */
    generateRussianSentence(level: string, vocabWords?: string[]): string {
        const vocabPart = vocabWords?.length
            ? `Try to use these vocabulary words if appropriate: ${vocabWords.join(', ')}.`
            : '';

        return `Generate ONE Russian sentence for translation practice.
Level: ${level}
${vocabPart}

Output JSON only: {
    "sentence": "Русское предложение",
    "hint": "optional hint in Russian",
    "expectedTranslation": "English translation"
}`;
    },

    /**
     * Evaluate a user's translation attempt.
     */
    evaluateTranslation(original: string, userTranslation: string, expectedTranslation: string): string {
        return `Evaluate this English text written by a Russian language learner.

Original Russian: "${original}"
User wrote: "${userTranslation}"
Expected translation: "${expectedTranslation}"

Analyze and return JSON with these SEPARATE categories:

1. "semanticScore": 0.0-1.0 (meaning accuracy)
2. "grammarScore": 0.0-1.0 (grammar correctness)
3. "feedback": Brief encouraging feedback in Russian (1-2 sentences)

4. "spellingErrors": Array of spelling mistakes ONLY (typos, wrong letters)
   Format: [{"wrong": "graammar", "correct": "grammar"}]

5. "grammarErrors": Array of grammar mistakes
   Format: [{"wrong": "I goes", "correct": "I go", "rule": "Subject-verb agreement"}]

6. "grammarConcepts": Array of grammar topics to practice based on errors found
   Format: ${COMMON_SCHEMAS.grammarConcept}
   Include ONLY if there are actual grammar errors. Max 2 concepts.

7. "vocabularySuggestions": Array of useful words from the context
   Format: ${COMMON_SCHEMAS.vocabulary}
   Include only if relevant advanced vocabulary was used or should be learned.

${JSON_INSTRUCTION} Be specific about what the user got wrong.`;
    },

    /**
     * General textual evaluation (Chat, Story responses).
     */
    evaluateEnglishText(userText: string, context?: string): string {
        return `You are an English teacher helping a Russian speaker practice English.
${context ? `Context: ${context}` : ''}

Student wrote: "${userText}"

Analyze and return JSON:

1. "hasErrors": true/false - does the text have any errors?

2. "corrections": Array of ALL errors found (spelling AND grammar)
   Format: ${COMMON_SCHEMAS.correction}
   Be precise - copy the exact wrong text from the user's message.

3. "grammarConcepts": If grammar errors found, list concepts to practice
   Format: ${COMMON_SCHEMAS.grammarConcept}
   Max 2 concepts. Only include if actual grammar errors.

4. "vocabularySuggestions": Advanced words from the conversation worth learning
   Format: ${COMMON_SCHEMAS.vocabulary}
   Only include if using or teaching advanced vocabulary.

5. "conversationResponse": Your natural conversational response in English (2-3 sentences).
   - If errors, start with: "❌ [mistake] → ✅ [correction]" for the most important error
   - Then continue the conversation naturally
   - Be encouraging!

${JSON_INSTRUCTION}`;
    },

    /**
     * Generate a conversational dialogue.
     */
    generateDialogue(topic: string, targetWords: string[], turnCount: number = 2): string {
        return `Create a short English dialogue about "${topic}".
Use these vocabulary words naturally: ${targetWords.join(', ')}.
Generate ${turnCount} turns per speaker.

Output JSON: {
    "turns": [
        {"speaker": "A", "text": "Hello, how are you today?"},
        {"speaker": "B", "text": "I'm great, thanks for asking!"}
    ]
}`;
    },

    /**
     * Generate reading comprehension text and questions.
     */
    generateReadingText(topic: string, targetWords: string[], level: string): string {
        return `Create a short English reading text about "${topic}" for ${level} learners.
Use these vocabulary words: ${targetWords.join(', ')}.
Generate 2-3 comprehension questions.

Output JSON: {
    "text": "The reading passage text here...",
    "questions": [
        {"question": "What is the main idea?", "correctAnswer": "The correct answer"}
    ]
}`;
    },

    /**
     * Evaluate a specific dialogue response (simpler than full text eval).
     */
    evaluateDialogueResponse(context: string, userResponse: string): string {
        return `You are evaluating a student's English dialogue response.
Context: ${context}
Student's response: "${userResponse}"

Evaluate:
1. Is the response appropriate for the context?
2. Is the grammar correct?
3. Provide brief feedback in Russian.

Output JSON: {"score": 0.8, "feedback": "Отличный ответ!", "corrections": []}`;
    },

    /**
     * Generate a story with questions.
     */
    generateStoryWithQuestions(
        topic: string,
        level: 'A1-A2' | 'B1-B2' | 'C1-C2',
        vocabularyWords?: string[],
        grammarFocus?: string[]
    ): string {
        // Level guidelines
        const levelGuide = {
            'A1-A2': 'Use simple vocabulary and short sentences. Present tense mostly.',
            'B1-B2': 'Use varied vocabulary and sentence structures. Past and present tenses.',
            'C1-C2': 'Use sophisticated vocabulary, idioms, and complex sentences.',
        }[level];

        // Build vocabulary section if words provided
        const vocabSection = vocabularyWords && vocabularyWords.length > 0
            ? `\nIMPORTANT: Incorporate these vocabulary words naturally into the story: ${vocabularyWords.join(', ')}.`
            : '';

        // Build grammar section if concepts provided
        const grammarSection = grammarFocus && grammarFocus.length > 0
            ? `\nIncorporate these grammar structures: ${grammarFocus.join(', ')}.`
            : '';

        return `Create a short engaging story for English learners.
Topic: ${topic}
Language Level: ${level}
Guidelines: ${levelGuide}${vocabSection}${grammarSection}

The story should be 5-7 sentences long.
Create 4 comprehension questions about the story (mix of detail and inference questions).

Output strictly JSON:
{
    "title": "Story Title",
    "story": "The complete story text...",
    "questions": [
        {"question": "Question about the story?", "correctAnswer": "The correct answer"}
    ]
}`;
    },

    /**
     * Check validty of a user answer to a story question.
     */
    checkStoryAnswer(question: string, userAnswer: string, correctAnswer: string, storyContext: string): string {
        return `Assess the student's answer to a reading comprehension question.
Story Context: "${storyContext.substring(0, 300)}..."
Question: "${question}"
Correct Answer: "${correctAnswer}"
Student Answer: "${userAnswer}"

Analyze:
1. Is the student's answer factually correct based on the story?
2. Is the meaning close enough to the correct answer?

Output JSON: {"isCorrect": true, "feedback": "Brief feedback in Russian explaining why it is correct or incorrect."}`;
    }
};
