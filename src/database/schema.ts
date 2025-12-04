// src/database/schema.ts
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
    version: 2,
    tables: [
        tableSchema({
            name: 'users',
            columns: [
                { name: 'native_language', type: 'string' },
                { name: 'target_language', type: 'string' },
                { name: 'vocabulary_size_estimate', type: 'number' },
                { name: 'level_cefr', type: 'string' }, // A1, A2, B1, etc.
                { name: 'xp', type: 'number' },
                { name: 'level', type: 'number' },
                { name: 'streak', type: 'number' },
                { name: 'last_active_date', type: 'number', isOptional: true },
            ],
        }),
        tableSchema({
            name: 'words',
            columns: [
                { name: 'text', type: 'string', isIndexed: true },
                { name: 'definition', type: 'string', isOptional: true },
                { name: 'cefr_level', type: 'string', isOptional: true },
                { name: 'frequency_rank', type: 'number' },
                { name: 'status', type: 'string' }, // 'new', 'learning', 'known', 'ignored'
                { name: 'next_review_at', type: 'number', isOptional: true }, // Timestamp
                { name: 'srs_stability', type: 'number', isOptional: true },
                { name: 'srs_difficulty', type: 'number', isOptional: true },
                { name: 'times_shown', type: 'number' },
                { name: 'times_correct', type: 'number' },
                { name: 'last_reviewed_at', type: 'number', isOptional: true },
                { name: 'source', type: 'string' }, // 'manual', 'lookup', 'youtube'
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ],
        }),
        tableSchema({
            name: 'sources',
            columns: [
                { name: 'type', type: 'string' }, // 'youtube', 'epub', 'text'
                { name: 'title', type: 'string' },
                { name: 'url_or_path', type: 'string' },
                { name: 'processed_at', type: 'number' },
            ],
        }),
        tableSchema({
            name: 'contexts',
            columns: [
                { name: 'word_id', type: 'string', isIndexed: true },
                { name: 'source_id', type: 'string', isIndexed: true },
                { name: 'sentence_text', type: 'string' },
                { name: 'timestamp_start', type: 'number', isOptional: true },
                { name: 'timestamp_end', type: 'number', isOptional: true },
            ],
        }),
        tableSchema({
            name: 'review_logs',
            columns: [
                { name: 'word_id', type: 'string', isIndexed: true },
                { name: 'grade', type: 'number' }, // 1 (Again) - 4 (Easy)
                { name: 'reviewed_at', type: 'number' },
                { name: 'time_taken_ms', type: 'number' },
            ],
        }),
    ],
});
