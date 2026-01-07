// Initial Data
const DEFAULT_CARDS = [
    { id: '1', en: 'Serendipity', ja: '思いがけない幸運', interval: 0, repetitions: 0, ef: 2.5, dueDate: 0 },
    { id: '2', en: 'Ephemeral', ja: '儚い', interval: 0, repetitions: 0, ef: 2.5, dueDate: 0 },
    { id: '3', en: 'Ubiquitous', ja: '至る所にある', interval: 0, repetitions: 0, ef: 2.5, dueDate: 0 },
    { id: '4', en: 'Eloquent', ja: '雄弁な', interval: 0, repetitions: 0, ef: 2.5, dueDate: 0 },
    { id: '5', en: 'Resilience', ja: '回復力', interval: 0, repetitions: 0, ef: 2.5, dueDate: 0 }
];

// State Management
const state = {
    view: 'HOME', // HOME, GAME, LIST, ALL_LIST, ADD
    cards: [],
    currentCard: null,
    isFlipped: false,
    sessionCount: 0,
    sortModeList: 'ADDED', // ADDED, ALPHA, PRIORITY
    sortModeAllList: 'ADDED', // ADDED, ALPHA, PRIORITY, PRIORITY_ASC
    searchQueryAllList: '',
    filterModeAllList: 'ACTIVE', // ALL, ACTIVE, ARCHIVED
    settings: {
        speechVol: 1.0,
        sfxVol: 0.5,
        autoPlay: false,
        showSettings: false
    }
};

// Utils: LocalStorage
const loadCards = () => {
    const stored = localStorage.getItem('flashcards_data');
    let cards = [];
    if (stored) {
        cards = JSON.parse(stored);
    } else {
        cards = DEFAULT_CARDS;
    }

    // Migration and Initialization
    return cards.map(c => ({
        ...c,
        // Ensure priority is set. If not present (old data), assume it's like a new card (20)
        priority: c.priority ?? 20,
        errors: c.errors ?? 0,
        archived: c.archived ?? false
    }));
};

const saveCards = () => {
    localStorage.setItem('flashcards_data', JSON.stringify(state.cards));
};

const loadSettings = () => {
    const stored = localStorage.getItem('flashcards_settings');
    if (stored) {
        state.settings = { ...state.settings, ...JSON.parse(stored) };
    }
};

const saveSettings = () => {
    localStorage.setItem('flashcards_settings', JSON.stringify(state.settings));
};

// Initialization
function init() {
    state.cards = loadCards();
    loadSettings();
    render();
    lucide.createIcons();

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (state.view !== 'GAME') return;

        if (e.code === 'Space') {
            e.preventDefault();
            handleCardClick();
        } else if (e.code === 'Enter') {
            e.preventDefault();
            if (state.isFlipped) {
                handleResult(true); // OK (NEXT)
            }
        } else if (e.key === 'Shift') {
            e.preventDefault();
            if (state.isFlipped) {
                handleResult(false); // Unknown (?)
            }
        } else if (e.code === 'KeyM') {
            e.preventDefault();
            speakWord();
        } else if (e.code === 'KeyN') {
            e.preventDefault();
            openWeblio();
        }
    });

    createFloatingLetters();
}

function createFloatingLetters() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const container = document.body;

    // Clear existing letters if any
    const existing = document.querySelectorAll('.bg-letter');
    existing.forEach(e => e.remove());

    // Reduce count on mobile/small screens
    const count = window.innerWidth < 600 ? 8 : 15;

    for (let i = 0; i < count; i++) {
        const span = document.createElement('span');
        span.className = 'bg-letter';
        span.innerText = letters[Math.floor(Math.random() * letters.length)];
        span.style.left = Math.random() * 100 + 'vw';
        span.style.fontSize = (Math.random() * 3 + 2) + 'rem';
        span.style.animationDuration = (Math.random() * 10 + 15) + 's';
        span.style.animationDelay = Math.random() * -20 + 's'; // Start randomly
        container.insertBefore(span, container.firstChild);
    }
}

// Navigation
function navigate(view) {
    state.view = view;
    if (view === 'GAME') {
        startGame();
    }
    render();
}

