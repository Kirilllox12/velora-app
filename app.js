// Velora Android - iOS Style
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
let selectedColor = '#0a84ff';
let isLoginMode = true;
let soundEnabled = true;
let mediaRecorder = null;
let audioChunks = [];
let isRecordingVoice = false;
let circleStream = null;
let newChatAvatarData = '';
let replyingTo = null;
let viewingUser = null;
let searchTimeout = null;
let currentTheme = 'dark';
let supportMessages = [];
let supportTickets = [];
let currentTicket = null;
let privateChatsList = [];
let selectedNftCount = 0;

const ADMINS = ['cold', 'maloy'];
const colors = ['#0a84ff', '#5856d6', '#ff2d55', '#ff9500', '#30d158', '#64d2ff', '#bf5af2', '#ff453a'];

const gifts = [
    { id: 'heart', name: 'Сердечко', emoji: '❤️', price: 5 },
    { id: 'fire', name: 'Огонь', emoji: '🔥', price: 8 },
    { id: 'star', name: 'Звезда', emoji: '⭐', price: 15 },
    { id: 'kiss', name: 'Поцелуй', emoji: '💋', price: 12 },
    { id: 'rose', name: 'Роза', emoji: '🌹', price: 20 },
    { id: 'crown', name: 'Корона', emoji: '👑', price: 50 },
    { id: 'diamond', name: 'Алмаз', emoji: '💎', price: 100 },
    { id: 'rocket', name: 'Ракета', emoji: '🚀', price: 60 },
    { id: 'rainbow', name: 'Радуга', emoji: '🌈', price: 45 },
    { id: 'cake', name: 'Торт', emoji: '🎂', price: 25 },
    { id: 'cat', name: 'Котик', emoji: '🐱', price: 15 },
    { id: 'gift', name: 'Подарок', emoji: '🎁', price: 35 }
];

const premiumFeatures = [
    { icon: '🚫', name: 'Без рекламы' },
    { icon: '🎨', name: 'Анимированный аватар' },
    { icon: '⭐', name: 'Бейдж Premium' },
    { icon: '💎', name: 'x2 Кристаллы' },
    { icon: '🎁', name: 'Скидка -20% на подарки' },
    { icon: '📁', name: 'Файлы до 4 ГБ' }
];

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initColors();
    initAdminActions();
    initGifts();
    initPremiumFeatures();
    
    const form = document.getElementById('auth-form');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); submitAuth(); });
    
    document.addEventListener('keypress', e => {
        if (e.key === 'Enter' && e.target.id === 'message-text') window.sendMessage();
        if (e.key === 'Enter' && e.target.id === 'support-message-input') window.sendToSupport();
    });
    
    document.addEventListener('click', e => {
        if (e.target.classList.contains('modal-overlay')) window.closeModal();
        if (e.target.classList.contains('bottom-sheet')) hideEl(e.target.id);
    });
    
    tryAutoLogin();
});

function tryAutoLogin() {
    const token = localStorage.getItem('velora_session_token');
    const username = localStorage.getItem('velora_username');
    const savedPassword = localStorage.getItem('velora_password');
    
    if (!username) return;
    
    showError('Автовход...');
    connectToServer(
        () => {
            if (token) {
                send({ type: 'auto_login', token, username });
            } else if (savedPassword) {
                send({ type: 'login', username, password: savedPassword });
            } else {
                showError('');
            }
        },
        handleMessage,
        () => showError('')
    );
}

function loadSettings() {
    const theme = localStorage.getItem('velora_theme') || 'dark';
    if (theme === 'light') document.body.classList.add('theme-light');
    currentTheme = theme;
}

function initColors() {
    const c = document.getElementById('accent-colors');
    const sc = document.getElementById('settings-colors');
    const html = colors.map(col => 
        `<button type="button" class="color-btn ${col===selectedColor?'active':''}" style="background:${col}" onclick="window.selectColor('${col}')"></button>`
    ).join('');
    if (c) c.innerHTML = html;
    if (sc) sc.innerHTML = html;
}

function initGifts() {
    const g = document.getElementById('gifts-grid');
    if (g) g.innerHTML = gifts.map(gift => {
        const discount = currentUser?.premium ? Math.floor(gift.price * 0.8) : gift.price;
        return `<div class="gift-item" onclick="window.buyGift('${gift.id}')">
            <span class="gift-emoji">${gift.emoji}</span>
            <span class="gift-name">${gift.name}</span>
            <span class="gift-price">${discount} 💎</span>
        </div>`;
    }).join('');
}

function initPremiumFeatures() {
    const el = document.getElementById('premium-features-list');
    if (el) el.innerHTML = premiumFeatures.map(f => 
        `<div class="premium-feature"><div class="premium-feature-icon">${f.icon}</div><span>${f.name}</span></div>`
    ).join('');
}

function initAdminActions() {
    const actions = [
        ['freeze', 'Заморозить'], ['unfreeze', 'Разморозить'], ['delete', 'Удалить'],
        ['ban', 'Забанить'], ['unban', 'Разбанить'],
        ['give_premium', 'Выдать Premium'], ['remove_premium', 'Убрать Premium'],
        ['give_crystals', 'Выдать кристаллы'], ['verify', 'Верифицировать'], ['unverify', 'Снять верификацию'],
        ['push_update', 'Push обновление']
    ];
    const el = document.getElementById('admin-actions');
    if (el) el.innerHTML = actions.map(([a, t]) => `<button onclick="window.adminAction('${a}')">${t}</button>`).join('');
}

window.selectColor = (c) => {
    selectedColor = c;
    document.querySelectorAll('.color-btn').forEach(b => b.classList.toggle('active', b.style.background === c));
};

