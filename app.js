// Velora Android - WebSocket version
const REMOTE_URL = 'wss://vdffd-production.up.railway.app';

// State
let wsSocket = null;
let currentUser = null;
let currentChat = null;
let currentChatType = null;
let myChats = [];
let privateChats = {};
let chatMessages = {};
let searchResults = { users: [], chats: [] };
let selectedColor = '#a855f7';
let isLoginMode = true;
let soundEnabled = true;
let mediaRecorder = null;
let audioChunks = [];
let isRecordingVoice = false;
let circleStream = null;
let selectedMic = '';
let selectedCamera = '';
let newChatAvatarData = '';
let replyingTo = null;
let viewingUser = null;
let searchTimeout = null;
let currentTheme = 'dark';
let currentFontSize = 'medium';

const colors = ['#a855f7', '#ec4899', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f59e0b', '#6366f1'];

const gifts = [
    { id: 'heart', name: 'Сердечко', emoji: 'H', price: 5, anim: 'pulse' },
    { id: 'fire', name: 'Огонь', emoji: 'F', price: 8, anim: 'burn' },
    { id: 'star', name: 'Звезда', emoji: 'S', price: 15, anim: 'spin' },
    { id: 'kiss', name: 'Поцелуй', emoji: 'K', price: 12, anim: 'pulse' },
    { id: 'rose', name: 'Роза', emoji: 'R', price: 20, anim: 'float' },
    { id: 'crown', name: 'Корона', emoji: 'C', price: 50, anim: 'shine' },
    { id: 'diamond', name: 'Алмаз', emoji: 'D', price: 100, anim: 'shine' },
    { id: 'rocket', name: 'Ракета', emoji: 'X', price: 60, anim: 'fly' },
    { id: 'rainbow', name: 'Радуга', emoji: 'W', price: 45, anim: 'rainbow' },
    { id: 'cake', name: 'Торт', emoji: 'T', price: 25, anim: 'float' },
    { id: 'cat', name: 'Котик', emoji: 'M', price: 15, anim: 'bounce' },
    { id: 'gift', name: 'Подарок', emoji: 'G', price: 35, anim: 'shake' }
];

const premiumFeatures = [
    { id: 'no_ads', name: 'Без рекламы', desc: 'Никакой рекламы', icon: 'X', works: true },
    { id: 'animated_avatar', name: 'Анимированный аватар', desc: 'GIF аватарка', icon: 'A', works: true },
    { id: 'voice_to_text', name: 'Голос в текст', desc: 'Расшифровка голосовых', icon: 'V', works: true },
    { id: 'translate', name: 'Переводчик', desc: 'Перевод сообщений', icon: 'T', works: true },
    { id: 'read_receipts', name: 'Прочитано', desc: 'Кто прочитал', icon: 'R', works: true },
    { id: 'themes', name: 'Темы', desc: 'Эксклюзивные темы', icon: 'P', works: true },
    { id: 'profile_badge', name: 'Бейдж Premium', desc: 'Звезда у имени', icon: '*', works: true },
    { id: 'double_crystals', name: 'x2 Кристаллы', desc: 'Двойные кристаллы', icon: '2', works: true },
    { id: 'gift_discount', name: 'Скидка -20%', desc: 'На подарки', icon: '%', works: true }
];

// Window controls - disabled for Android
window.minimize = () => {};
window.maximize = () => {};
window.closeApp = () => {};

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initColors();
    initAdminActions();
    initGifts();
    const form = document.getElementById('auth-form');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); submitAuth(); });
    document.addEventListener('keypress', e => {
        if (e.key === 'Enter' && e.target.id === 'message-text') window.sendMessage();
    });
    document.addEventListener('click', e => {
        if (e.target.classList.contains('modal')) window.closeModal();
        if (!e.target.closest('.popup-menu') && !e.target.closest('.btn-attach')) hideEl('attach-menu');
        if (!e.target.closest('.context-menu')) hideEl('message-menu');
    });
    tryAutoLogin();
});