// Game Logic
function startGame() {
    state.settings.showSettings = false; // 開始時に設定画面を閉じる
    if (state.cards.length === 0) {
        alert("No cards available! Please add some.");
        navigate('ADD');
        return;
    }
    state.sessionCount = 1;
    pickNextCard();
}

// Card Selection Logic (Weighted Random)
function pickNextCard() {
    state.isFlipped = false;

    if (state.cards.length === 0) {
        state.currentCard = null;
        return;
    }

    // Calculate total weight (excluding archived cards)
    const activeCards = state.cards.filter(c => !c.archived);
    if (activeCards.length === 0) {
        state.currentCard = null;
        return;
    }
    const totalWeight = activeCards.reduce((sum, c) => sum + c.priority, 0);
    let random = Math.random() * totalWeight;

    for (const card of activeCards) {
        if (random < card.priority) {
            state.currentCard = card;
            return;
        }
        random -= card.priority;
    }

    // Fallback
    state.currentCard = activeCards[0];
}

function speakWord() {
    if (!state.currentCard) return;

    // Cancel previous speech to avoid overlapping
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(state.currentCard.en);
    utterance.lang = 'en-US';

    // Attempt to pick the best available American English voice
    // Chrome: "Google US English", Safari (Mac): "Samantha", etc.
    const voices = speechSynthesis.getVoices();
    const usVoice = voices.find(v => v.name === 'Google US English') // Chrome specific quality
        || voices.find(v => v.name === 'Samantha')       // Mac standard
        || voices.find(v => v.lang === 'en-US');         // General fallback

    if (usVoice) {
        utterance.voice = usVoice;
    }

    // Slightly slower rate for clarity
    utterance.rate = 0.9;
    // Volume: Web Speech API max is 1.0.
    utterance.volume = Math.min(1.0, state.settings.speechVol);

    speechSynthesis.speak(utterance);
}

function openWeblio() {
    if (!state.currentCard) return;
    const url = `https://ejje.weblio.jp/content/${encodeURIComponent(state.currentCard.en)}`;
    window.open(url, '_blank');
}

// Audio Context (Singleton)
let audioCtx = null;

function playSuccessSound() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Ensure context is running
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const t = audioCtx.currentTime;

    // Create two oscillators for a chord/arpeggio effect
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    // Sound Design: "Success Chime"
    // Osc 1: E5 (659Hz) -> E6 (logic) or just a short ping
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659, t);

    // Osc 2: G#5 (830Hz) slightly delayed for a "bling" effect
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(830, t);

    // Envelope (Volume from settings)
    // Boost base volume: 0.8 base * slider (max 2) = max 1.6 gain (very loud but safe for web audio)
    const vol = 0.8 * state.settings.sfxVol;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc1.start(t);
    osc2.start(t + 0.05); // Slight delay

    osc1.stop(t + 0.4);
    osc2.stop(t + 0.4);
}

function processReview(isCorrect) {
    if (!state.currentCard) return;

    const card = state.cards.find(c => c.id === state.currentCard.id);
    if (!card) return;

    if (isCorrect) {
        // OK Logic
        if (card.priority > 5) {
            // If it was a 'difficult' or 'new' card being learned
            card.priority = Math.max(2, card.priority - 1);
        } else {
            // Already mastered card, keep it low
            card.priority = 2;
        }
    } else {
        // Unknown Logic
        if (card.priority > 5) {
            // Already high priority, make it even higher
            card.priority += 3;
        } else {
            // Was considered 'mastered' (<= 5), but forgot it -> Spike priority
            card.priority = 10;
        }
        card.errors += 1;
    }
    // Cap priority to prevent overflow issues excessively
    card.priority = Math.min(100, card.priority);

    saveCards();
}

function handleCardClick() {
    state.isFlipped = !state.isFlipped;

    // Haptic feedback (subtle tap on flip)
    if (window.navigator.vibrate) {
        window.navigator.vibrate(10);
    }

    render();
}

function handleResult(isCorrect) {
    if (!state.currentCard) return;

    processReview(isCorrect);

    if (isCorrect) {
        playSuccessSound();
        if (window.navigator.vibrate) window.navigator.vibrate(20);
    } else {
        if (window.navigator.vibrate) window.navigator.vibrate([30, 50, 30]); // Error pattern
    }

    // Auto advance
    state.sessionCount++;
    pickNextCard();
    render();
}

