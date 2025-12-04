// src/lib/nlp/frequencyAdapter.ts

/**
 * Enhanced word frequency adapter for CEFR level classification.
 * Uses curated word lists with morphological analysis for accuracy.
 * Optimized for minimal memory footprint.
 */

// A1-A2 Level: Very common, basic vocabulary (~300 most frequent)
const A1_A2_WORDS = new Set([
    // Pronouns & Articles
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'ours', 'theirs',
    'this', 'that', 'these', 'those', 'the', 'a', 'an',
    // Common Verbs
    'be', 'am', 'is', 'are', 'was', 'were', 'been', 'being',
    'have', 'has', 'had', 'having', 'do', 'does', 'did', 'done', 'doing',
    'go', 'goes', 'went', 'gone', 'going', 'come', 'comes', 'came', 'coming',
    'get', 'gets', 'got', 'getting', 'make', 'makes', 'made', 'making',
    'say', 'says', 'said', 'saying', 'see', 'sees', 'saw', 'seen', 'seeing',
    'know', 'knows', 'knew', 'known', 'knowing', 'think', 'thinks', 'thought', 'thinking',
    'take', 'takes', 'took', 'taken', 'taking', 'want', 'wants', 'wanted', 'wanting',
    'give', 'gives', 'gave', 'given', 'giving', 'use', 'uses', 'used', 'using',
    'find', 'finds', 'found', 'finding', 'tell', 'tells', 'told', 'telling',
    'ask', 'asks', 'asked', 'asking', 'work', 'works', 'worked', 'working',
    'seem', 'seems', 'seemed', 'seeming', 'feel', 'feels', 'felt', 'feeling',
    'try', 'tries', 'tried', 'trying', 'leave', 'leaves', 'left', 'leaving',
    'call', 'calls', 'called', 'calling', 'need', 'needs', 'needed', 'needing',
    'put', 'puts', 'putting', 'keep', 'keeps', 'kept', 'keeping',
    'let', 'lets', 'letting', 'begin', 'begins', 'began', 'begun', 'beginning',
    'help', 'helps', 'helped', 'helping', 'show', 'shows', 'showed', 'shown', 'showing',
    'hear', 'hears', 'heard', 'hearing', 'play', 'plays', 'played', 'playing',
    'run', 'runs', 'ran', 'running', 'move', 'moves', 'moved', 'moving',
    'live', 'lives', 'lived', 'living', 'believe', 'believes', 'believed',
    'hold', 'holds', 'held', 'holding', 'bring', 'brings', 'brought', 'bringing',
    'write', 'writes', 'wrote', 'written', 'writing', 'read', 'reads', 'reading',
    'learn', 'learns', 'learned', 'learnt', 'learning', 'stand', 'stands', 'stood', 'standing',
    'eat', 'eats', 'ate', 'eaten', 'eating', 'drink', 'drinks', 'drank', 'drunk', 'drinking',
    'sleep', 'sleeps', 'slept', 'sleeping', 'walk', 'walks', 'walked', 'walking',
    'sit', 'sits', 'sat', 'sitting', 'stop', 'stops', 'stopped', 'stopping',
    'open', 'opens', 'opened', 'opening', 'close', 'closes', 'closed', 'closing',
    'start', 'starts', 'started', 'starting', 'watch', 'watches', 'watched', 'watching',
    'buy', 'buys', 'bought', 'buying', 'talk', 'talks', 'talked', 'talking',
    'wait', 'waits', 'waited', 'waiting', 'like', 'likes', 'liked', 'liking',
    'love', 'loves', 'loved', 'loving', 'hate', 'hates', 'hated', 'hating',
    'look', 'looks', 'looked', 'looking',
    // Nouns - Basic
    'time', 'year', 'people', 'way', 'day', 'man', 'woman', 'child', 'children',
    'world', 'life', 'hand', 'part', 'place', 'case', 'week', 'company', 'system',
    'program', 'question', 'work', 'night', 'point', 'home', 'water', 'room',
    'mother', 'father', 'area', 'money', 'story', 'fact', 'month', 'lot', 'right',
    'study', 'book', 'eye', 'job', 'word', 'business', 'side', 'kind', 'head',
    'house', 'friend', 'hour', 'game', 'line', 'end', 'member', 'law', 'car',
    'city', 'name', 'team', 'minute', 'idea', 'kid', 'body', 'face', 'others',
    'family', 'school', 'food', 'table', 'door', 'window', 'bed', 'chair',
    'morning', 'evening', 'afternoon', 'today', 'tomorrow', 'yesterday',
    'boy', 'girl', 'dog', 'cat', 'bird', 'fish', 'tree', 'flower', 'sun', 'moon',
    'color', 'colour', 'red', 'blue', 'green', 'yellow', 'black', 'white', 'orange', 'pink',
    'number', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'hundred', 'thousand', 'million', 'first', 'second', 'third', 'last',
    // Adjectives - Basic
    'good', 'new', 'old', 'great', 'big', 'small', 'long', 'little', 'young',
    'right', 'high', 'different', 'next', 'early', 'important', 'few', 'bad',
    'same', 'able', 'last', 'late', 'hard', 'left', 'best', 'better', 'sure',
    'free', 'true', 'nice', 'happy', 'sad', 'hot', 'cold', 'warm', 'cool',
    'fast', 'slow', 'easy', 'difficult', 'beautiful', 'ugly', 'clean', 'dirty',
    'full', 'empty', 'rich', 'poor', 'strong', 'weak', 'healthy', 'sick',
    'hungry', 'thirsty', 'tired', 'busy', 'ready', 'quiet', 'loud', 'dark', 'light',
    // Adverbs
    'now', 'then', 'here', 'there', 'also', 'just', 'only', 'very', 'really',
    'well', 'never', 'always', 'often', 'sometimes', 'still', 'already', 'ever',
    'soon', 'today', 'yesterday', 'tomorrow', 'again', 'too', 'maybe', 'perhaps',
    // Prepositions & Conjunctions
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'up', 'about',
    'into', 'over', 'after', 'under', 'between', 'out', 'through', 'before',
    'around', 'behind', 'without', 'during', 'near', 'above', 'below',
    'and', 'but', 'or', 'if', 'because', 'so', 'than', 'when', 'while',
    // Question Words
    'what', 'who', 'which', 'where', 'when', 'why', 'how', 'whose', 'whom',
    // Other Common
    'not', 'no', 'yes', 'all', 'some', 'any', 'many', 'much', 'more', 'most',
    'other', 'such', 'even', 'own', 'back', 'off', 'down', 'away', 'both',
    'each', 'every', 'few', 'enough', 'lot', 'thing', 'something', 'nothing',
    'everything', 'anything', 'someone', 'anyone', 'everyone', 'nobody',
    'please', 'thank', 'thanks', 'sorry', 'excuse', 'hello', 'hi', 'bye', 'goodbye',
]);

