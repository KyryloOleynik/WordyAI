import AsyncStorage from '@react-native-async-storage/async-storage';

// API Key types
export type APIKeyType = 'google' | 'perplexity';

export interface APIKey {
    id: string;
    type: APIKeyType;
    key: string;
    name: string;                  // User-friendly name
    isEnabled: boolean;
    lastError: number | null;      // Timestamp of last error
    timeoutUntil: number | null;   // 6-hour timeout timestamp
    createdAt: number;
}

const STORAGE_KEY = '@wordy_api_keys';
const TIMEOUT_DURATION = 5 * 60 * 1000; // 5 minutes in ms

// ============ API Keys Management ============

export async function getAllAPIKeys(): Promise<APIKey[]> {
    try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Error getting API keys:', e);
        return [];
    }
}

export async function addAPIKey(
    type: APIKeyType,
    key: string,
    name?: string
): Promise<APIKey> {
    const keys = await getAllAPIKeys();

    const newKey: APIKey = {
        id: Date.now().toString(),
        type,
        key,
        name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} API Key`,
        isEnabled: true,
        lastError: null,
        timeoutUntil: null,
        createdAt: Date.now(),
    };

    keys.push(newKey);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    return newKey;
}

export async function removeAPIKey(id: string): Promise<void> {
    const keys = await getAllAPIKeys();
    const filtered = keys.filter(k => k.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export async function updateAPIKey(id: string, updates: Partial<APIKey>): Promise<void> {
    const keys = await getAllAPIKeys();
    const index = keys.findIndex(k => k.id === id);
    if (index !== -1) {
        keys[index] = { ...keys[index], ...updates };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    }
}

export async function enableKey(id: string): Promise<void> {
    await updateAPIKey(id, {
        isEnabled: true,
        timeoutUntil: null,
        lastError: null
    });
}

export async function disableKey(id: string): Promise<void> {
    await updateAPIKey(id, { isEnabled: false });
}

export async function markKeyFailed(id: string, timeoutDurationMs?: number): Promise<void> {
    const now = Date.now();
    const duration = timeoutDurationMs || TIMEOUT_DURATION;
    await updateAPIKey(id, {
        lastError: now,
        timeoutUntil: now + duration,
    });
}

// Get all enabled keys that are not in timeout
export async function getActiveKeys(type?: APIKeyType): Promise<APIKey[]> {
    const keys = await getAllAPIKeys();
    const now = Date.now();

    return keys.filter(k => {
        if (!k.isEnabled) return false;
        if (k.timeoutUntil && k.timeoutUntil > now) return false;
        if (type && k.type !== type) return false;
        return true;
    });
}

// Get a single working key of a specific type
export async function getWorkingKey(type: APIKeyType): Promise<APIKey | null> {
    const activeKeys = await getActiveKeys(type);
    return activeKeys.length > 0 ? activeKeys[0] : null;
}

// Get keys by type (including disabled/timed out for UI)
export async function getKeysByType(type: APIKeyType): Promise<APIKey[]> {
    const keys = await getAllAPIKeys();
    return keys.filter(k => k.type === type);
}

// Check if a key is currently in timeout
export function isKeyInTimeout(key: APIKey): boolean {
    if (!key.timeoutUntil) return false;
    return key.timeoutUntil > Date.now();
}

// Get remaining timeout time in minutes
export function getTimeoutRemaining(key: APIKey): number {
    if (!key.timeoutUntil) return 0;
    const remaining = key.timeoutUntil - Date.now();
    return Math.max(0, Math.ceil(remaining / 60000));
}
// Custom Error for API Key issues
export class ApiKeyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ApiKeyError';
    }
}