function handleNext() {
    pickNextCard();
    render(); // Re-renders whole game view usually, or just update content
}

function addCard(en, ja, bulk = false) {
    // Check for duplicates (Case-insensitive)
    const exists = state.cards.some(c => c.en.toLowerCase() === en.toLowerCase());
    if (exists) {
        if (!bulk) {
            alert(`"${en}" is already in your list!`);
        }
        return false; // Indicate duplicate
    }

    const newCard = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        en,
        ja,
        priority: 20, // New card starts with high priority
        errors: 0,
        archived: false
    };
    state.cards.push(newCard);
    saveCards();
    if (!bulk) {
        navigate('HOME');
    }
    return true;
}

// Sorting Logic
function sortCards(cards, mode) {
    const c = [...cards];
    switch (mode) {
        case 'ALPHA':
            return c.sort((a, b) => a.en.toLowerCase().localeCompare(b.en.toLowerCase()));
        case 'PRIORITY':
            return c.sort((a, b) => b.priority - a.priority);
        case 'PRIORITY_ASC':
            return c.sort((a, b) => a.priority - b.priority);
        case 'ADDED':
        default:
            return c.reverse(); // Newest first (assuming array is append-only)
    }
}

function setSortMode(mode, view) {
    if (view === 'LIST') {
        state.sortModeList = mode;
    } else if (view === 'ALL_LIST') {
        state.sortModeAllList = mode;
    }
    render();
}

function setFilterMode(mode) {
    state.filterModeAllList = mode;
    render();
}

// Rendering
const app = document.getElementById('app');

function render() {
    app.innerHTML = '';
    lucide.createIcons(); // Re-run for generic updates, usually needs DOM first.

    switch (state.view) {
        case 'HOME':
            renderHome();
            break;
        case 'GAME':
            renderGame();
            break;
        case 'LIST':
            renderList();
            break;
        case 'ALL_LIST':
            renderAllList();
            break;
        case 'ADD':
            renderAdd();
            break;
    }
    lucide.createIcons();
}

function renderHome() {
    const container = document.createElement('div');
    container.className = 'view-container fade-in';

    const count = state.cards.length;
    const totalErrors = state.cards.reduce((sum, c) => sum + c.errors, 0);

    container.innerHTML = `
        <div class="title-header">
            <div class="logo-wrapper">
                <span class="logo-fm">FM</span>
            </div>
            <h1 class="app-title">FMaster</h1>
            <p>Master your vocabulary</p>
            <div class="stats-container" style="justify-content: center; margin-top: 20px;">
                <span class="stat-chip">${count} Words</span>
                <span class="stat-chip">${totalErrors} Mistakes</span>
            </div>
        </div>
        
        <div style="width: 100%; max-width: 320px;">
            <button class="btn btn-primary" onclick="navigate('GAME')">
                <i data-lucide="play"></i> Start Flashcards
            </button>
            <button class="btn btn-glass" onclick="navigate('ADD')">
                <i data-lucide="plus"></i> Add New Word
            </button>
            <button class="btn btn-glass" onclick="navigate('ALL_LIST')">
                <i data-lucide="book-open"></i> Word List
            </button>
            <button class="btn btn-glass" onclick="navigate('LIST')">
                <i data-lucide="list"></i> Unknown List
            </button>
        </div>
    `;
    app.appendChild(container);
}