// Auth
window.switchTab = (tab) => {
    isLoginMode = (tab === 'login');
    document.querySelectorAll('.auth-tab')[0]?.classList.toggle('active', isLoginMode);
    document.querySelectorAll('.auth-tab')[1]?.classList.toggle('active', !isLoginMode);
    const rf = document.getElementById('register-fields');
    if (rf) rf.style.display = isLoginMode ? 'none' : 'block';
    const ab = document.getElementById('auth-btn');
    if (ab) ab.textContent = isLoginMode ? 'Войти' : 'Создать аккаунт';
    showError('');
};

function submitAuth() {
    const username = document.getElementById('username')?.value.trim().toLowerCase().replace('@', '');
    const password = document.getElementById('password')?.value;
    if (!username || !password) { showError('Заполните все поля'); return; }
    
    if (!isLoginMode) {
        if (username.length < 3) { showError('Username минимум 3 символа'); return; }
        if (username.length > 15) { showError('Username максимум 15 символов'); return; }
        if (!/^[a-z0-9_]+$/.test(username)) { showError('Только английские буквы, цифры и _'); return; }
        const p2 = document.getElementById('password2')?.value;
        if (p2 !== password) { showError('Пароли не совпадают'); return; }
    }
    
    localStorage.setItem('velora_username', username);
    localStorage.setItem('velora_password', password);
    
    showError('Подключение...');
    disconnectFromServer();
    connectToServer(() => {
        showError('');
        if (isLoginMode) send({ type: 'login', username, password });
        else {
            const displayName = document.getElementById('displayname')?.value.trim() || username;
            send({ type: 'register', username, password, display_name: displayName, avatar_color: selectedColor });
        }
    }, handleMessage, () => showError('Ошибка подключения'));
}

// Helpers
function showError(msg) { const e = document.getElementById('auth-error'); if(e) e.textContent = msg; }
function send(data) { if (wsSocket && wsSocket.readyState === 1) wsSocket.send(JSON.stringify(data)); }

function connectToServer(onConnect, onData, onError) {
    try {
        wsSocket = new WebSocket(REMOTE_URL);
        wsSocket.onopen = () => onConnect();
        wsSocket.onmessage = (event) => { try { onData(JSON.parse(event.data)); } catch(e) {} };
        wsSocket.onerror = () => onError();
        wsSocket.onclose = () => console.log('Disconnected');
    } catch(e) { onError(); }
}

function disconnectFromServer() { if (wsSocket) { wsSocket.close(); wsSocket = null; } }
function showEl(id) { const e = document.getElementById(id); if(e) e.style.display = 'flex'; }
function hideEl(id) { const e = document.getElementById(id); if(e) e.style.display = 'none'; }
function esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }

function showToast(text) {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function playSound() {
    if (!soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.connect(gain); osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        osc2.frequency.setValueAtTime(392, ctx.currentTime);
        osc2.frequency.setValueAtTime(523.25, ctx.currentTime + 0.1);
        osc1.type = 'sine'; osc2.type = 'sine';
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc1.start(); osc2.start();
        osc1.stop(ctx.currentTime + 0.3); osc2.stop(ctx.currentTime + 0.3);
    } catch(e) {}
}

function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const s = document.getElementById(name + '-screen');
    if (s) s.classList.add('active');
}

window.closeModal = () => {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    document.querySelectorAll('.bottom-sheet').forEach(m => m.style.display = 'none');
};

window.backToSettings = () => { hideEl('my-profile-modal'); hideEl('appearance-settings'); showEl('main-settings'); };

// Handle messages from server
function handleMessage(msg) {
    console.log('MSG:', msg.type);
    
    if (msg.type === 'register_response' || msg.type === 'login_response') {
        if (msg.success) {
            currentUser = msg.user;
            showScreen('chat');
            updateProfile();
            updateSupportButtons();
            showToast('Добро пожаловать!');
        } else showError(msg.error || 'Ошибка');
    }
    else if (msg.type === 'auto_login_response') {
        if (msg.success) {
            currentUser = msg.user;
            showScreen('chat');
            updateProfile();
            updateSupportButtons();
        } else {
            localStorage.removeItem('velora_session_token');
            const savedPassword = localStorage.getItem('velora_password');
            const username = localStorage.getItem('velora_username');
            if (savedPassword && username) {
                send({ type: 'login', username, password: savedPassword });
            } else {
                showError('');
            }
        }
    }
    else if (msg.type === 'session_token') {
        localStorage.setItem('velora_session_token', msg.token);
        localStorage.setItem('velora_username', msg.username);
    }
    else if (msg.type === 'my_chats') { myChats = msg.chats || []; renderChats(); }
    else if (msg.type === 'chat_created') {
        myChats.push(msg.chat); renderChats();
        window.openGroupChat(msg.chat.id);
        window.closeModal(); showToast('Создано!');
    }
    else if (msg.type === 'join_response') {
        if (msg.success) {
            if (!msg.already) myChats.push(msg.chat);
            renderChats(); window.openGroupChat(msg.chat.id); window.closeModal();
        } else showToast(msg.error || 'Ошибка');
    }
    else if (msg.type === 'chat_message') {
        if (!chatMessages[msg.chat_id]) chatMessages[msg.chat_id] = [];
        chatMessages[msg.chat_id].push(msg);
        if (currentChat === msg.chat_id) renderMessages();
        if (msg.from !== currentUser.username) playSound();
    }
    else if (msg.type === 'chat_history') {
        chatMessages[msg.chat_id] = msg.messages || [];
        if (currentChat === msg.chat_id) renderMessages();
    }
    else if (msg.type === 'private_chats') { renderPrivateChatsList(msg.chats || []); }
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
    else if (msg.type === 'search_results') { searchResults = msg.results || { users: [], chats: [] }; renderSearchResults(); }
    else if (msg.type === 'crystals_update') { currentUser.crystals = msg.crystals; updateCrystals(); }
    else if (msg.type === 'profile_updated') {
        if (msg.success) { currentUser = msg.user; updateProfile(); window.closeModal(); showToast('Сохранено'); }
    }
    else if (msg.type === 'user_profile') { showUserProfileData(msg.user); }
    else if (msg.type === 'admin_response') { showToast(msg.message || 'Выполнено'); }
    else if (msg.type === 'admin_stats') { renderAdminStats(msg); }
    else if (msg.type === 'message_deleted') {
        const msgs = currentChatType === 'private' ? privateChats[currentChat] : chatMessages[msg.chat_id || currentChat];
        if (msgs) {
            const m = msgs.find(x => x.id === msg.message_id);
            if (m) { m.is_deleted = true; m.text = '[Удалено]'; }
            renderMessages();
        }
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
        currentUser.premium = true; updateProfile();
        showToast('Premium активирован! 🎉'); window.closeModal();
    }
    else if (msg.type === 'premium_request_received') {
        playSound(); showToast('Новая заявка на Premium от @' + msg.username);
    }
    else if (msg.type === 'premium_requests') { renderPremiumRequests(msg.requests || []); }
    else if (msg.type === 'support_sent') { window.closeModal(); showToast('Отправлено в поддержку!'); }
    else if (msg.type === 'my_aliases') { renderMyAliases(msg.aliases || [], msg.nft_uses || 0, msg.available || 0); }
    else if (msg.type === 'support_messages') { supportMessages = msg.messages || []; renderSupportMessages(); }
    else if (msg.type === 'support_tickets') { supportTickets = msg.tickets || []; renderSupportInbox(); }
    else if (msg.type === 'update_available') { showUpdateModal(msg.version, msg.url); }
    else if (msg.type === 'ticket_messages') { renderConversationMessages(msg.messages || []); }
    else if (msg.type === 'support_reply_received') {
        supportMessages.push({ from: msg.from, text: msg.text, time: msg.time, is_mine: false });
        renderSupportMessages(); playSound(); showToast('Ответ от поддержки!');
    }
}

