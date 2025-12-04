// src/lib/nlp/filter.ts

// In a real app, this would be imported from a large JSON asset
const MOCK_FREQ_LIST: Record<string, number> = {
    "the": 1,
    "be": 2,
    "to": 3,
    "of": 4,
    "and": 5,
    "a": 6,
    "in": 7,
    "that": 8,
    "have": 9,
    "i": 10,
    "ephemeral": 15000,
    "serendipity": 18000,
    "quantum": 12000,
    "algorithm": 8000,
    "react": 5000,
};

export const filterWordsByLevel = (
    text: string,
    userKnownRank: number
): string[] => {
    // Simple regex to tokenize words (removes punctuation)
    const tokens = text.match(/\b[a-zA-Z]+\b/g) || [];
    const candidates = new Set<string>();

    tokens.forEach(word => {
        const lowerWord = word.toLowerCase();
        const rank = MOCK_FREQ_LIST[lowerWord];

        // Logic: 
        // 1. Must be in our frequency list (valid word)
        // 2. Rank > userKnownRank (User doesn't know it yet)
        // 3. Rank < 20000 (Not too obscure/archaic)
        if (rank && rank > userKnownRank && rank < 20000) {
            candidates.add(lowerWord);
        }
    });

    return Array.from(candidates);
};