function renderGame() {
    const container = document.createElement('div');
    container.className = 'view-container fade-in';

    if (!state.currentCard) {
        pickNextCard();
    }

    const card = state.currentCard;

    // Content swap logic
    let cardContent = '';

    if (!state.isFlipped) {
        // Front: English
        cardContent = `
            <div class="card-face fade-in">
                <p style="font-size: 0.9rem; color: #6b7280; margin-bottom: 10px;">ENGLISH</p>
                <h2 class="word-main">${card.en}</h2>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button class="btn btn-glass" style="width: auto; padding: 8px 16px; border-radius: 20px; background: rgba(99, 102, 241, 0.1); color: var(--accent-primary); border: none;" onclick="event.stopPropagation(); speakWord()">
                        <i data-lucide="volume-2" style="width: 20px; height: 20px;"></i> Listen (M)
                    </button>
                    <button class="btn btn-glass" style="width: auto; padding: 8px 16px; border-radius: 20px; background: rgba(236, 72, 153, 0.1); color: #db2777; border: none;" onclick="event.stopPropagation(); openWeblio()">
                        <i data-lucide="search" style="width: 20px; height: 20px;"></i> Weblio (N)
                    </button>
                </div>
                <p style="margin-top: 20px; font-size: 0.8rem; opacity: 0.6;">Tap to flip</p>
            </div>
        `;
    } else {
        // Back: Japanese + Ghost English
        cardContent = `
            <div class="card-face fade-in">
                <p style="font-size: 0.9rem; color: #6b7280; margin-bottom: 10px;">JAPANESE</p>
                <h2 class="word-main" style="color: var(--accent-primary);">${card.ja}</h2>
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <p class="word-sub" style="margin: 0;">${card.en}</p>
                    <button class="btn btn-glass" style="width: auto; padding: 4px; border-radius: 50%; background: transparent; color: var(--text-secondary); border: none;" onclick="event.stopPropagation(); speakWord()">
                        <i data-lucide="volume-2" style="width: 16px; height: 16px;"></i>
                    </button>
                </div>
                <div style="margin-top: 15px; font-size: 0.75rem; color: var(--accent-warning); background: rgba(245, 158, 11, 0.1); padding: 4px 10px; border-radius: 12px;">
                    Priority: ${card.priority}
                </div>
            </div>
        `;
    }

    // Controls: Always visible, but disabled if not flipped
    const isDisabled = !state.isFlipped ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : '';
    const unknownStyle = !state.isFlipped ? 'opacity: 0.5; cursor: not-allowed;' : '';
    const nextStyle = !state.isFlipped ? 'background: #9ca3af; cursor: not-allowed;' : 'background: var(--accent-success);';

    // Settings Modal
    const settingsModal = state.settings.showSettings ? `
        <div class="settings-modal fade-in" onclick="toggleSettings()">
            <div class="settings-content" onclick="event.stopPropagation()">
                <h3>Settings</h3>
                
                <div class="setting-row">
                    <label>Speech Volume</label>
                    <input type="range" min="0" max="1" step="0.1" value="${state.settings.speechVol}" oninput="updateSetting('speechVol', this.value)">
                </div>
                
                <div class="setting-row">
                    <label>SE Volume</label>
                    <input type="range" min="0" max="2" step="0.1" value="${state.settings.sfxVol}" oninput="updateSetting('sfxVol', this.value)">
                </div>

                <div class="setting-row">
                    <label>Auto-Play Speech</label>
                    <input type="checkbox" ${state.settings.autoPlay ? 'checked' : ''} onchange="updateSetting('autoPlay', this.checked)">
                </div>

                <button class="btn btn-primary" onclick="toggleSettings()" style="margin-top: 20px;">Close</button>
            </div>
        </div>
    ` : '';

    container.innerHTML = `
        <button class="back-btn" onclick="navigate('HOME')">
            <i data-lucide="arrow-left"></i>
        </button>
        
        <button class="settings-btn" onclick="toggleSettings()">
             <i data-lucide="settings"></i>
        </button>

        <div class="session-count"># ${state.sessionCount}</div>

        <div class="card-scene">
            <div class="card" onclick="handleCardClick()" oncontextmenu="return false;">
                ${cardContent}
            </div>
        </div>

        <div class="controls">
            <button class="btn btn-circle btn-unknown" onclick="if(state.isFlipped) handleResult(false)" ${isDisabled}>
                <i data-lucide="help-circle" style="width: 32px; height: 32px;"></i>
            </button>
            <button class="btn btn-next" style="width: auto; padding-left: 40px; padding-right: 40px; ${nextStyle}" onclick="if(state.isFlipped) handleResult(true)" ${isDisabled}>
                NEXT <i data-lucide="arrow-right"></i>
            </button>
        </div>
        ${settingsModal}
    `;
    app.appendChild(container);

    // Auto-Play Speech (Moved here to ensure it runs after render)
    // Only play if showing front and autoPlay is on
    if (!state.isFlipped && state.settings.autoPlay) {
        setTimeout(() => speakWord(), 400); // Wait for transition
    }
}