function tryAutoLogin() {
    const token = localStorage.getItem('velora_session_token');
    const username = localStorage.getItem('velora_username');
    if (token && username) {
        showError('Автовход...');
        connectToServer(
            () => send({ type: 'auto_login', token, username }),
            (msg) => handleMessage(msg),
            (err) => showError('')
        );
    }
}

function loadSettings() {
    const theme = localStorage.getItem('velora_theme') || 'dark';
    const fontSize = localStorage.getItem('velora_fontsize') || 'medium';
    if (theme !== 'dark') document.querySelector('.app')?.classList.add('theme-' + theme);
    if (fontSize !== 'medium') document.body.classList.add('font-' + fontSize);
}

function initColors() {
    const c = document.getElementById('accent-colors');
    if (c) c.innerHTML = colors.map(col => 
        `<button type="button" class="color-btn ${col===selectedColor?'active':''}" style="background:${col}" onclick="window.selectColor('${col}')"></button>`
    ).join('');
}

function initGifts() {
    const g = document.getElementById('gifts-grid');
    if (g) g.innerHTML = gifts.map(gift => {
        const discount = currentUser?.premium ? Math.floor(gift.price * 0.8) : gift.price;
        return `<div class="gift-item anim-${gift.anim}" onclick="window.buyGift('${gift.id}')">
            <span class="gift-emoji">${gift.emoji}</span>
            <span class="gift-name">${gift.name}</span>
            <span class="gift-price">${discount} cr</span>
        </div>`;
    }).join('');
}

function initAdminActions() {
    const actions = [
        ['freeze', 'Заморозить'], ['unfreeze', 'Разморозить'], ['delete', 'Удалить'],
        ['ban', 'Забанить'], ['unban', 'Разбанить'],
        ['give_premium', 'Выдать Premium'], ['remove_premium', 'Убрать Premium'],
        ['give_crystals', 'Выдать кристаллы'], ['verify', 'Верифицировать'], ['unverify', 'Снять верификацию']
    ];
    const el = document.getElementById('admin-actions');
    if (el) el.innerHTML = actions.map(([a, t]) => `<button onclick="window.adminAction('${a}')">${t}</button>`).join('');
}

// NFT Uses
let selectedNftCount = 0;
window.setNftCount = (count) => {
    selectedNftCount = count;
    document.querySelectorAll('.nft-count-btn').forEach((btn, i) => btn.classList.toggle('active', i + 1 === count));
    const container = document.getElementById('nft-aliases-inputs');
    let html = '';
    for (let i = 0; i < count; i++) html += `<div class="nft-alias-input"><input type="text" id="nft-alias-${i}" placeholder="@username ${i + 1}"></div>`;
    container.innerHTML = html;
    container.style.display = 'block';
    document.getElementById('nft-give-btn').style.display = 'block';
};

window.giveNftWithAliases = () => {
    const username = document.getElementById('admin-username')?.value.trim().replace('@', '');
    if (!username) { showToast('Введите @username'); return; }
    const aliases = [];
    for (let i = 0; i < selectedNftCount; i++) {
        const alias = document.getElementById(`nft-alias-${i}`)?.value.trim().toLowerCase().replace('@', '');
        if (alias && alias.length >= 3) aliases.push(alias);
    }
    if (aliases.length === 0) { showToast('Введите хотя бы один @username'); return; }
    send({ type: 'admin_give_nft', target: username, aliases: aliases });
    showToast('Выдаём NFT Uses...');
};

window.selectColor = (c) => {
    selectedColor = c;
    document.querySelectorAll('.color-btn').forEach(b => b.classList.toggle('active', b.style.background === c));
};

// Auth
window.switchTab = (tab) => {
    isLoginMode = (tab === 'login');
    document.querySelectorAll('.tab')[0]?.classList.toggle('active', isLoginMode);
    document.querySelectorAll('.tab')[1]?.classList.toggle('active', !isLoginMode);
    const rf = document.getElementById('register-fields');
    if (rf) rf.style.display = isLoginMode ? 'none' : 'block';
    const ab = document.getElementById('auth-btn');
    if (ab) ab.textContent = isLoginMode ? 'Войти' : 'Создать аккаунт';
    showError('');
};

