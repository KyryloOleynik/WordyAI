// src/services/promptTemplates.ts
// Shared templates and schemas for AI prompts

// ============ REUSABLE COMPONENTS ============

export const JSON_INSTRUCTION = `Strictly output valid JSON only. No markdown formatting, no code blocks (like \`\`\`json), no intro/outro text. Just the raw JSON string.`;

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
Output JSON format: {"sentence": "The ___ was beautiful.", "missingWord": "${word}"}
Replace the target word with ___ in the sentence.

${JSON_INSTRUCTION}`;
    },

    /**
     * Vision: Extract words from image context.
     */
    extractWordsFromImage(): string {
        return `Analyze this image and extract ALL distinct English words visible in the text.
For each word, provide its Russian translation.
Ignore numbers, symbols, and non-English text.

Output a valid JSON array of objects.
Format: [{"word": "example", "translation": "пример"}, {"word": "book", "translation": "книга"}]

${JSON_INSTRUCTION}`;
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

Output JSON format: {
    "sentence": "Русское предложение",
    "hint": "optional hint in Russian",
    "expectedTranslation": "English translation"
}

${JSON_INSTRUCTION}`;
    },

    /**
     * Evaluate a user's translation attempt.
     */
    evaluateTranslation(original: string, userTranslation: string, expectedTranslation: string): string {
        return `Evaluate this English text written by a Russian language learner.

Original Russian: "${original}"
User wrote: "${userTranslation}"
Expected translation: "${expectedTranslation}"

Analyze and return ONLY JSON response with these SEPARATE categories:

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

Be specific about what the user got wrong.

${JSON_INSTRUCTION}`;
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
}

${JSON_INSTRUCTION}`;
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
}

${JSON_INSTRUCTION}`;
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
3. Provide brief feedback in English.

Output JSON: {"score": 0.8, "feedback": "Brief feedback in English explaining why it is correct or incorrect.", "corrections": []}

${JSON_INSTRUCTION}`;
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

Output JSON format:
{
    "title": "Story Title",
    "story": "The complete story text...",
    "questions": [
        {"question": "Question about the story?", "correctAnswer": "The correct answer"}
    ]
}

${JSON_INSTRUCTION}`;
    },

    /**
     * Check validty of a user answer to a story question.
     */
    /**
     * Evaluate a student's answer to a story question (Content + Grammar).
     */
    evaluateStoryAnswer(question: string, userAnswer: string, correctAnswer: string, storyContext: string): string {
        return `You are an English teacher evaluating a reading comprehension answer.
Story Context: "${storyContext.substring(0, 500)}..."
Question: "${question}"
Correct Answer: "${correctAnswer}"
Student Answer: "${userAnswer}"

Analyze and return JSON:

1. "accuracy": 0-100 (Score based on FACTUAL correctness of the answer relative to the story. 100 = correct meaning, even if grammar is bad. 0 = wrong answer)

2. "feedback": Brief feedback on the CONTENT of the answer in English.

3. "corrections": Array of grammar/spelling errors in the student's answer.
   Format: ${COMMON_SCHEMAS.correction}

4. "grammarConcepts": If grammar errors found, list concepts to practice.
   Format: ${COMMON_SCHEMAS.grammarConcept}
   Max 1-2 concepts.

5. "vocabularySuggestions": Max 1-2 words from the story/answer worth learning.
   Format: ${COMMON_SCHEMAS.vocabulary}

${JSON_INSTRUCTION}`;
    },

    /**
     * Generate mixed grammar exercises (Textbook style).
     */
    generateGrammarTest(topic: string, rule: string): string {
        return `Generate 5 varied grammar exercises for "${topic}".
Rule/Context: ${rule}

Generate a mix of these types:
1. GAP FILL: "I ___ never been there." (Answer: have)
2. COMPLETION: "If I _____ (know), I would tell you." (Correct form)
3. TRANSFORMATION: "I regret sending it." -> "I wish I _____." (Rewrite using 'had not sent')
4. MATCHING: "Match the half: If you go..." (Options: "you will see", "you saw")
5. ERROR CORRECTION: "Find error: She don't like it." (Correct: doesn't)

Output a valid JSON array.
Format:
[
  {
    "type": "fill-blank" OR "multiple-choice",
    "question": "The question text (include instruction like 'Rewrite:' or 'Fill in:')",
    "correctAnswer": "exact string match",
    "options": ["opt1", "opt2", "opt3", "opt4"], // REQUIRED for multiple-choice only
    "translation": "Russian translation of the sentence"
  }
]

Ensure:
- "fill-blank" requires the user to Type the answer. Use for Gap Fill and Transformation.
- "multiple-choice" requires selecting an option. Use for Completion, Matching, Error Correction.
- Questions should be challenging but clear.
- Provide 4 options for multiple-choice.

${JSON_INSTRUCTION}`;
    }
};