function toggleSettings() {
    state.settings.showSettings = !state.settings.showSettings;
    render();
}

function updateSetting(key, value) {
    if (key === 'autoPlay') {
        state.settings[key] = value;
    } else {
        state.settings[key] = parseFloat(value);
    }
    saveSettings();
    // Re-render isn't strictly necessary for sliders but good for value feedback if we added text
}

function renderList() {
    const container = document.createElement('div');
    container.className = 'view-container fade-in';

    // Filter Unknowns
    let targets = state.cards.filter(c => c.errors > 0);

    // Sort
    const sortedCards = sortCards(targets, state.sortModeList);

    // Dropdown HTML
    const sortSelect = `
        <div style="margin-bottom: 15px; display: flex; justify-content: flex-end;">
            <select onchange="setSortMode(this.value, 'LIST')" 
                style="background: rgba(255,255,255,0.1); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 8px;">
                <option value="ADDED" ${state.sortModeList === 'ADDED' ? 'selected' : ''}>追加した順</option>
                <option value="ALPHA" ${state.sortModeList === 'ALPHA' ? 'selected' : ''}>アルファベット順</option>
                <option value="PRIORITY" ${state.sortModeList === 'PRIORITY' ? 'selected' : ''}>優先度順</option>
            </select>
        </div>
    `;

    const listHtml = sortedCards.length > 0 ? sortedCards.map(c => `
        <div class="list-item">
            <div>
                <div style="font-weight: 700; color: var(--text-primary);">${c.en}</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">${c.ja}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <div class="error-badge">${c.errors} Misses</div>
                <button class="btn btn-glass" style="width: auto; padding: 6px; border-radius: 50%; color: var(--text-secondary); border: none;" onclick="removeUnknown('${c.id}')" title="Remove from list">
                    <i data-lucide="x" style="width: 14px; height: 14px;"></i>
                </button>
            </div>
        </div>
    `).join('') : '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">No mistakes yet! Good job.</div>';

    container.innerHTML = `
        <button class="back-btn" onclick="navigate('HOME')">
            <i data-lucide="arrow-left"></i> Back
        </button>
        <div class="title-header" style="margin-bottom: 20px;">
            <h2>Unknown List</h2>
            <p>Focus on these words</p>
        </div>
        
        ${sortSelect}
        
        ${sortedCards.length > 0 ? `
            <div style="text-align: center; margin-bottom: 20px;">
                <button class="btn btn-glass" style="background: rgba(239, 68, 68, 0.1); color: var(--accent-danger); border: 1px solid var(--accent-danger); display: inline-flex; width: auto;" onclick="resetUnknowns()">
                    <i data-lucide="trash-2"></i> Reset List
                </button>
            </div>
        ` : ''}

        <div class="list-container">
            ${listHtml}
        </div>
    `;
    app.appendChild(container);
}

function resetUnknowns() {
    if (confirm("Are you sure you want to clear the Unknown List? This will reset the error count for all words.")) {
        state.cards = state.cards.map(c => ({ ...c, errors: 0 }));
        saveCards();
        render();
    }
}

function removeUnknown(id) {
    const card = state.cards.find(c => c.id === id);
    if (card) {
        card.errors = 0; // Reset error count to remove from list
        saveCards();
        render();
    }
}

function setFilterMode(mode) {
    state.filterModeAllList = mode;
    render();
}