function submitAuth() {
    const username = document.getElementById('username')?.value.trim().toLowerCase();
    const password = document.getElementById('password')?.value;
    if (!username || !password) { showError('Заполните все поля'); return; }
    if (!isLoginMode) {
        const p2 = document.getElementById('password2')?.value;
        if (p2 !== password) { showError('Пароли не совпадают'); return; }
    }
    showError('Подключение...');
    disconnectFromServer();
    connectToServer(
        () => {
            showError('');
            if (isLoginMode) send({ type: 'login', username, password });
            else {
                const displayName = document.getElementById('displayname')?.value.trim() || username;
                send({ type: 'register', username, password, display_name: displayName, avatar_color: selectedColor });
            }
        },
        (msg) => handleMessage(msg),
        (err) => showError('Ошибка подключения')
    );
}

// Helpers
function showError(msg) { const e = document.getElementById('auth-error'); if(e) e.textContent = msg; }

function send(data) {
    if (wsSocket && wsSocket.readyState === 1) {
        wsSocket.send(JSON.stringify(data));
    }
}

function connectToServer(onConnect, onData, onError) {
    try {
        wsSocket = new WebSocket(REMOTE_URL);
        wsSocket.onopen = () => onConnect();
        wsSocket.onmessage = (event) => {
            try { onData(JSON.parse(event.data)); } catch(e) {}
        };
        wsSocket.onerror = (err) => onError(err);
        wsSocket.onclose = () => console.log('Disconnected');
    } catch(e) {
        onError(e);
    }
}

function disconnectFromServer() {
    if (wsSocket) { wsSocket.close(); wsSocket = null; }
}

function showEl(id) { const e = document.getElementById(id); if(e) e.style.display = 'flex'; }
function hideEl(id) { const e = document.getElementById(id); if(e) e.style.display = 'none'; }
function esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }

function showToast(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function playSound() {
    if (!soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
    } catch(e) {}
}

function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const s = document.getElementById(name + '-screen');
    if (s) s.style.display = 'flex';
}

window.closeModal = () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
window.backToSettings = () => { window.closeModal(); showEl('main-settings'); };