// Update profile UI
function updateProfile() {
    if (!currentUser) return;
    const name = currentUser.display_name || currentUser.username;
    const letter = name[0].toUpperCase();
    const color = currentUser.avatar_color || '#0a84ff';
    
    // Settings
    const sa = document.getElementById('settings-avatar');
    if (sa) {
        sa.style.background = currentUser.avatar_data ? 'transparent' : color;
        sa.innerHTML = currentUser.avatar_data ? `<img src="${currentUser.avatar_data}">` : letter;
    }
    setText('settings-name', name);
    setText('settings-username', '@' + currentUser.username);
    updateCrystals();
    
    // Admin button
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) adminBtn.style.display = currentUser.username === 'maloy' ? 'block' : 'none';
}

function updateCrystals() {
    setText('my-crystals', currentUser?.crystals || 0);
    setText('transfer-balance', currentUser?.crystals || 0);
}

function updateSupportButtons() {
    const supportBtn = document.getElementById('support-btn');
    const inboxBtn = document.getElementById('inbox-btn');
    if (supportBtn && inboxBtn) {
        const isAdmin = ADMINS.includes(currentUser?.username);
        supportBtn.style.display = isAdmin ? 'none' : 'flex';
        inboxBtn.style.display = isAdmin ? 'flex' : 'none';
    }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// Render chats list
function renderChats() { renderPrivateChatsList(privateChatsList); }

function renderPrivateChatsList(chats) {
    privateChatsList = chats;
    const container = document.getElementById('chats-list');
    if (!container) return;
    let html = '';
    
    myChats.forEach(chat => {
        const icon = chat.type === 'channel' ? '📢' : '👥';
        const av = chat.avatar_data ? `<img src="${chat.avatar_data}">` : icon;
        html += `<div class="chat-item ${currentChat===chat.id && currentChatType!=='private'?'active':''}" onclick="window.openGroupChat('${chat.id}')">
            <div class="chat-item-avatar" style="background:${chat.avatar_color||'#0a84ff'}">${av}</div>
            <div class="chat-item-info">
                <div class="chat-item-name">${esc(chat.name)}</div>
                <div class="chat-item-preview">${chat.type==='channel'?'Канал':'Группа'}</div>
            </div>
        </div>`;
    });
    
    if (chats.length > 0) {
        html += '<div class="section-title">Личные сообщения</div>';
        chats.forEach(chat => {
            const isActive = currentChat === chat.username && currentChatType === 'private';
            const preview = chat.last_message ? chat.last_message.substring(0, 30) : '';
            html += `<div class="chat-item ${isActive?'active':''}" onclick="window.openPrivateChat('${chat.username}')">
                <div class="chat-item-avatar" style="background:#5856d6">${chat.username[0].toUpperCase()}</div>
                <div class="chat-item-info">
                    <div class="chat-item-name">@${esc(chat.username)}</div>
                    <div class="chat-item-preview">${esc(preview)}</div>
                </div>
            </div>`;
        });
    }
    
    if (!html) html = '<div class="empty-state"><div class="empty-icon">💬</div><h3>Нет чатов</h3><p>Создайте группу или найдите друзей</p></div>';
    container.innerHTML = html;
}

window.openGroupChat = (id) => {
    currentChat = id; currentChatType = 'group';
    const chat = myChats.find(c => c.id === id);
    if (chat) {
        setText('chat-title', chat.name);
        setText('chat-subtitle', chat.type === 'channel' ? 'Канал' : 'Группа');
        const av = document.getElementById('chat-avatar');
        if (av) {
            av.innerHTML = chat.avatar_data ? `<img src="${chat.avatar_data}">` : (chat.type === 'channel' ? '📢' : '👥');
            av.style.background = chat.avatar_color || '#0a84ff';
        }
    }
    send({ type: 'get_chat_history', chat_id: id });
    hideEl('empty-chat'); 
    document.getElementById('chat-content').style.display = 'flex';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('chat-panel').classList.add('active');
    renderChats(); renderMessages();
};

window.openPrivateChat = (username) => {
    if (!username) return;
    currentChat = username; currentChatType = 'private';
    setText('chat-title', '@' + username);
    setText('chat-subtitle', 'Личные сообщения');
    const av = document.getElementById('chat-avatar');
    if (av) {
        av.textContent = username[0].toUpperCase();
        av.style.background = '#5856d6';
    }
    send({ type: 'get_private_history', with: username });
    hideEl('empty-chat');
    document.getElementById('chat-content').style.display = 'flex';
    hideEl('search-results'); showEl('chats-list');
    document.getElementById('search-input').value = '';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('chat-panel').classList.add('active');
    renderMessages();
};

window.backToChats = () => {
    document.getElementById('chat-panel').classList.remove('active');
    document.getElementById('sidebar').style.display = 'flex';
    currentChat = null;
    currentChatType = null;
};

// Search
window.doSearch = () => {
    const q = document.getElementById('search-input')?.value.trim().replace('@', '');
    if (searchTimeout) clearTimeout(searchTimeout);
    if (q && q.length >= 1) {
        showEl('search-results'); hideEl('chats-list');
        document.getElementById('search-results').innerHTML = '<div class="empty-state"><p>Поиск...</p></div>';
        searchTimeout = setTimeout(() => send({ type: 'search', query: q }), 300);
    } else { hideEl('search-results'); showEl('chats-list'); }
};

function renderSearchResults() {
    const c = document.getElementById('search-results');
    if (!c) return;
    let html = '';
    if (searchResults.users?.length > 0) {
        html += '<div class="section-title">Пользователи</div>';
        searchResults.users.forEach(u => {
            if (u.is_deleted) return;
            const verified = u.is_verified ? ' ✓' : '';
            const creator = u.username === 'maloy' ? ' ⭐' : '';
            const premium = u.premium ? ' 💎' : '';
            html += `<div class="chat-item" onclick="window.showUserProfile('${u.username}')">
                <div class="chat-item-avatar" style="background:${u.avatar_color||'#0a84ff'}">${(u.display_name||u.username)[0].toUpperCase()}</div>
                <div class="chat-item-info">
                    <div class="chat-item-name">${esc(u.display_name||u.username)}${creator}${premium}${verified}</div>
                    <div class="chat-item-preview">@${u.username}</div>
                </div>
            </div>`;
        });
    }
    if (searchResults.chats?.length > 0) {
        html += '<div class="section-title">Чаты</div>';
        searchResults.chats.forEach(ch => {
            const av = ch.avatar_data ? `<img src="${ch.avatar_data}">` : (ch.type === 'channel' ? '📢' : '👥');
            html += `<div class="chat-item" onclick="window.joinByLink('${ch.link}')">
                <div class="chat-item-avatar" style="background:${ch.avatar_color||'#0a84ff'}">${av}</div>
                <div class="chat-item-info"><div class="chat-item-name">${esc(ch.name)}</div></div>
            </div>`;
        });
    }
    if (!html) html = '<div class="empty-state"><p>Ничего не найдено</p></div>';
    c.innerHTML = html;
}

window.joinByLink = (link) => { send({ type: 'join_chat', link }); window.closeModal(); };

// Messages
function renderMessages() {
    const c = document.getElementById('messages');
    if (!c) return;
    const msgs = currentChatType === 'private' ? (privateChats[currentChat] || []) : (chatMessages[currentChat] || []);
    c.innerHTML = msgs.map(m => {
        if (m.is_deleted) return `<div class="message deleted"><div class="message-bubble"><div class="message-text">[Удалено]</div></div></div>`;
        const isOwn = m.from === currentUser.username;
        const creator = m.from === 'maloy' ? '<span class="creator-star">⭐</span>' : '';
        const time = m.time ? new Date(m.time).toLocaleTimeString('ru', {hour:'2-digit',minute:'2-digit'}) : '';
        const content = renderMedia(m);
        let replyHtml = '';
        if (m.reply_to) {
            const rm = msgs.find(x => x.id === m.reply_to);
            if (rm) replyHtml = `<div class="reply-bubble"><b>${esc(rm.from)}</b>: ${esc((rm.text||'').substring(0,40))}</div>`;
        }
        let fwdHtml = m.forward_from ? `<div class="forward-label">Переслано от ${esc(m.forward_from)}</div>` : '';
        let reactHtml = '';
        if (m.reactions && Object.keys(m.reactions).length) {
            reactHtml = '<div class="reactions">' + Object.entries(m.reactions).map(([e,u]) => 
                `<span class="reaction" onclick="window.addReaction(${m.id},'${e}')">${e}${u.length}</span>`).join('') + '</div>';
        }
        const avatarColor = m.avatar_color || '#5856d6';
        const avatarContent = m.avatar_data ? `<img src="${m.avatar_data}">` : (m.from||'U')[0].toUpperCase();
        
        return `<div class="message ${isOwn?'own':''}" onclick="window.showMsgMenu(event,${m.id},'${esc(m.from)}','${esc((m.text||'').replace(/'/g,"\\'"))}',${isOwn})">
            <div class="message-avatar" style="background:${avatarColor}">${avatarContent}</div>
            <div class="message-bubble">
                <div class="message-author">${esc(m.from)}${creator}</div>
                ${fwdHtml}${replyHtml}${content}${reactHtml}
                <div class="message-time">${time}</div>
            </div>
        </div>`;
    }).join('');
    c.scrollTop = c.scrollHeight;
}

function renderMedia(m) {
    const t = m.media_type || '', d = m.media_data || '', txt = m.text || '';
    if (t === 'image') return `<img src="${d}" class="msg-image" onclick="event.stopPropagation();window.viewMedia('${encodeURIComponent(d)}','image')">`;
    if (t === 'video') return `<video src="${d}" class="msg-video" controls onclick="event.stopPropagation()"></video>`;
    if (t === 'voice') return `<div class="msg-voice"><audio src="${d}" controls onclick="event.stopPropagation()"></audio></div>`;
    if (t === 'circle') return `<div class="msg-circle"><video src="${d}" class="circle-video" muted loop onmouseover="this.play()" onmouseout="this.pause()" onclick="event.stopPropagation();this.play()"></video></div>`;
    if (t === 'file') return `<div class="msg-file">📎 ${esc(txt)}</div>`;
    return txt ? `<div class="message-text">${esc(txt)}</div>` : '';
}

window.viewMedia = (src, type) => {
    const c = document.getElementById('media-content');
    src = decodeURIComponent(src);
    c.innerHTML = type === 'image' ? `<img src="${src}">` : `<video src="${src}" controls autoplay></video>`;
    showEl('media-viewer');
};

// Message context menu
window.showMsgMenu = (e, id, from, text, isOwn) => {
    e.stopPropagation();
    const menu = document.getElementById('message-menu');
    menu.style.display = 'flex';
    menu.dataset.msgId = id;
    menu.dataset.from = from;
    menu.dataset.text = text;
    document.getElementById('menu-delete').style.display = isOwn ? 'flex' : 'none';
};

window.menuReply = () => {
    const menu = document.getElementById('message-menu');
    replyingTo = { id: parseInt(menu.dataset.msgId), from: menu.dataset.from, text: menu.dataset.text };
    document.getElementById('reply-preview').style.display = 'flex';
    setText('reply-to-name', replyingTo.from);
    setText('reply-to-text', (replyingTo.text || '').substring(0,50));
    document.getElementById('message-text').focus();
    hideEl('message-menu');
};

window.cancelReply = () => { replyingTo = null; hideEl('reply-preview'); };

window.menuForward = () => {
    const menu = document.getElementById('message-menu');
    setText('forward-preview', (menu.dataset.text || '').substring(0,100));
    document.getElementById('forward-modal').dataset.from = menu.dataset.from;
    document.getElementById('forward-modal').dataset.text = menu.dataset.text;
    let html = '';
    myChats.forEach(ch => { html += `<div class="forward-item" onclick="window.doForward('${ch.id}')">${esc(ch.name)}</div>`; });
    document.getElementById('forward-list').innerHTML = html;
    showEl('forward-modal');
    hideEl('message-menu');
};

window.doForward = (chatId) => {
    const modal = document.getElementById('forward-modal');
    send({ type: 'chat_message', chat_id: chatId, text: modal.dataset.text, forward_from: modal.dataset.from });
    window.closeModal(); showToast('Переслано');
};

window.menuDelete = () => {
    const menu = document.getElementById('message-menu');
    send({ type: 'delete_message', message_id: parseInt(menu.dataset.msgId), chat_id: currentChat, is_private: currentChatType === 'private' });
    hideEl('message-menu');
};

window.menuReaction = (emoji) => {
    const menu = document.getElementById('message-menu');
    send({ type: 'add_reaction', message_id: parseInt(menu.dataset.msgId), emoji, chat_id: currentChat, is_private: currentChatType === 'private' });
    hideEl('message-menu');
};

window.menuCopy = () => {
    const menu = document.getElementById('message-menu');
    navigator.clipboard?.writeText(menu.dataset.text || '');
    showToast('Скопировано');
    hideEl('message-menu');
};

window.addReaction = (msgId, emoji) => {
    send({ type: 'add_reaction', message_id: msgId, emoji, chat_id: currentChat, is_private: currentChatType === 'private' });
};

// Send message
window.sendMessage = () => {
    const input = document.getElementById('message-text');
    const text = input?.value.trim();
    if (!text || !currentChat) return;
    
    const msgData = { text };
    if (replyingTo) { msgData.reply_to = replyingTo.id; window.cancelReply(); }
    
    if (currentChatType === 'private') {
        send({ type: 'private_message', to: currentChat, ...msgData });
    } else {
        send({ type: 'chat_message', chat_id: currentChat, ...msgData });
    }
    input.value = '';
};

// Attachments
window.showAttachMenu = () => showEl('attach-menu');
window.showCreateOptions = () => showEl('create-options');

window.attachPhoto = () => { hideEl('attach-menu'); document.getElementById('photo-input').click(); };
window.attachVideo = () => { hideEl('attach-menu'); document.getElementById('video-input').click(); };
window.attachFile = () => { hideEl('attach-menu'); document.getElementById('file-input').click(); };

window.handlePhotoPick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const msgData = { media_type: 'image', media_data: reader.result };
        if (currentChatType === 'private') send({ type: 'private_message', to: currentChat, ...msgData });
        else send({ type: 'chat_message', chat_id: currentChat, ...msgData });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
};