// B1-B2 Level: Intermediate vocabulary (~400 words)
const B1_B2_WORDS = new Set([
    // Verbs - Intermediate
    'achieve', 'admit', 'afford', 'agree', 'allow', 'announce', 'appear', 'apply',
    'approach', 'argue', 'arrange', 'arrive', 'assume', 'attend', 'avoid', 'base',
    'beat', 'become', 'belong', 'benefit', 'blame', 'borrow', 'breathe', 'build',
    'burn', 'cancel', 'carry', 'catch', 'cause', 'celebrate', 'challenge', 'change',
    'charge', 'check', 'choose', 'claim', 'climb', 'collect', 'combine', 'compare',
    'compete', 'complain', 'complete', 'concern', 'confirm', 'connect', 'consider',
    'contain', 'continue', 'control', 'convince', 'cook', 'copy', 'correct', 'cost',
    'count', 'cover', 'create', 'cross', 'cry', 'cut', 'damage', 'dance', 'deal',
    'decide', 'deliver', 'demand', 'deny', 'depend', 'describe', 'design', 'destroy',
    'determine', 'develop', 'die', 'disappear', 'discover', 'discuss', 'divide',
    'doubt', 'draw', 'dream', 'dress', 'drive', 'drop', 'earn', 'encourage', 'enjoy',
    'enter', 'escape', 'establish', 'examine', 'exist', 'expand', 'expect', 'experience',
    'explain', 'explore', 'express', 'extend', 'fail', 'fall', 'fear', 'fight', 'fill',
    'finish', 'fit', 'fix', 'fly', 'focus', 'follow', 'force', 'forget', 'forgive',
    'form', 'gain', 'gather', 'generate', 'grab', 'grow', 'guess', 'handle', 'hang',
    'happen', 'hide', 'hit', 'hope', 'hurt', 'identify', 'ignore', 'imagine', 'improve',
    'include', 'increase', 'indicate', 'influence', 'inform', 'insist', 'install',
    'intend', 'introduce', 'invest', 'invite', 'involve', 'join', 'judge', 'jump',
    'kick', 'kill', 'knock', 'lack', 'land', 'last', 'laugh', 'lay', 'lead', 'lend',
    'lie', 'lift', 'limit', 'link', 'listen', 'load', 'lock', 'lose', 'maintain',
    'manage', 'mark', 'match', 'matter', 'mean', 'measure', 'meet', 'mention', 'miss',
    'mix', 'notice', 'obtain', 'occur', 'offer', 'operate', 'order', 'organize', 'own',
    'pack', 'park', 'pass', 'pay', 'perform', 'permit', 'pick', 'plan', 'plant',
    'point', 'possess', 'pour', 'practice', 'practise', 'predict', 'prefer', 'prepare',
    'present', 'press', 'prevent', 'print', 'produce', 'promise', 'propose', 'protect',
    'prove', 'provide', 'publish', 'pull', 'purchase', 'push', 'qualify', 'raise',
    'reach', 'react', 'realize', 'receive', 'recognize', 'recommend', 'record', 'reduce',
    'refer', 'reflect', 'refuse', 'regard', 'relate', 'release', 'rely', 'remain',
    'remember', 'remind', 'remove', 'rent', 'repair', 'repeat', 'replace', 'reply',
    'report', 'represent', 'request', 'require', 'rescue', 'research', 'reserve',
    'resolve', 'respond', 'rest', 'result', 'retire', 'return', 'reveal', 'review',
    'ride', 'ring', 'rise', 'risk', 'roll', 'rush', 'satisfy', 'save', 'score',
    'search', 'sell', 'send', 'separate', 'serve', 'set', 'settle', 'shake', 'shape',
    'share', 'shift', 'shine', 'shoot', 'shop', 'shout', 'shut', 'sign', 'sing',
    'sink', 'slip', 'smell', 'smile', 'solve', 'sort', 'sound', 'speak', 'spend',
    'split', 'spread', 'steal', 'stick', 'store', 'strike', 'struggle', 'study',
    'submit', 'succeed', 'suffer', 'suggest', 'suit', 'supply', 'support', 'suppose',
    'surprise', 'surround', 'survive', 'suspect', 'switch', 'taste', 'teach', 'tear',
    'tend', 'test', 'throw', 'tie', 'touch', 'track', 'trade', 'train', 'transfer',
    'transform', 'translate', 'travel', 'treat', 'trust', 'turn', 'understand',
    'update', 'upgrade', 'upset', 'urge', 'vary', 'view', 'visit', 'vote', 'wake',
    'warn', 'wash', 'waste', 'wear', 'weigh', 'welcome', 'win', 'wish', 'wonder',
    'worry', 'wrap', 'yell',
    // Nouns - Intermediate
    'ability', 'access', 'accident', 'account', 'action', 'activity', 'address',
    'advantage', 'advice', 'age', 'agreement', 'air', 'amount', 'analysis', 'animal',
    'answer', 'apartment', 'appearance', 'application', 'argument', 'army', 'art',
    'article', 'artist', 'aspect', 'attention', 'attitude', 'audience', 'author',
    'average', 'background', 'balance', 'ball', 'bank', 'bar', 'basis', 'beach',
    'behavior', 'behaviour', 'benefit', 'bill', 'bit', 'blood', 'board', 'boat', 'bone',
    'border', 'bottle', 'bottom', 'box', 'brain', 'branch', 'bread', 'bridge', 'building',
    'bus', 'butter', 'button', 'camera', 'camp', 'campaign', 'capital', 'captain',
    'card', 'career', 'cause', 'cell', 'center', 'centre', 'century', 'chain', 'chair',
    'challenge', 'chance', 'character', 'charge', 'chart', 'choice', 'church', 'citizen',
    'class', 'client', 'climate', 'clothes', 'club', 'coast', 'code', 'coffee',
    'collection', 'college', 'combination', 'comment', 'committee', 'communication',
    'community', 'competition', 'computer', 'concept', 'concern', 'condition',
    'conference', 'confidence', 'conflict', 'connection', 'consequence', 'construction',
    'consumer', 'contact', 'content', 'context', 'contract', 'contribution', 'control',
    'conversation', 'copy', 'corner', 'cost', 'country', 'couple', 'course', 'court',
    'cover', 'credit', 'crime', 'crisis', 'culture', 'cup', 'customer', 'data', 'date',
    'daughter', 'deal', 'death', 'debate', 'decision', 'degree', 'demand', 'department',
    'design', 'desire', 'detail', 'device', 'difference', 'difficulty', 'direction',
    'director', 'discussion', 'disease', 'distance', 'doctor', 'document', 'dollar',
    'doubt', 'dress', 'effect', 'effort', 'election', 'element', 'email', 'emergency',
    'emotion', 'employee', 'employer', 'energy', 'engine', 'environment', 'equipment',
    'error', 'escape', 'essay', 'event', 'evidence', 'example', 'exchange', 'exercise',
    'experience', 'expert', 'explanation', 'expression', 'extent', 'factor', 'failure',
    'farm', 'farmer', 'fear', 'feature', 'feeling', 'field', 'figure', 'film', 'finger',
]);