// Handle messages from server
function handleMessage(msg) {
    console.log('MSG:', msg.type);
    
    if (msg.type === 'register_response' || msg.type === 'login_response') {
        if (msg.success) {
            currentUser = msg.user;
            showScreen('chat');
            updateProfile();
            updateSupportButtons();
            const adminBtn = document.getElementById('admin-btn');
            if (adminBtn) adminBtn.style.display = currentUser.username === 'maloy' ? 'block' : 'none';
            showToast('Добро пожаловать!');
        } else showError(msg.error || 'Ошибка');
    }
    else if (msg.type === 'auto_login_response') {
        if (msg.success) {
            currentUser = msg.user;
            showScreen('chat');
            updateProfile();
            updateSupportButtons();
            const adminBtn = document.getElementById('admin-btn');
            if (adminBtn) adminBtn.style.display = currentUser.username === 'maloy' ? 'block' : 'none';
        } else {
            localStorage.removeItem('velora_session_token');
            localStorage.removeItem('velora_username');
        }
    }
    else if (msg.type === 'session_token') {
        localStorage.setItem('velora_session_token', msg.token);
        localStorage.setItem('velora_username', msg.username);
    }
    else if (msg.type === 'private_chats') {
        renderPrivateChatsList(msg.chats || []);
    }
    else if (msg.type === 'support_sent') {
        window.closeModal();
        showToast('Отправлено в поддержку!');
    }
    else if (msg.type === 'my_aliases') {
        renderMyAliases(msg.aliases || [], msg.nft_uses || 0, msg.available || 0);
    }
    else if (msg.type === 'support_messages') {
        supportMessages = msg.messages || [];
        renderSupportMessages();
    }
    else if (msg.type === 'support_tickets') {
        supportTickets = msg.tickets || [];
        renderSupportInbox();
    }
    else if (msg.type === 'ticket_messages') {
        renderConversationMessages(msg.messages || []);
    }
    else if (msg.type === 'support_reply_received') {
        supportMessages.push({ from: msg.from, text: msg.text, time: msg.time, is_mine: false });
        renderSupportMessages();
        playSound();
        showToast('Ответ от поддержки!');
    }
    else if (msg.type === 'private_message') {
        const cid = msg.from === currentUser.username ? msg.to : msg.from;
        if (!privateChats[cid]) privateChats[cid] = [];
        privateChats[cid].push(msg);
        if (currentChat === cid && currentChatType === 'private') renderMessages();
        if (msg.from !== currentUser.username) playSound();
    }
    else if (msg.type === 'private_history') {
        privateChats[msg.with] = msg.messages || [];
        if (currentChat === msg.with && currentChatType === 'private') renderMessages();
    }
    else if (msg.type === 'search_results') {
        searchResults = msg.results || { users: [], chats: [] };
        renderSearchResults();
    }
    else if (msg.type === 'crystals_update') {
        currentUser.crystals = msg.crystals;
        updateCrystals();
    }
    else if (msg.type === 'profile_updated') {
        if (msg.success) { currentUser = msg.user; updateProfile(); window.closeModal(); showToast('Сохранено'); }
    }
    else if (msg.type === 'user_profile') {
        showUserProfileData(msg.user);
    }
    else if (msg.type === 'admin_response') {
        showToast(msg.message || 'Выполнено');
    }
    else if (msg.type === 'admin_stats') {
        renderAdminStats(msg);
    }
    else if (msg.type === 'reaction_added') {
        const msgs = currentChatType === 'private' ? privateChats[currentChat] : chatMessages[currentChat];
        if (msgs) {
            const m = msgs.find(x => x.id === msg.message_id);
            if (m) {
                if (!m.reactions) m.reactions = {};
                for (const emoji in m.reactions) {
                    m.reactions[emoji] = m.reactions[emoji].filter(u => u !== msg.username);
                    if (m.reactions[emoji].length === 0) delete m.reactions[emoji];
                }
                if (!m.reactions[msg.emoji]) m.reactions[msg.emoji] = [];
                m.reactions[msg.emoji].push(msg.username);
                renderMessages();
            }
        }
    }
    else if (msg.type === 'premium_activated') {
        currentUser.premium = true;
        updateProfile();
        showToast('Premium активирован! 🎉');
        window.closeModal();
    }
    else if (msg.type === 'premium_request_received') {
        playSound();
        showToast('Новая заявка на Premium от @' + msg.username);
    }
    else if (msg.type === 'premium_requests') {
        renderPremiumRequests(msg.requests || []);
    }
}

// Render chats
function renderChats() { renderPrivateChatsList(privateChatsList); }

window.openPrivateChat = (username) => {
    currentChat = username;
    currentChatType = 'private';
    document.getElementById('chat-title').textContent = username;
    document.getElementById('chat-subtitle').textContent = 'Личные сообщения';
    document.getElementById('chat-avatar').textContent = username[0].toUpperCase();
    document.getElementById('chat-avatar').style.background = '#667eea';
    send({ type: 'get_private_history', with: username });
    hideEl('empty-chat'); showEl('chat-content');
    hideEl('search-results'); showEl('chats-list');
    document.getElementById('search-input').value = '';
    renderMessages();
};

// Search
window.doSearch = () => {
    const q = document.getElementById('search-input')?.value.trim().replace('@', '');
    if (searchTimeout) clearTimeout(searchTimeout);
    if (q && q.length >= 1) {
        showEl('search-results'); hideEl('chats-list');
        document.getElementById('search-results').innerHTML = '<div class="empty">Поиск...</div>';
        searchTimeout = setTimeout(() => send({ type: 'search', query: q }), 150);
    } else { hideEl('search-results'); showEl('chats-list'); }
};

window.clearSearch = () => {
    document.getElementById('search-input').value = '';
    hideEl('search-results'); showEl('chats-list');
};