window.handleVideoPick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const msgData = { media_type: 'video', media_data: reader.result };
        if (currentChatType === 'private') send({ type: 'private_message', to: currentChat, ...msgData });
        else send({ type: 'chat_message', chat_id: currentChat, ...msgData });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
};

window.handleFilePick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const msgData = { media_type: 'file', media_data: reader.result, text: file.name };
        if (currentChatType === 'private') send({ type: 'private_message', to: currentChat, ...msgData });
        else send({ type: 'chat_message', chat_id: currentChat, ...msgData });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
};

// Voice recording
window.toggleVoiceRecord = () => {
    if (isRecordingVoice) window.stopVoiceRecord();
    else window.startVoiceRecord();
};

window.startVoiceRecord = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onload = () => {
                const msgData = { media_type: 'voice', media_data: reader.result };
                if (currentChatType === 'private') send({ type: 'private_message', to: currentChat, ...msgData });
                else send({ type: 'chat_message', chat_id: currentChat, ...msgData });
            };
            reader.readAsDataURL(blob);
            stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start();
        isRecordingVoice = true;
        document.getElementById('voice-btn').classList.add('recording');
    } catch(e) { showToast('Нет доступа к микрофону'); }
};

window.stopVoiceRecord = () => {
    if (mediaRecorder && isRecordingVoice) {
        mediaRecorder.stop();
        isRecordingVoice = false;
        document.getElementById('voice-btn').classList.remove('recording');
    }
};