function renderAllList() {
    const container = document.createElement('div');
    container.className = 'view-container fade-in';

    // Filter logic
    let targets = [...state.cards];
    if (state.filterModeAllList === 'ACTIVE') {
        targets = targets.filter(c => !c.archived);
    } else if (state.filterModeAllList === 'ARCHIVED') {
        targets = targets.filter(c => c.archived);
    }

    if (state.searchQueryAllList) {
        const query = state.searchQueryAllList.toLowerCase();
        targets = targets.filter(c =>
            c.en.toLowerCase().includes(query) ||
            c.ja.toLowerCase().includes(query)
        );
    }
    const sortedCards = sortCards(targets, state.sortModeAllList);

    // Filter/Search Header
    const listHeader = `
        <div style="margin-bottom: 15px; display: flex; flex-direction: column; gap: 10px;">
            <div class="search-input-wrapper">
                <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--text-secondary);"></i>
                <input type="text" placeholder="Search words..." value="${state.searchQueryAllList}" oninput="handleSearchAllList(this.value)" 
                    style="width: 100%; padding: 10px 10px 10px 38px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: var(--text-primary);">
            </div>
            <div style="display: flex; gap: 8px; justify-content: space-between;">
                <select onchange="setFilterMode(this.value)" 
                    style="flex: 1; background: rgba(255,255,255,0.1); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.2); padding: 6px 8px; border-radius: 8px; font-size: 0.85rem;">
                    <option value="ACTIVE" ${state.filterModeAllList === 'ACTIVE' ? 'selected' : ''}>出す単語のみ</option>
                    <option value="ARCHIVED" ${state.filterModeAllList === 'ARCHIVED' ? 'selected' : ''}>出さない単語のみ</option>
                    <option value="ALL" ${state.filterModeAllList === 'ALL' ? 'selected' : ''}>すべて表示</option>
                </select>
                <select onchange="setSortMode(this.value, 'ALL_LIST')" 
                    style="flex: 1; background: rgba(255,255,255,0.1); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.2); padding: 6px 8px; border-radius: 8px; font-size: 0.85rem;">
                    <option value="ADDED" ${state.sortModeAllList === 'ADDED' ? 'selected' : ''}>追加した順</option>
                    <option value="ALPHA" ${state.sortModeAllList === 'ALPHA' ? 'selected' : ''}>アルファベット順</option>
                    <option value="PRIORITY" ${state.sortModeAllList === 'PRIORITY' ? 'selected' : ''}>優先度高い順</option>
                    <option value="PRIORITY_ASC" ${state.sortModeAllList === 'PRIORITY_ASC' ? 'selected' : ''}>優先度低い順</option>
                </select>
            </div>
        </div>
    `;

    const listHtml = sortedCards.length > 0 ? sortedCards.map(c => `
        <div class="list-item">
            <div>
                <div style="font-weight: 700; color: var(--text-primary);">${c.en}</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">
                    ${c.ja} <span style="font-size: 0.75rem; color: var(--accent-warning); margin-left: 8px;">(P: ${c.priority})</span>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <button class="btn btn-glass" style="width: auto; padding: 6px; background: ${c.archived ? 'var(--accent-primary)' : 'rgba(99, 102, 241, 0.1)'}; color: ${c.archived ? 'white' : 'var(--accent-primary)'}; border: none;" onclick="toggleArchive('${c.id}')" title="${c.archived ? '解禁して出す' : 'もう出さない'}">
                    <i data-lucide="${c.archived ? 'eye' : 'eye-off'}" style="width: 16px; height: 16px;"></i>
                </button>
                <button class="btn btn-glass" style="width: auto; padding: 6px; background: rgba(245, 158, 11, 0.1); color: var(--accent-warning); border: none;" onclick="resetPriority('${c.id}')" title="Reset Priority">
                    <i data-lucide="refresh-cw" style="width: 16px; height: 16px;"></i>
                </button>
                <button class="btn btn-glass" style="width: auto; padding: 6px; background: rgba(239, 68, 68, 0.1); color: var(--accent-danger); border: none;" onclick="deleteCard('${c.id}')">
                    <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                </button>
            </div>
        </div>
    `).join('') : '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">No cards yet. Add some!</div>';

    container.innerHTML = `
        <button class="back-btn" onclick="navigate('HOME')">
            <i data-lucide="arrow-left"></i> Back
        </button>
        <div class="title-header" style="margin-bottom: 20px;">
            <h2>Word List</h2>
            <p>${state.cards.length} cards Total</p>
        </div>

        ${listHeader}
        
        ${state.cards.length > 0 ? `
            <div style="text-align: center; margin-bottom: 20px; display: flex; gap: 10px; justify-content: center;">
                <button class="btn btn-glass" style="background: rgba(245, 158, 11, 0.1); color: var(--accent-warning); border: 1px solid var(--accent-warning); display: inline-flex; width: auto;" onclick="resetAllPriorities()">
                    <i data-lucide="refresh-cw"></i> Reset Priorities
                </button>
                <button class="btn btn-glass" style="background: rgba(239, 68, 68, 0.1); color: var(--accent-danger); border: 1px solid var(--accent-danger); display: inline-flex; width: auto;" onclick="deleteAllCards()">
                    <i data-lucide="trash-2"></i> Delete All Words
                </button>
            </div>
        ` : ''}

        <div class="list-container">
            ${listHtml}
        </div>
    `;
    app.appendChild(container);
}