function renderSearchResults() {
    const c = document.getElementById('search-results');
    if (!c) return;
    let html = '';
    if (searchResults.users?.length > 0) {
        html += '<div class="section-title">ПОЛЬЗОВАТЕЛИ</div>';
        searchResults.users.forEach(u => {
            if (u.is_deleted) return;
            const verified = u.is_verified ? ' ✓' : '';
            const creator = u.username === 'maloy' ? ' ⭐' : '';
            const premium = u.premium ? ' 💎' : '';
            html += `<div class="user-item" onclick="window.showUserProfile('${u.username}')">
                <div class="avatar" style="background:${u.avatar_color||'#a855f7'}">${(u.display_name||u.username)[0].toUpperCase()}</div>
                <div class="user-info"><div class="user-name">${esc(u.display_name||u.username)}${creator}${premium}${verified}</div>
                <div class="user-status">@${u.username}</div></div></div>`;
        });
    }
    if (!html) html = '<div class="empty">Ничего не найдено</div>';
    c.innerHTML = html;
}

// Messages
function renderMessages() {
    const c = document.getElementById('messages');
    if (!c) return;
    const msgs = currentChatType === 'private' ? (privateChats[currentChat] || []) : [];
    c.innerHTML = msgs.map(m => {
        const isOwn = m.from === currentUser.username;
        const creator = m.from === 'maloy' ? '<span class="creator-star">⭐</span>' : '';
        const time = m.time ? new Date(m.time).toLocaleTimeString('ru', {hour:'2-digit',minute:'2-digit'}) : '';
        let reactHtml = '';
        if (m.reactions && Object.keys(m.reactions).length) {
            reactHtml = '<div class="reactions">' + Object.entries(m.reactions).map(([e,u]) => 
                `<span class="reaction" onclick="window.addReaction(${m.id},'${e}')">${e}${u.length}</span>`).join('') + '</div>';
        }
        return `<div class="message ${isOwn?'own':''}" onclick="window.showMsgMenu(event,${m.id},'${esc(m.from)}','${esc((m.text||'').replace(/'/g,"\\'"))}',${isOwn})">
            <div class="avatar" style="background:${m.avatar_color||'#667eea'}">${(m.from||'U')[0].toUpperCase()}</div>
            <div class="message-content"><div class="message-author">${esc(m.from)}${creator}</div>
            <div class="message-text">${esc(m.text)}</div>${reactHtml}<div class="message-time">${time}</div></div></div>`;
    }).join('');
    c.scrollTop = c.scrollHeight;
}

window.showMsgMenu = (e, id, from, text, isOwn) => {
    e.preventDefault();
    const menu = document.getElementById('message-menu');
    menu.style.display = 'block';
    menu.dataset.msgId = id;
    menu.dataset.from = from;
    menu.dataset.text = text;
};

window.hideMessageMenu = () => hideEl('message-menu');
window.menuReply = () => { hideEl('message-menu'); };
window.menuDelete = () => { hideEl('message-menu'); };
window.menuReaction = (emoji) => {
    const menu = document.getElementById('message-menu');
    send({ type: 'add_reaction', message_id: parseInt(menu.dataset.msgId), chat_id: currentChat, emoji, is_private: currentChatType === 'private' });
    hideEl('message-menu');
};
window.addReaction = (msgId, emoji) => {
    send({ type: 'add_reaction', message_id: msgId, chat_id: currentChat, emoji, is_private: currentChatType === 'private' });
};

// Send message
window.sendMessage = () => {
    const inp = document.getElementById('message-text');
    const txt = inp?.value.trim();
    if (!txt || !currentChat) return;
    if (currentChatType === 'private') send({ type: 'private_message', to: currentChat, text: txt });
    inp.value = '';
};

// Profile
function updateProfile() {
    if (!currentUser) return;
    const letter = (currentUser.display_name || currentUser.username || 'U')[0].toUpperCase();
    ['settings-avatar', 'edit-avatar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = letter; el.style.background = currentUser.avatar_color || '#a855f7'; }
    });
    const nameEl = document.getElementById('settings-name');
    if (nameEl) nameEl.textContent = currentUser.display_name || currentUser.username;
    const userEl = document.getElementById('settings-username');
    if (userEl) userEl.textContent = '@' + currentUser.username;
    updateCrystals();
}