// C1-C2 Level: Advanced vocabulary - detected by patterns
const C1_C2_WORDS = new Set([
    // Academic & Formal
    'albeit', 'albeit', 'alleviate', 'amalgamate', 'ameliorate', 'analogous', 'anomaly',
    'antithesis', 'apprehensive', 'arbitrary', 'assimilate', 'augment', 'auspicious',
    'autonomous', 'benevolent', 'brevity', 'bureaucracy', 'capitulate', 'coalesce',
    'cogent', 'coherent', 'commensurate', 'compel', 'comprehensive', 'comprise',
    'concede', 'conducive', 'confer', 'conjecture', 'contemplate', 'contend',
    'contingent', 'contradict', 'conundrum', 'conventional', 'convey', 'corroborate',
    'credible', 'culminate', 'curtail', 'debilitate', 'deem', 'deficiency', 'delegate',
    'deliberate', 'delineate', 'denote', 'depict', 'derive', 'detrimental', 'deviate',
    'dichotomy', 'digress', 'diligent', 'discern', 'discrete', 'discriminate',
    'disparate', 'disparity', 'displace', 'disseminate', 'dissuade', 'diverge',
    'doctrine', 'elicit', 'eloquent', 'elucidate', 'emanate', 'embody', 'empirical',
    'emulate', 'encompass', 'endeavor', 'endeavour', 'endorse', 'enhance', 'entail',
    'enumerate', 'envisage', 'ephemeral', 'equate', 'equitable', 'erode', 'erratic',
    'erudite', 'escalate', 'espouse', 'exacerbate', 'exalt', 'exemplify', 'exempt',
    'exert', 'exhaust', 'expedite', 'explicit', 'exploit', 'expound', 'extraneous',
    'extrapolate', 'facilitate', 'fallacy', 'feasible', 'fluctuate', 'forestall',
    'formidable', 'forsake', 'forthcoming', 'foster', 'fundamental', 'galvanize',
    'generic', 'germane', 'gregarious', 'hamper', 'haphazard', 'hegemony', 'hierarchy',
    'hinder', 'hypothesize', 'idiosyncratic', 'illuminate', 'imminent', 'impair',
    'impartial', 'impede', 'impending', 'imperative', 'impetus', 'implement',
    'implicate', 'implicit', 'impose', 'impoverish', 'inadvertent', 'inaugurate',
    'incite', 'incline', 'incoherent', 'incompatible', 'incongruous', 'incorporate',
    'incumbent', 'indeterminate', 'indigenous', 'indispensable', 'induce', 'infer',
    'inherent', 'inhibit', 'initiate', 'innate', 'innovative', 'insatiable', 'insight',
    'insinuate', 'instantaneous', 'instigate', 'integrate', 'integrity', 'interim',
    'interject', 'intermittent', 'intricate', 'intrinsic', 'intuitive', 'invoke',
    'irrevocable', 'juxtapose', 'latent', 'laudable', 'legitimate', 'leverage',
    'litigate', 'lucid', 'manifest', 'manipulate', 'meticulous', 'mitigate', 'modicum',
    'multifaceted', 'negate', 'negligible', 'nominal', 'novice', 'nuance', 'nurture',
    'obfuscate', 'objectify', 'obligate', 'obliterate', 'obscure', 'obsolete',
    'omnipotent', 'opaque', 'optimal', 'ostensible', 'overt', 'paradigm', 'paradox',
    'paramount', 'peculiar', 'pedagogy', 'permeate', 'perpetuate', 'pertain',
    'pertinent', 'pervasive', 'phenomenon', 'pinnacle', 'plausible', 'polarize',
    'pragmatic', 'precedent', 'precipitate', 'preclude', 'predecessor', 'predicate',
    'predominant', 'preempt', 'premise', 'prerogative', 'prevalent', 'procrastinate',
    'profound', 'proliferate', 'promulgate', 'propensity', 'proponent', 'proprietary',
    'protagonist', 'protocol', 'provisional', 'proximity', 'prudent', 'puerile',
    'quintessential', 'ramification', 'ratify', 'rationale', 'rebuke', 'recapitulate',
    'reciprocal', 'reconcile', 'rectify', 'redundant', 'refute', 'reinforce',
    'reiterate', 'relegate', 'relinquish', 'remediate', 'remnant', 'renaissance',
    'render', 'repercussion', 'replenish', 'replicate', 'repudiate', 'requisite',
    'rescind', 'resilient', 'resonate', 'restitution', 'restrain', 'retrospective',
    'rhetoric', 'rigorous', 'robust', 'rudimentary', 'saturate', 'scrutinize',
    'serendipity', 'simultaneous', 'solicit', 'sophisticated', 'speculate', 'sporadic',
    'spurious', 'stagnate', 'statutory', 'stipulate', 'stratify', 'stringent',
    'subjugate', 'subordinate', 'subsequent', 'substantiate', 'subtle', 'succinct',
    'superfluous', 'supersede', 'supplement', 'suppress', 'surmise', 'surpass',
    'susceptible', 'sustain', 'synthesize', 'tacit', 'tangible', 'tantamount',
    'tenacious', 'tentative', 'terminate', 'thwart', 'transcend', 'transient',
    'treacherous', 'ubiquitous', 'ulterior', 'unambiguous', 'undermine', 'underscore',
    'unprecedented', 'unwarranted', 'uphold', 'utilize', 'validate', 'vanquish',
    'venerate', 'verbose', 'viable', 'vindicate', 'volatile', 'vouch', 'vulnerable',
    'wane', 'warrant', 'wary', 'wholesome', 'wield', 'zeal', 'zealous',
]);