// Circle video
window.startCircleRecord = async () => {
    hideEl('attach-menu');
    try {
        circleStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
        const video = document.getElementById('circle-video-preview');
        video.srcObject = circleStream;
        video.play();
        showEl('circle-preview');
        
        mediaRecorder = new MediaRecorder(circleStream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.start();
    } catch(e) { showToast('Нет доступа к камере'); }
};

window.stopCircleRecord = () => {
    if (mediaRecorder) {
        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'video/webm' });
            const reader = new FileReader();
            reader.onload = () => {
                const msgData = { media_type: 'circle', media_data: reader.result };
                if (currentChatType === 'private') send({ type: 'private_message', to: currentChat, ...msgData });
                else send({ type: 'chat_message', chat_id: currentChat, ...msgData });
            };
            reader.readAsDataURL(blob);
        };
        mediaRecorder.stop();
    }
    if (circleStream) circleStream.getTracks().forEach(t => t.stop());
    hideEl('circle-preview');
};

window.cancelCircle = () => {
    if (mediaRecorder) mediaRecorder.stop();
    if (circleStream) circleStream.getTracks().forEach(t => t.stop());
    hideEl('circle-preview');
};

// Create group/channel
window.showCreateGroup = () => { hideEl('create-options'); showEl('create-group-modal'); };
window.showCreateChannel = () => { hideEl('create-options'); showEl('create-channel-modal'); };
window.showJoinChat = () => { hideEl('create-options'); showEl('join-chat-modal'); };