function updateCrystals() {
    const cr = currentUser?.crystals || 0;
    ['my-crystals'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = cr; });
}

window.showUserProfile = (username) => {
    viewingUser = username;
    send({ type: 'get_user_profile', username });
};

function showUserProfileData(user) {
    if (!user) return;
    viewingUser = user.username;
    const av = document.getElementById('profile-avatar');
    av.textContent = (user.display_name||user.username)[0].toUpperCase();
    av.style.background = user.avatar_color || '#a855f7';
    document.getElementById('profile-name').textContent = user.display_name || user.username;
    document.getElementById('profile-username').textContent = '@' + user.username;
    document.getElementById('profile-bio').textContent = user.bio || '';
    let badges = '';
    if (user.username === 'maloy') badges += '<span class="badge creator">Создатель</span>';
    if (user.is_verified) badges += '<span class="badge verified">Верифицирован</span>';
    if (user.premium) badges += '<span class="badge premium">Premium</span>';
    document.getElementById('profile-badges').innerHTML = badges;
    showEl('user-profile-modal');
}

window.openPrivateChatFromProfile = () => {
    window.closeModal();
    if (viewingUser) window.openPrivateChat(viewingUser);
};

// Settings
window.showMainSettings = () => { showEl('main-settings'); updateProfile(); };
window.showMyProfile = () => {
    hideEl('main-settings'); showEl('my-profile-modal');
    document.getElementById('edit-name').value = currentUser?.display_name || '';
    document.getElementById('edit-bio').value = currentUser?.bio || '';
    send({ type: 'get_my_aliases' });
};

window.saveProfile = () => {
    send({ type: 'update_profile', display_name: document.getElementById('edit-name')?.value.trim() || currentUser.username,
        bio: document.getElementById('edit-bio')?.value.trim() || '', avatar_color: selectedColor });
};

window.showAppearanceSettings = () => { hideEl('main-settings'); showEl('appearance-settings'); initColors(); };

window.setTheme = (theme) => {
    currentTheme = theme;
    const app = document.querySelector('.app');
    app.classList.remove('theme-dark', 'theme-light', 'theme-purple');
    app.classList.add('theme-' + theme);
    localStorage.setItem('velora_theme', theme);
    showToast('Тема применена');
};

window.logout = () => {
    disconnectFromServer();
    currentUser = null; privateChats = {};
    localStorage.removeItem('velora_session_token');
    localStorage.removeItem('velora_username');
    window.closeModal();
    showScreen('auth');
};


// Premium
window.showPremiumModal = () => {
    const list = document.getElementById('premium-features-list');
    if (list) {
        list.innerHTML = premiumFeatures.map(f => 
            `<div class="premium-feature-item">
                <span class="pf-icon">${f.icon}</span>
                <div class="pf-info"><div class="pf-name">${f.name}</div><div class="pf-desc">${f.desc}</div></div>
            </div>`
        ).join('');
    }
    const btn = document.querySelector('.btn-premium');
    if (btn && currentUser?.premium) { btn.textContent = 'У вас Premium'; btn.disabled = true; }
    showEl('premium-modal');
};

window.buyPremium = () => {
    if (currentUser?.premium) { showToast('У вас уже есть Premium'); return; }
    showEl('payment-modal');
};

window.confirmPayment = () => {
    send({ type: 'premium_payment_request', username: currentUser?.username });
    window.closeModal();
    showToast('Заявка отправлена! Ожидайте подтверждения.');
};

window.copyCardNumber = () => {
    navigator.clipboard.writeText('2200701230078476');
    showToast('Номер карты скопирован!');
};

// Gifts
window.sendGift = () => {
    if (!viewingUser) return;
    initGifts();
    showEl('gift-modal');
};