// Advanced suffixes that indicate higher complexity
const ADVANCED_SUFFIXES = [
    'ization', 'isation', 'ification', 'ousness', 'iveness', 'fulness',
    'lessness', 'ability', 'ibility', 'ological', 'istically', 'mentation',
    'escence', 'escent', 'itude', 'arium', 'orium',
];

// Academic prefixes
const ACADEMIC_PREFIXES = [
    'pseudo', 'quasi', 'proto', 'meta', 'para', 'neo', 'ante', 'circum',
    'contra', 'ultra', 'infra', 'intra', 'inter', 'trans', 'multi', 'poly',
];

// Estimate Zipf score based on word frequency category
export const estimateZipf = (word: string): number => {
    const normalized = word.toLowerCase().trim();

    // Check direct matches first
    if (A1_A2_WORDS.has(normalized)) {
        return 6.5; // Very high frequency
    }

    if (B1_B2_WORDS.has(normalized)) {
        return 4.5; // Medium frequency
    }

    if (C1_C2_WORDS.has(normalized)) {
        return 2.5; // Low frequency
    }

    // Morphological analysis for unknown words

    // Check for advanced suffixes
    for (const suffix of ADVANCED_SUFFIXES) {
        if (normalized.endsWith(suffix)) {
            return 2.8;
        }
    }

    // Check for academic prefixes
    for (const prefix of ACADEMIC_PREFIXES) {
        if (normalized.startsWith(prefix) && normalized.length > prefix.length + 3) {
            return 3.0;
        }
    }

    // Length-based heuristics
    if (normalized.length > 12) return 2.5;
    if (normalized.length > 10) return 3.0;
    if (normalized.length > 8) return 3.5;
    if (normalized.length > 6) return 4.0;

    // Default to intermediate if we can't determine
    return 4.0;
};