window.createGroup = () => {
    const name = document.getElementById('group-name')?.value.trim();
    const desc = document.getElementById('group-desc')?.value.trim();
    const isPublic = document.getElementById('group-public')?.checked;
    if (!name) { showToast('Введите название'); return; }
    send({ type: 'create_chat', chat_type: 'group', name, description: desc, is_public: isPublic });
};

window.createChannel = () => {
    const name = document.getElementById('channel-name')?.value.trim();
    const desc = document.getElementById('channel-desc')?.value.trim();
    const isPublic = document.getElementById('channel-public')?.checked;
    if (!name) { showToast('Введите название'); return; }
    send({ type: 'create_chat', chat_type: 'channel', name, description: desc, is_public: isPublic });
};

window.joinChat = () => {
    const link = document.getElementById('join-link')?.value.trim();
    if (!link) { showToast('Введите ссылку'); return; }
    send({ type: 'join_chat', link });
};

// User profile
window.showUserProfile = (username) => {
    viewingUser = username;
    send({ type: 'get_user_profile', username });
    showEl('user-profile-modal');
};

function showUserProfileData(user) {
    if (!user) return;
    viewingUser = user.username;
    const name = user.display_name || user.username;
    const letter = name[0].toUpperCase();
    const color = user.avatar_color || '#0a84ff';
    
    const av = document.getElementById('profile-avatar');
    if (av) {
        av.style.background = user.avatar_data ? 'transparent' : color;
        av.innerHTML = user.avatar_data ? `<img src="${user.avatar_data}">` : letter;
    }
    
    setText('profile-name', name);
    setText('profile-username', '@' + user.username);
    setText('profile-bio', user.bio || '');
    
    // Badges
    let badges = '';
    if (user.username === 'maloy') badges += '<span class="badge creator">Создатель</span>';
    if (user.premium) badges += '<span class="badge premium">Premium</span>';
    if (user.is_verified) badges += '<span class="badge verified">✓</span>';
    document.getElementById('profile-badges').innerHTML = badges;
    
    // Gifts
    const giftsSection = document.getElementById('profile-gifts-section');
    const giftsList = document.getElementById('profile-gifts-list');
    if (user.received_gifts && user.received_gifts.length > 0) {
        giftsSection.style.display = 'block';
        giftsList.innerHTML = user.received_gifts.map(g => {
            const gift = gifts.find(x => x.id === g.gift_id);
            return gift ? `<div class="gift-badge">${gift.emoji}</div>` : '';
        }).join('');
    } else {
        giftsSection.style.display = 'none';
    }
}

window.openPrivateChatFromProfile = () => {
    if (!viewingUser) return;
    window.closeModal();
    window.openPrivateChat(viewingUser);
};

window.startCallToUser = () => showToast('Звонки скоро будут доступны');
window.startVideoCallToUser = () => showToast('Видеозвонки скоро будут доступны');
window.startCall = () => showToast('Звонки скоро будут доступны');
window.startVideoCall = () => showToast('Видеозвонки скоро будут доступны');

// Gifts
window.sendGift = () => {
    if (!viewingUser) return;
    initGifts();
    showEl('gift-modal');
};