function deleteCard(id) {
    if (confirm("Delete this card?")) {
        state.cards = state.cards.filter(c => c.id !== id);
        saveCards();
        render();
    }
}

function deleteAllCards() {
    if (confirm("DANGER: This will delete ALL cards! Are you sure?")) {
        state.cards = [];
        saveCards();
        render();
    }
}

function resetAllPriorities() {
    if (confirm("Reset all priorities to default (20)?")) {
        state.cards = state.cards.map(c => ({ ...c, priority: 20 }));
        saveCards();
        render();
    }
}

function resetPriority(id) {
    const card = state.cards.find(c => c.id === id);
    if (card) {
        card.priority = 20;
        saveCards();
        render();
    }
}

function toggleArchive(id) {
    const card = state.cards.find(c => c.id === id);
    if (card) {
        card.archived = !card.archived;
        saveCards();
        render();
    }
}

function handleSearchAllList(query) {
    state.searchQueryAllList = query;
    render();
    // Re-focus the search input after render
    const input = document.querySelector('.search-input-wrapper input');
    if (input) {
        input.focus();
        input.setSelectionRange(query.length, query.length);
    }
}

// Add View
function renderAdd() {
    const container = document.createElement('div');
    container.className = 'view-container fade-in';

    container.innerHTML = `
        <button class="back-btn" onclick="navigate('HOME')">
            <i data-lucide="arrow-left"></i> Back
        </button>
        <div class="title-header" style="margin-bottom: 20px;">
            <h2>Add New Word</h2>
        </div>
        
        <div style="background: var(--card-bg); padding: 24px; border-radius: 20px; box-shadow: var(--shadow-lg); width: 100%;">
            <!-- Single Add -->
            <form id="single-add-form" onsubmit="event.preventDefault(); submitAdd();">
                <div class="input-group">
                    <label>English Word</label>
                    <input type="text" id="input-en" placeholder="e.g. Serendipity" onkeyup="handleInputEn(this.value)" autocomplete="off">
                    
                    <!-- Suggestions Area -->
                    <div id="suggestion-area" class="suggestion-box" style="display: none;"></div>

                    <!-- Dictionary Search Helpers -->
                    <div id="dict-search-area" style="display: flex; gap: 8px; margin-top: 8px; opacity: 0.5; pointer-events: none; transition: opacity 0.3s;">
                        <span style="font-size: 0.8rem; color: var(--text-secondary); align-self: center;">Search Meaning:</span>
                        <button type="button" class="btn-micro" onclick="openSearch('weblio')">Weblio</button>
                        <button type="button" class="btn-micro" onclick="openSearch('google')">Google</button>
                        <button type="button" class="btn-micro" onclick="openSearch('eijiro')">Alc</button>
                    </div>
                </div>

                <div class="input-group">
                    <label>Japanese Meaning</label>
                    <input type="text" id="input-ja" placeholder="e.g. 思いがけない幸運">
                </div>
                <button type="submit" class="btn btn-primary">
                    <i data-lucide="plus"></i> Add Single
                </button>
            </form>

            <div class="divider">OR</div>

            <!-- Bulk Add -->
            <div class="input-group">
                <label>Bulk Import (AI Table)</label>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px;">
                    Paste a list of "English [Tab/Comma] Japanese". Works with Excel/Sheet copies or Chat AI outputs.
                </div>
                <textarea id="input-bulk" class="bulk-area" placeholder="Apple    りんご&#10;Banana   バナナ&#10;Dog, 犬"></textarea>
                <button class="btn btn-glass" style="background: var(--accent-primary); color: white;" onclick="submitBulk()">
                    <i data-lucide="upload"></i> Import Bulk List
                </button>
            </div>
        </div>
    `;
    app.appendChild(container);
}