// Classify word into CEFR level
export const classifyWordDifficulty = (word: string): 'A1-A2' | 'B1-B2' | 'C1-C2' => {
    const zipf = estimateZipf(word);

    if (zipf >= 5.5) return 'A1-A2';
    if (zipf >= 3.5) return 'B1-B2';
    return 'C1-C2';
};

// Get detailed classification with confidence
export interface WordClassification {
    word: string;
    level: 'A1-A2' | 'B1-B2' | 'C1-C2';
    zipfScore: number;
    confidence: 'high' | 'medium' | 'low';
    source: 'wordlist' | 'morphology' | 'heuristic';
}

export const classifyWordDetailed = (word: string): WordClassification => {
    const normalized = word.toLowerCase().trim();
    const zipf = estimateZipf(normalized);
    const level = classifyWordDifficulty(normalized);

    let source: 'wordlist' | 'morphology' | 'heuristic' = 'heuristic';
    let confidence: 'high' | 'medium' | 'low' = 'low';

    if (A1_A2_WORDS.has(normalized) || B1_B2_WORDS.has(normalized) || C1_C2_WORDS.has(normalized)) {
        source = 'wordlist';
        confidence = 'high';
    } else if (ADVANCED_SUFFIXES.some(s => normalized.endsWith(s)) ||
        ACADEMIC_PREFIXES.some(p => normalized.startsWith(p))) {
        source = 'morphology';
        confidence = 'medium';
    }

    return {
        word: normalized,
        level,
        zipfScore: zipf,
        confidence,
        source,
    };
};