window.buyGift = (giftId) => {
    const gift = gifts.find(g => g.id === giftId);
    if (!gift || !viewingUser) return;
    const price = currentUser?.premium ? Math.floor(gift.price * 0.8) : gift.price;
    if ((currentUser?.crystals || 0) < price) { showToast('Недостаточно кристаллов'); return; }
    send({ type: 'send_gift', to: viewingUser, gift_id: giftId });
    window.closeModal();
    showToast(`Подарок ${gift.emoji} отправлен!`);
};

// Chat profile
window.showChatProfile = () => {
    if (currentChatType === 'private') {
        window.showUserProfile(currentChat);
        return;
    }
    const chat = myChats.find(c => c.id === currentChat);
    if (!chat) return;
    
    const av = document.getElementById('chat-profile-avatar');
    if (av) {
        av.innerHTML = chat.avatar_data ? `<img src="${chat.avatar_data}">` : (chat.type === 'channel' ? '📢' : '👥');
        av.style.background = chat.avatar_color || '#0a84ff';
    }
    setText('chat-profile-name', chat.name);
    setText('chat-profile-type', chat.type === 'channel' ? 'Канал' : 'Группа');
    setText('chat-profile-desc', chat.description || '');
    setText('chat-profile-link', chat.link || '');
    setText('chat-profile-members', chat.members_count || 0);
    showEl('chat-profile-modal');
};

window.copyLink = () => {
    const chat = myChats.find(c => c.id === currentChat);
    if (chat?.link) {
        navigator.clipboard?.writeText(chat.link);
        showToast('Ссылка скопирована');
    }
};

window.leaveChat = () => {
    send({ type: 'leave_chat', chat_id: currentChat });
    myChats = myChats.filter(c => c.id !== currentChat);
    renderChats();
    window.closeModal();
    window.backToChats();
    showToast('Вы покинули чат');
};

// Settings
window.showMainSettings = () => showEl('main-settings');
window.showMyProfile = () => {
    hideEl('main-settings');
    const name = currentUser?.display_name || currentUser?.username || '';
    const letter = name[0]?.toUpperCase() || 'U';
    const color = currentUser?.avatar_color || '#0a84ff';
    
    const av = document.getElementById('edit-avatar');
    if (av) {
        av.style.background = currentUser?.avatar_data ? 'transparent' : color;
        av.innerHTML = currentUser?.avatar_data ? `<img src="${currentUser.avatar_data}">` : letter;
    }
    document.getElementById('edit-name').value = name;
    document.getElementById('edit-bio').value = currentUser?.bio || '';
    send({ type: 'get_my_aliases' });
    showEl('my-profile-modal');
};

window.pickAvatar = () => document.getElementById('avatar-input').click();

window.handleAvatarPick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const av = document.getElementById('edit-avatar');
        if (av) {
            av.style.background = 'transparent';
            av.innerHTML = `<img src="${reader.result}">`;
        }
        currentUser.avatar_data = reader.result;
    };
    reader.readAsDataURL(file);
};

window.saveProfile = () => {
    const name = document.getElementById('edit-name')?.value.trim();
    const bio = document.getElementById('edit-bio')?.value.trim();
    send({ type: 'update_profile', display_name: name, bio, avatar_data: currentUser?.avatar_data });
};

function renderMyAliases(aliases, nftUses, available) {
    setText('aliases-count', `(${aliases.length}/${nftUses})`);
    const list = document.getElementById('my-aliases-list');
    const addRow = document.getElementById('add-alias-row');
    if (list) {
        list.innerHTML = aliases.map(a => 
            `<div class="alias-item"><span>@${esc(a)}</span><button onclick="window.removeAlias('${a}')">✕</button></div>`
        ).join('');
    }
    if (addRow) addRow.style.display = available > 0 ? 'flex' : 'none';
}

window.addAlias = () => {
    const input = document.getElementById('new-alias-input');
    const alias = input?.value.trim().toLowerCase().replace('@', '');
    if (!alias || alias.length < 3) { showToast('Минимум 3 символа'); return; }
    if (!/^[a-z0-9_]+$/.test(alias)) { showToast('Только английские буквы, цифры и _'); return; }
    send({ type: 'add_alias', alias });
    input.value = '';
};

window.removeAlias = (alias) => send({ type: 'remove_alias', alias });

window.showAppearanceSettings = () => { hideEl('main-settings'); showEl('appearance-settings'); };