// Debounce Timer
let searchTimer = null;

function handleInputEn(text) {
    updateSearchLinks(text);

    // API Debounce
    clearTimeout(searchTimer);
    if (!text || text.trim().length < 2) {
        document.getElementById('suggestion-area').style.display = 'none';
        return;
    }

    searchTimer = setTimeout(() => {
        fetchTranslation(text);
    }, 600);
}

async function fetchTranslation(text) {
    const box = document.getElementById('suggestion-area');
    const word = text.trim();

    try {
        // Switch to MyMemory API (Better CORS support)
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|ja`);
        if (response.ok) {
            const data = await response.json();
            const ja = data.responseData.translatedText;

            if (ja && ja.trim() && ja.toLowerCase() !== word.toLowerCase()) {
                box.innerHTML = `
                    <div class="suggestion-item" onclick="applySuggestion('${ja.replace(/'/g, "\\'")}')">
                        <span style="font-weight: 600;">${word}</span>
                        <span style="color: var(--text-secondary); margin-left: 8px;">${ja}</span>
                        <span style="font-size: 0.7rem; color: #9ca3af; margin-left: auto;">MyMemory</span>
                    </div>
                `;
                box.style.display = 'block';
            } else {
                box.style.display = 'none';
            }
        }
    } catch (e) {
        console.error("Dictionary API Error:", e);
        // Silent fail or minimal UI
        box.style.display = 'none';
    }
}

// Legacy function removed, logic moved to fetchTranslation
function updateSuggestions(text) {
    // No-op or removed, keeping this stub to avoid reference errors if called elsewhere, 
    // though 'handleInputEn' is the main entry point now.
}

function applySuggestion(ja) {
    const inputJa = document.getElementById('input-ja');
    inputJa.value = ja;
    // Hide suggestions
    document.getElementById('suggestion-area').style.display = 'none';

    // Optional: Visual feedback
    inputJa.style.borderColor = 'var(--accent-success)';
    setTimeout(() => {
        inputJa.style.borderColor = '#e5e7eb';
    }, 500);
}

function updateSearchLinks(text) {
    const area = document.getElementById('dict-search-area');
    if (text.trim().length > 0) {
        area.style.opacity = '1';
        area.style.pointerEvents = 'auto';
    } else {
        area.style.opacity = '0.5';
        area.style.pointerEvents = 'none';
    }
}

function openSearch(service) {
    const word = document.getElementById('input-en').value.trim();
    if (!word) return;

    let url = '';
    switch (service) {
        case 'weblio':
            url = `https://ejje.weblio.jp/content/${encodeURIComponent(word)}`;
            break;
        case 'google':
            url = `https://translate.google.com/?sl=en&tl=ja&text=${encodeURIComponent(word)}&op=translate`;
            break;
        case 'eijiro':
            url = `https://eow.alc.co.jp/search?q=${encodeURIComponent(word)}`;
            break;
    }
    window.open(url, '_blank');
}

function submitAdd() {
    const en = document.getElementById('input-en').value;
    const ja = document.getElementById('input-ja').value;
    if (en && ja) {
        addCard(en, ja);
    }
}

function submitBulk() {
    const raw = document.getElementById('input-bulk').value;
    if (!raw.trim()) return;

    const lines = raw.split('\n');
    let addedCount = 0;

    lines.forEach(line => {
        if (!line.trim()) return;
        // Split by Tab, Comma, or " - "
        const parts = line.split(/,|\t| - |：/);
        if (parts.length >= 2) {
            const en = parts[0].trim();
            const ja = parts.slice(1).join(',').trim(); // Join rest
            if (en && ja) {
                if (addCard(en, ja, true)) {
                    addedCount++;
                }
            }
        }
    });

    if (addedCount > 0) {
        alert(`Successfully imported ${addedCount} words!`);
        navigate('HOME');
    } else {
        alert('No valid words found. Check format.');
    }
}

// Start
init();
