import { Database, Q } from '@nozbe/watermelondb';
import { Model } from '@nozbe/watermelondb';
import { field, date, text, readonly } from '@nozbe/watermelondb/decorators';

// --- Models (Define inline for now, ideally move to separate files) ---

export class Word extends Model {
    static table = 'words';

    @text('text') text!: string;
    @text('definition') definition!: string;
    @text('cefr_level') cefrLevel!: string;
    @field('frequency_rank') frequencyRank!: number;
    @text('status') status!: 'new' | 'learning' | 'known' | 'ignored';
    @date('next_review_at') nextReviewAt!: Date;
    @field('srs_stability') srsStability!: number;
    @field('srs_difficulty') srsDifficulty!: number;
    @field('times_shown') timesShown!: number;
    @field('times_correct') timesCorrect!: number;
    @date('last_reviewed_at') lastReviewedAt!: Date;
    @text('source') source!: 'manual' | 'lookup' | 'youtube';
    @readonly @date('created_at') createdAt!: Date;
    @readonly @date('updated_at') updatedAt!: Date;
}

export class ReviewLog extends Model {
    static table = 'review_logs';
    @text('word_id') wordId!: string;
    @field('grade') grade!: number;
    @date('reviewed_at') reviewedAt!: Date;
    @field('time_taken_ms') timeTakenMs!: number;
}

// --- Service ---

export class DictionaryService {
    private database: Database;

    constructor(database: Database) {
        this.database = database;
    }

    // SM-2 Algorithm Implementation
    private calculateNextReview(
        currentStability: number,
        currentDifficulty: number,
        grade: number // 1 (Again) - 4 (Easy)
    ): { stability: number; difficulty: number; nextReview: Date } {
        // FSRS-inspired simplified logic or standard SM-2
        // Using standard SM-2 for simplicity
        // Grade: 1=Fail, 2=Hard, 3=Good, 4=Easy

        let newStability = currentStability;
        let newDifficulty = currentDifficulty;

        if (grade === 1) {
            newStability = 1; // Reset interval to 1 day
            newDifficulty = Math.min(newDifficulty + 0.2, 5); // Increase difficulty
        } else {
            // Success
            const difficultyWeight = 1 + (4 - grade) * 0.2; // Harder = higher weight
            newDifficulty = Math.max(Math.min(newDifficulty - (grade - 3) * 0.1, 5), 1);

            // Interval multiplier based on difficulty
            const intervalModifier = 1 + (newDifficulty * 0.5);
            newStability = Math.ceil(currentStability * intervalModifier);
        }

        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + newStability);

        return {
            stability: newStability,
            difficulty: newDifficulty,
            nextReview
        };
    }

    async addWord(
        text: string,
        definition: string,
        cefrLevel: string,
        source: 'manual' | 'lookup' | 'youtube' = 'manual'
    ): Promise<Word> {
        return await this.database.write(async () => {
            const wordsCollection = this.database.get<Word>('words');

            // Check if exists
            const existing = await wordsCollection.query(Q.where('text', text)).fetch();
            if (existing.length > 0) return existing[0];

            return await wordsCollection.create(word => {
                word.text = text.toLowerCase().trim();
                word.definition = definition;
                word.cefrLevel = cefrLevel;
                word.status = 'new';
                word.source = source;
                word.timesShown = 0;
                word.timesCorrect = 0;
                word.srsStability = 0; // 0 days
                word.srsDifficulty = 2.5; // Default difficulty
                word.nextReviewAt = new Date(); // Review immediately
            });
        });
    }

    async getWordsForReview(limit: number = 20): Promise<Word[]> {
        const now = new Date().getTime();
        const wordsCollection = this.database.get<Word>('words');

        // Fetch words due for review
        // Note: WatermelonDB query capabilities are limited, might need raw query or filter in JS
        // For now, simple filter
        const allLearningWords = await wordsCollection.query().fetch();

        return allLearningWords
            .filter(w => w.status !== 'ignored' && (w.nextReviewAt.getTime() <= now || w.status === 'new'))
            .sort((a, b) => a.nextReviewAt.getTime() - b.nextReviewAt.getTime())
            .slice(0, limit);
    }

    async processReview(wordId: string, grade: number): Promise<void> {
        await this.database.write(async () => {
            const word = await this.database.get<Word>('words').find(wordId);
            const { stability, difficulty, nextReview } = this.calculateNextReview(
                word.srsStability || 1,
                word.srsDifficulty || 2.5,
                grade
            );

            await word.update(w => {
                w.srsStability = stability;
                w.srsDifficulty = difficulty;
                w.nextReviewAt = nextReview;
                w.lastReviewedAt = new Date();
                w.timesShown += 1;
                if (grade > 1) w.timesCorrect += 1;

                if (w.status === 'new') w.status = 'learning';
                if (stability > 30) w.status = 'known'; // Mark known if interval > 30 days
            });

            // Log review
            await this.database.get<ReviewLog>('review_logs').create(log => {
                log.wordId = wordId;
                log.grade = grade;
                log.reviewedAt = new Date();
                log.timeTakenMs = 0; // TODO: Track time
            });
        });
    }
}