window.buyGift = (giftId) => {
    const gift = gifts.find(g => g.id === giftId);
    if (!gift) return;
    const price = currentUser?.premium ? Math.floor(gift.price * 0.8) : gift.price;
    if ((currentUser?.crystals || 0) < price) { showToast('Недостаточно кристаллов'); return; }
    send({ type: 'send_gift', to: viewingUser, gift_id: giftId, price: price });
    window.closeModal();
    showToast('Подарок отправлен!');
};

// Admin
window.showAdminPanel = () => {
    if (currentUser?.username !== 'maloy') return;
    showEl('admin-panel');
    window.showAdminTab('users');
};

window.showAdminTab = (tab) => {
    document.querySelectorAll('.admin-tabs button').forEach((b, i) => {
        b.classList.toggle('active', (tab === 'users' && i === 0) || (tab === 'stats' && i === 1) || (tab === 'premium' && i === 2));
    });
    document.getElementById('admin-content').style.display = tab === 'users' ? 'block' : 'none';
    document.getElementById('admin-stats').style.display = tab === 'stats' ? 'block' : 'none';
    document.getElementById('admin-premium').style.display = tab === 'premium' ? 'block' : 'none';
    if (tab === 'stats') send({ type: 'admin_get_stats' });
    if (tab === 'premium') send({ type: 'get_premium_requests' });
};

window.adminAction = (action) => {
    const username = document.getElementById('admin-username')?.value.trim().replace('@', '');
    const value = document.getElementById('admin-value')?.value.trim();
    if (!username) { showToast('Введите @username'); return; }
    let extra = {};
    if (action === 'give_crystals') extra.amount = parseInt(value) || 0;
    send({ type: 'admin_action', action, target: username, ...extra });
    showToast('Выполняется...');
};

function renderAdminStats(msg) {
    const el = document.getElementById('stats-content');
    if (!el) return;
    el.innerHTML = `
        <div class="stat-item"><span>Пользователей</span><span>${msg.total_users}</span></div>
        <div class="stat-item"><span>Онлайн</span><span>${msg.online_users}</span></div>
        <div class="stat-item"><span>Premium</span><span>${msg.premium_users || 0}</span></div>
    `;
}

function renderPremiumRequests(requests) {
    const container = document.getElementById('premium-requests-list');
    if (!container) return;
    if (requests.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.4);padding:20px">Нет заявок</div>';
        return;
    }
    container.innerHTML = requests.map(r => {
        const time = r.created_at ? new Date(r.created_at).toLocaleString('ru') : '';
        return `<div class="premium-request-item">
            <div class="pr-user">@${r.username}</div>
            <div class="pr-time">${time}</div>
            <div class="pr-actions">
                <button class="btn-approve" onclick="window.approvePremium('${r.username}')">✓</button>
                <button class="btn-reject" onclick="window.rejectPremium('${r.username}')">✗</button>
            </div>
        </div>`;
    }).join('');
}

window.approvePremium = (username) => {
    send({ type: 'approve_premium', target: username });
    showToast('Premium выдан @' + username);
    setTimeout(() => send({ type: 'get_premium_requests' }), 500);
};

window.rejectPremium = (username) => {
    send({ type: 'reject_premium', target: username });
    showToast('Заявка отклонена');
    setTimeout(() => send({ type: 'get_premium_requests' }), 500);
};

// Support
let supportMessages = [];
let supportTickets = [];
let currentTicket = null;
const ADMINS = ['cold', 'maloy'];

function updateSupportButtons() {
    const isAdmin = currentUser && ADMINS.includes(currentUser.username);
    const supportBtn = document.getElementById('support-btn');
    const inboxBtn = document.getElementById('inbox-btn');
    if (supportBtn) supportBtn.style.display = isAdmin ? 'none' : 'block';
    if (inboxBtn) inboxBtn.style.display = isAdmin ? 'block' : 'none';
}

window.showSupportChat = () => {
    send({ type: 'get_my_support_messages' });
    showEl('support-chat-modal');
};

window.sendToSupport = () => {
    const input = document.getElementById('support-message-input');
    const text = input?.value.trim();
    if (!text) return;
    send({ type: 'support_message', username: currentUser?.username, email: null, text: text });
    supportMessages.push({ from: currentUser?.username, text: text, time: new Date().toISOString(), is_mine: true });
    renderSupportMessages();
    input.value = '';
};