window.setTheme = (theme) => {
    currentTheme = theme;
    localStorage.setItem('velora_theme', theme);
    document.body.classList.toggle('theme-light', theme === 'light');
    document.querySelectorAll('.theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
};

window.logout = () => {
    disconnectFromServer();
    currentUser = null; myChats = []; privateChats = {}; chatMessages = {};
    localStorage.removeItem('velora_session_token');
    localStorage.removeItem('velora_username');
    localStorage.removeItem('velora_password');
    window.closeModal();
    showScreen('auth');
};

// Premium
window.showPremiumModal = () => { window.closeModal(); showEl('premium-modal'); };

window.buyPremium = () => { hideEl('premium-modal'); showEl('payment-modal'); };

window.copyCardNumber = () => {
    navigator.clipboard?.writeText('2200701230078476');
    showToast('Номер скопирован');
};

window.confirmPayment = () => {
    send({ type: 'premium_request', username: currentUser?.username });
    window.closeModal();
    showToast('Заявка отправлена! Ожидайте подтверждения.');
};

// Transfer
window.showTransferModal = () => { hideEl('main-settings'); showEl('transfer-modal'); };

window.doTransfer = () => {
    const to = document.getElementById('transfer-to')?.value.trim().replace('@', '');
    const amount = parseInt(document.getElementById('transfer-amount')?.value);
    if (!to || !amount || amount < 1) { showToast('Заполните все поля'); return; }
    if (amount > (currentUser?.crystals || 0)) { showToast('Недостаточно кристаллов'); return; }
    send({ type: 'transfer_crystals', to, amount });
    window.closeModal();
    showToast('Кристаллы отправлены!');
};

// Support
window.showSupportChat = () => {
    window.closeModal();
    send({ type: 'get_support_messages' });
    showEl('support-chat-modal');
};

function renderSupportMessages() {
    const c = document.getElementById('support-messages');
    if (!c) return;
    if (supportMessages.length === 0) {
        c.innerHTML = `<div class="support-welcome">
            <div class="welcome-icon">👋</div>
            <h4>Привет!</h4>
            <p>Опишите вашу проблему, и мы постараемся помочь как можно скорее.</p>
        </div>`;
        return;
    }
    c.innerHTML = supportMessages.map(m => {
        const time = m.time ? new Date(m.time).toLocaleTimeString('ru', {hour:'2-digit',minute:'2-digit'}) : '';
        return `<div class="support-msg ${m.is_mine ? 'mine' : 'theirs'}">
            ${esc(m.text)}
            <div class="support-msg-time">${time}</div>
        </div>`;
    }).join('');
    c.scrollTop = c.scrollHeight;
}

window.sendToSupport = () => {
    const input = document.getElementById('support-message-input');
    const text = input?.value.trim();
    if (!text) return;
    send({ type: 'support_message', text });
    supportMessages.push({ text, is_mine: true, time: new Date().toISOString() });
    renderSupportMessages();
    input.value = '';
};

// Support inbox (admin)
window.showSupportInbox = () => {
    window.closeModal();
    send({ type: 'get_support_tickets' });
    showEl('support-inbox-modal');
};

function renderSupportInbox() {
    const c = document.getElementById('inbox-list');
    if (!c) return;
    if (supportTickets.length === 0) {
        c.innerHTML = '<div class="empty-state"><p>Нет обращений</p></div>';
        return;
    }
    c.innerHTML = supportTickets.map(t => {
        const time = t.last_time ? new Date(t.last_time).toLocaleString('ru') : '';
        return `<div class="inbox-item" onclick="window.openTicket('${t.username}')">
            <div class="inbox-item-header">
                <span class="inbox-item-user">@${esc(t.username)}</span>
                <span class="inbox-item-time">${time}</span>
            </div>
            <div class="inbox-item-preview">${esc(t.last_message || '')}</div>
        </div>`;
    }).join('');
}

window.openTicket = (username) => {
    currentTicket = username;
    setText('conversation-title', '@' + username);
    send({ type: 'get_ticket_messages', username });
    hideEl('support-inbox-modal');
    showEl('support-conversation-modal');
};

function renderConversationMessages(messages) {
    const c = document.getElementById('conversation-messages');
    if (!c) return;
    c.innerHTML = messages.map(m => {
        const time = m.time ? new Date(m.time).toLocaleTimeString('ru', {hour:'2-digit',minute:'2-digit'}) : '';
        const isAdmin = ADMINS.includes(m.from);
        return `<div class="support-msg ${isAdmin ? 'mine' : 'theirs'}">
            ${esc(m.text)}
            <div class="support-msg-time">${time}</div>
        </div>`;
    }).join('');
    c.scrollTop = c.scrollHeight;
}

window.backToInbox = () => { hideEl('support-conversation-modal'); showEl('support-inbox-modal'); };

window.sendAdminReply = () => {
    const input = document.getElementById('admin-reply-input');
    const text = input?.value.trim();
    if (!text || !currentTicket) return;
    send({ type: 'support_reply', to: currentTicket, text });
    input.value = '';
    showToast('Ответ отправлен');
};

// Admin
window.showAdminPanel = () => { window.closeModal(); showEl('admin-panel'); };

window.setNftCount = (count) => {
    selectedNftCount = count;
    document.querySelectorAll('.nft-btn').forEach((btn, i) => btn.classList.toggle('active', i + 1 === count));
    const container = document.getElementById('nft-aliases-inputs');
    let html = '';
    for (let i = 0; i < count; i++) html += `<div class="form-group"><input type="text" id="nft-alias-${i}" placeholder="@username ${i + 1}"></div>`;
    container.innerHTML = html;
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
    send({ type: 'admin_give_nft', target: username, aliases });
    showToast('Выдаём NFT Uses...');
};

window.adminAction = (action) => {
    const username = document.getElementById('admin-username')?.value.trim().replace('@', '');
    const value = document.getElementById('admin-value')?.value.trim();
    if (!username) { showToast('Введите @username'); return; }
    
    // Actions that require reason
    const needsReason = ['ban', 'delete', 'freeze', 'warn'];
    if (needsReason.includes(action) && !value) {
        showToast('Введите причину в поле "Значение"');
        return;
    }
    
    send({ type: 'admin_action', action, target: username, value, reason: value });
    showToast('Выполняется...');
};

window.getAdminStats = () => send({ type: 'get_admin_stats' });

function renderAdminStats(stats) {
    const c = document.getElementById('stats-content');
    if (!c) return;
    c.innerHTML = `
        <div class="stat-item">Пользователей: ${stats.users || 0}</div>
        <div class="stat-item">Чатов: ${stats.chats || 0}</div>
        <div class="stat-item">Сообщений: ${stats.messages || 0}</div>
        <div class="stat-item">Premium: ${stats.premium || 0}</div>
    `;
    document.getElementById('admin-stats').style.display = 'block';
}

function renderPremiumRequests(requests) {
    // Could add UI for this
}

// Update
function showUpdateModal(version, url) {
    setText('update-version-text', 'Версия ' + version);
    window.updateUrl = url;
    showEl('update-modal');
}

window.downloadUpdate = () => {
    if (window.updateUrl) window.open(window.updateUrl, '_blank');
    hideEl('update-modal');
};

window.skipUpdate = () => hideEl('update-modal');