function renderSupportMessages() {
    const container = document.getElementById('support-messages');
    if (!container) return;
    if (supportMessages.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.4);padding:40px">Напишите нам!</div>';
        return;
    }
    container.innerHTML = supportMessages.map(m => {
        const isMine = m.is_mine || m.from === currentUser?.username;
        const time = m.time ? new Date(m.time).toLocaleTimeString('ru', {hour:'2-digit',minute:'2-digit'}) : '';
        return `<div class="support-msg ${isMine ? 'from-me' : 'from-support'}">
            <div>${esc(m.text)}</div><div class="msg-time">${time}</div>
        </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

window.showSupportInbox = () => {
    send({ type: 'get_support_tickets' });
    showEl('support-inbox-modal');
};

function renderSupportInbox() {
    const container = document.getElementById('inbox-list');
    if (!container) return;
    if (supportTickets.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.4);padding:40px">Нет обращений</div>';
        return;
    }
    container.innerHTML = supportTickets.map(t => {
        return `<div class="inbox-item" onclick="window.openTicket('${esc(t.id)}')">
            <div class="inbox-user">${t.username ? '@' + esc(t.username) : 'Гость'}</div>
            <div class="inbox-preview">${esc(t.last_message || '')}</div>
        </div>`;
    }).join('');
}

window.openTicket = (ticketId) => {
    currentTicket = supportTickets.find(t => t.id === ticketId);
    if (!currentTicket) return;
    document.getElementById('conversation-title').textContent = currentTicket.username ? '@' + currentTicket.username : 'Гость';
    send({ type: 'get_ticket_messages', ticket_id: ticketId });
    hideEl('support-inbox-modal');
    showEl('support-conversation-modal');
};

window.backToInbox = () => {
    hideEl('support-conversation-modal');
    showEl('support-inbox-modal');
};

function renderConversationMessages(messages) {
    const container = document.getElementById('conversation-messages');
    if (!container) return;
    container.innerHTML = messages.map(m => {
        const isAdmin = m.is_admin;
        return `<div class="support-msg ${isAdmin ? 'from-support' : 'from-me'}">
            <div>${esc(m.text)}</div>
        </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

window.sendReply = () => {
    if (!currentTicket) return;
    const input = document.getElementById('reply-input');
    const text = input?.value.trim();
    if (!text) return;
    send({ type: 'support_reply', ticket_id: currentTicket.id, text: text });
    input.value = '';
    setTimeout(() => send({ type: 'get_ticket_messages', ticket_id: currentTicket.id }), 300);
};

// Private chats list
let privateChatsList = [];

function renderPrivateChatsList(chats) {
    privateChatsList = chats;
    const container = document.getElementById('chats-list');
    if (!container) return;
    let html = '';
    if (chats.length > 0) {
        chats.forEach(chat => {
            const isActive = currentChat === chat.username && currentChatType === 'private';
            const preview = chat.last_message ? chat.last_message.substring(0, 30) : '';
            html += `<div class="chat-item ${isActive?'active':''}" onclick="window.openPrivateChat('${chat.username}')">
                <div class="avatar" style="background:#667eea">${chat.username[0].toUpperCase()}</div>
                <div class="chat-info"><div class="chat-name">@${esc(chat.username)}</div>
                <div class="chat-preview">${esc(preview)}</div></div></div>`;
        });
    }
    if (!html) html = '<div class="empty">Нет чатов</div>';
    container.innerHTML = html;
}

// Aliases
function renderMyAliases(aliases, nftUses, available) {
    const listEl = document.getElementById('my-aliases-list');
    if (listEl) {
        if (aliases.length === 0) {
            listEl.innerHTML = '<span style="color:rgba(255,255,255,0.3)">Нет дополнительных @username</span>';
        } else {
            listEl.innerHTML = aliases.map(a => `<div class="alias-item"><span>@${esc(a.alias)}</span></div>`).join('');
        }
    }
}
