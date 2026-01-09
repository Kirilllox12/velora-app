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
let newChatAvatarData = '';
let replyingTo = null;
let viewingUser = null;
let searchTimeout = null;
let currentTheme = 'dark';
let currentFontSize = 'medium';
let supportMessages = [];
let supportTickets = [];
let currentTicket = null;
let privateChatsList = [];
let selectedNftCount = 0;

const ADMINS = ['cold', 'maloy'];
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
    { id: 'no_ads', name: 'Без рекламы', desc: 'Никакой рекламы', icon: 'X' },
    { id: 'animated_avatar', name: 'Анимированный аватар', desc: 'GIF аватарка', icon: 'A' },
    { id: 'themes', name: 'Темы', desc: 'Эксклюзивные темы', icon: 'P' },
    { id: 'profile_badge', name: 'Бейдж Premium', desc: 'Звезда у имени', icon: '*' },
    { id: 'double_crystals', name: 'x2 Кристаллы', desc: 'Двойные кристаллы', icon: '2' },
    { id: 'gift_discount', name: 'Скидка -20%', desc: 'На подарки', icon: '%' }
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
        connectToServer(() => send({ type: 'auto_login', token, username }), handleMessage, () => showError(''));
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
        wsSocket.onerror = (err) => onError(err);
        wsSocket.onclose = () => console.log('Disconnected');
    } catch(e) { onError(e); }
}
function disconnectFromServer() { if (wsSocket) { wsSocket.close(); wsSocket = null; } }
function showEl(id) { const e = document.getElementById(id); if(e) e.style.display = 'flex'; }
function hideEl(id) { const e = document.getElementById(id); if(e) e.style.display = 'none'; }
function esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }
function showToast(text) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = text;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
}
function playSound() {
    if (!soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
    } catch(e) {}
}
function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const s = document.getElementById(name + '-screen'); if (s) s.style.display = 'flex';
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
    else if (msg.type === 'ticket_messages') { renderConversationMessages(msg.messages || []); }
    else if (msg.type === 'support_reply_received') {
        supportMessages.push({ from: msg.from, text: msg.text, time: msg.time, is_mine: false });
        renderSupportMessages(); playSound(); showToast('Ответ от поддержки!');
    }
}

// Render chats list
function renderChats() { renderPrivateChatsList(privateChatsList); }

function renderPrivateChatsList(chats) {
    privateChatsList = chats;
    const container = document.getElementById('chats-list');
    if (!container) return;
    let html = '';
    myChats.forEach(chat => {
        const icon = chat.type === 'channel' ? 'C' : 'G';
        const av = chat.avatar_data ? `<img src="${chat.avatar_data}">` : icon;
        html += `<div class="chat-item ${currentChat===chat.id && currentChatType!=='private'?'active':''}" onclick="window.openGroupChat('${chat.id}')">
            <div class="chat-icon" style="background:${chat.avatar_color||'#a855f7'}">${av}</div>
            <div class="chat-info"><div class="chat-name">${esc(chat.name)}</div>
            <div class="chat-preview">${chat.type==='channel'?'Канал':'Группа'}</div></div></div>`;
    });
    if (chats.length > 0) {
        html += '<div class="section-title" style="margin-top:15px">ЛИЧНЫЕ</div>';
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

window.openGroupChat = (id) => {
    currentChat = id; currentChatType = 'group';
    const chat = myChats.find(c => c.id === id);
    if (chat) {
        document.getElementById('chat-title').textContent = chat.name;
        document.getElementById('chat-subtitle').textContent = chat.type === 'channel' ? 'Канал' : 'Группа';
        const av = document.getElementById('chat-avatar');
        av.innerHTML = chat.avatar_data ? `<img src="${chat.avatar_data}">` : (chat.type === 'channel' ? 'C' : 'G');
        av.style.background = chat.avatar_color || '#a855f7';
    }
    send({ type: 'get_chat_history', chat_id: id });
    hideEl('empty-chat'); showEl('chat-content');
    renderChats(); renderMessages();
};

window.openPrivateChat = (username) => {
    if (username === 'HELPER') { window.showSupportChat(); return; }
    currentChat = username; currentChatType = 'private';
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
    if (searchResults.chats?.length > 0) {
        html += '<div class="section-title">ЧАТЫ</div>';
        searchResults.chats.forEach(ch => {
            const av = ch.avatar_data ? `<img src="${ch.avatar_data}">` : (ch.type === 'channel' ? 'C' : 'G');
            html += `<div class="chat-item" onclick="window.joinByLink('${ch.link}')">
                <div class="chat-icon" style="background:${ch.avatar_color||'#a855f7'}">${av}</div>
                <div class="chat-info"><div class="chat-name">${esc(ch.name)}</div></div></div>`;
        });
    }
    if (!html) html = '<div class="empty">Ничего не найдено</div>';
    c.innerHTML = html;
}

window.joinByLink = (link) => send({ type: 'join_chat', link });

// Messages
function renderMessages() {
    const c = document.getElementById('messages');
    if (!c) return;
    const msgs = currentChatType === 'private' ? (privateChats[currentChat] || []) : (chatMessages[currentChat] || []);
    c.innerHTML = msgs.map(m => {
        if (m.is_deleted) return `<div class="message deleted"><div class="message-content"><div class="message-text">[Удалено]</div></div></div>`;
        const isOwn = m.from === currentUser.username;
        const creator = m.from === 'maloy' ? '<span class="creator-star">⭐</span>' : '';
        const time = m.time ? new Date(m.time).toLocaleTimeString('ru', {hour:'2-digit',minute:'2-digit'}) : '';
        const content = renderMedia(m);
        let replyHtml = '';
        if (m.reply_to) {
            const rm = msgs.find(x => x.id === m.reply_to);
            if (rm) replyHtml = `<div class="reply-preview"><b>${esc(rm.from)}</b>: ${esc((rm.text||'').substring(0,40))}</div>`;
        }
        let fwdHtml = m.forward_from ? `<div class="forward-info">Переслано от ${esc(m.forward_from)}</div>` : '';
        let reactHtml = '';
        if (m.reactions && Object.keys(m.reactions).length) {
            reactHtml = '<div class="reactions">' + Object.entries(m.reactions).map(([e,u]) => 
                `<span class="reaction" onclick="window.addReaction(${m.id},'${e}')">${e}${u.length}</span>`).join('') + '</div>';
        }
        return `<div class="message ${isOwn?'own':''}" id="msg-${m.id}" onclick="window.showMsgMenu(event,${m.id},'${esc(m.from)}','${esc((m.text||'').replace(/'/g,"\\'"))}',${isOwn})">
            <div class="avatar" style="background:${m.avatar_color||'#667eea'}">${(m.from||'U')[0].toUpperCase()}</div>
            <div class="message-content"><div class="message-author">${esc(m.from)}${creator}</div>
            ${fwdHtml}${replyHtml}${content}${reactHtml}<div class="message-time">${time}</div></div></div>`;
    }).join('');
    c.scrollTop = c.scrollHeight;
}

function renderMedia(m) {
    const t = m.media_type || '', d = m.media_data || '', txt = m.text || '';
    if (t === 'image') return `<img src="${d}" class="msg-image" onclick="window.viewMedia('${encodeURIComponent(d)}','image')">`;
    if (t === 'video') return `<video src="${d}" class="msg-video" controls></video>`;
    if (t === 'voice') return `<div class="msg-voice"><audio src="${d}" controls></audio></div>`;
    if (t === 'circle') return `<div class="msg-circle"><video src="${d}" class="circle-video" muted loop onmouseover="this.play()" onmouseout="this.pause()"></video></div>`;
    if (t === 'file') return `<div class="msg-file">FILE: ${esc(txt)}</div>`;
    return txt ? `<div class="message-text">${esc(txt)}</div>` : '';
}

window.viewMedia = (src, type) => {
    const c = document.getElementById('media-content');
    src = decodeURIComponent(src);
    c.innerHTML = type === 'image' ? `<img src="${src}" style="max-width:90vw;max-height:85vh;border-radius:12px">` 
        : `<video src="${src}" controls autoplay style="max-width:90vw;max-height:85vh"></video>`;
    showEl('media-viewer');
};

// Message context menu
window.showMsgMenu = (e, id, from, text, isOwn) => {
    e.preventDefault();
    const menu = document.getElementById('message-menu');
    menu.style.display = 'block';
    menu.dataset.msgId = id;
    menu.dataset.from = from;
    menu.dataset.text = text;
    document.getElementById('menu-delete').style.display = isOwn ? 'block' : 'none';
};

window.hideMessageMenu = () => hideEl('message-menu');

window.menuReply = () => {
    const menu = document.getElementById('message-menu');
    replyingTo = { id: parseInt(menu.dataset.msgId), from: menu.dataset.from, text: menu.dataset.text };
    document.getElementById('reply-preview').style.display = 'flex';
    document.getElementById('reply-to-name').textContent = replyingTo.from;
    document.getElementById('reply-to-text').textContent = (replyingTo.text || '').substring(0,50);
    document.getElementById('message-text').focus();
    hideEl('message-menu');
};

window.cancelReply = () => { replyingTo = null; hideEl('reply-preview'); };

window.menuForward = () => {
    const menu = document.getElementById('message-menu');
    document.getElementById('forward-preview').textContent = (menu.dataset.text || '').substring(0,100);
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
    const data = { text: txt };
    if (replyingTo) { data.reply_to = replyingTo.id; window.cancelReply(); }
    if (currentChatType === 'private') send({ type: 'private_message', to: currentChat, ...data });
    else send({ type: 'chat_message', chat_id: currentChat, ...data });
    inp.value = '';
};

function sendMedia(type, data, text) {
    if (!currentChat) return;
    const msg = { text: text || '', media_type: type, media_data: data };
    if (currentChatType === 'private') send({ type: 'private_message', to: currentChat, ...msg });
    else send({ type: 'chat_message', chat_id: currentChat, ...msg });
}


// Voice & Circle recording
window.startVoiceRecord = async () => {
    if (isRecordingVoice) { window.stopVoiceRecord(); return; }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunks = [];
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onload = () => sendMedia('voice', reader.result, '');
            reader.readAsDataURL(blob);
            stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start();
        isRecordingVoice = true;
        document.getElementById('voice-btn')?.classList.add('recording');
        showToast('Запись... нажми ещё раз');
    } catch(e) { showToast('Нет доступа к микрофону'); }
};

window.stopVoiceRecord = () => {
    if (!isRecordingVoice || !mediaRecorder) return;
    try { mediaRecorder.stop(); } catch(e) {}
    isRecordingVoice = false;
    document.getElementById('voice-btn')?.classList.remove('recording');
};

window.startCircleRecord = async () => {
    try {
        circleStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const video = document.getElementById('circle-video-preview');
        video.srcObject = circleStream;
        await video.play();
        showEl('circle-preview');
        mediaRecorder = new MediaRecorder(circleStream, { mimeType: 'video/webm' });
        audioChunks = [];
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'video/webm' });
            const reader = new FileReader();
            reader.onload = () => sendMedia('circle', reader.result, '');
            reader.readAsDataURL(blob);
            circleStream?.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start();
        showToast('Запись кружка...');
    } catch(e) { showToast('Нет доступа к камере'); }
};

window.stopCircleRecord = () => {
    if (mediaRecorder?.state !== 'inactive') mediaRecorder?.stop();
    circleStream?.getTracks().forEach(t => t.stop());
    hideEl('circle-preview');
};

window.cancelCircle = () => {
    circleStream?.getTracks().forEach(t => t.stop());
    hideEl('circle-preview');
    audioChunks = [];
};

// Attachments
window.showAttachMenu = () => {
    const m = document.getElementById('attach-menu');
    m.style.display = m.style.display === 'none' ? 'flex' : 'none';
};

window.attachPhoto = () => pickFile('image/*', 'image');
window.attachVideo = () => pickFile('video/*', 'video');
window.attachFile = () => pickFile('*/*', 'file');

function pickFile(accept, type) {
    const inp = document.getElementById('file-input');
    inp.accept = accept;
    inp.onchange = e => {
        const f = e.target.files[0];
        if (!f) return;
        const maxSize = currentUser?.premium ? 4*1024*1024*1024 : 50*1024*1024;
        if (f.size > maxSize) { showToast(currentUser?.premium ? 'Макс 4GB' : 'Макс 50MB'); return; }
        const r = new FileReader();
        r.onload = ev => sendMedia(type, ev.target.result, f.name);
        r.readAsDataURL(f);
    };
    inp.click();
    hideEl('attach-menu');
}

// Profile
function updateProfile() {
    if (!currentUser) return;
    const letter = (currentUser.display_name || currentUser.username || 'U')[0].toUpperCase();
    const color = currentUser.avatar_color || '#a855f7';
    ['settings-avatar', 'edit-avatar'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = currentUser.avatar_data ? `<img src="${currentUser.avatar_data}">` : letter;
        el.style.background = color;
    });
    const nameEl = document.getElementById('settings-name');
    if (nameEl) {
        let name = currentUser.display_name || currentUser.username;
        if (currentUser.premium) name += ' 💎';
        nameEl.textContent = name;
    }
    const userEl = document.getElementById('settings-username');
    if (userEl) userEl.textContent = '@' + currentUser.username;
    updateCrystals();
    initGifts();
}

function updateCrystals() {
    const cr = currentUser?.crystals || 0;
    ['my-crystals', 'transfer-balance'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = cr; });
}

window.showUserProfile = (username) => {
    viewingUser = username;
    send({ type: 'get_user_profile', username });
};

function showUserProfileData(user) {
    if (!user) return;
    viewingUser = user.username;
    const av = document.getElementById('profile-avatar');
    av.innerHTML = user.avatar_data ? `<img src="${user.avatar_data}">` : (user.display_name||user.username)[0].toUpperCase();
    av.style.background = user.avatar_color || '#a855f7';
    document.getElementById('profile-name').textContent = user.display_name || user.username;
    let usernameText = '@' + user.username;
    if (user.aliases && user.aliases.length > 0) usernameText += ' • ' + user.aliases.map(a => '@' + a).join(' ');
    document.getElementById('profile-username').textContent = usernameText;
    document.getElementById('profile-bio').textContent = user.bio || '';
    let badges = '';
    if (user.username === 'maloy') badges += '<span class="badge creator">Создатель</span>';
    if (user.is_verified) badges += '<span class="badge verified">Верифицирован</span>';
    if (user.premium) badges += '<span class="badge premium">Premium</span>';
    if (user.aliases && user.aliases.length > 0) badges += `<span class="badge nft">NFT ${user.aliases.length}</span>`;
    document.getElementById('profile-badges').innerHTML = badges;
    const giftsHtml = (user.gifts || []).map(g => {
        const gift = gifts.find(x => x.id === g.id);
        return gift ? `<div class="profile-gift anim-${gift.anim}" title="От ${g.from}">${gift.emoji}</div>` : '';
    }).join('');
    document.getElementById('profile-gifts').innerHTML = giftsHtml || '';
    showEl('user-profile-modal');
}

window.openPrivateChatFromProfile = () => {
    window.closeModal();
    if (viewingUser) window.openPrivateChat(viewingUser);
};

// Chat Profile
window.showChatProfile = () => {
    if (!currentChat) return;
    if (currentChatType === 'private') { window.showUserProfile(currentChat); return; }
    const chat = myChats.find(c => c.id === currentChat);
    if (!chat) return;
    document.getElementById('chat-profile-type').textContent = chat.type === 'channel' ? 'Канал' : 'Группа';
    document.getElementById('chat-profile-name').textContent = chat.name;
    document.getElementById('chat-profile-desc').textContent = chat.description || '';
    document.getElementById('chat-profile-link').textContent = chat.link;
    document.getElementById('chat-profile-owner').textContent = '@' + chat.owner;
    const av = document.getElementById('chat-profile-avatar');
    av.innerHTML = chat.avatar_data ? `<img src="${chat.avatar_data}">` : (chat.type === 'channel' ? 'C' : 'G');
    av.style.background = chat.avatar_color || '#a855f7';
    const editBtn = document.getElementById('chat-edit-btn');
    if (editBtn) editBtn.style.display = chat.owner === currentUser.username ? 'block' : 'none';
    showEl('chat-profile-modal');
};

window.copyLink = () => {
    const link = document.getElementById('chat-profile-link')?.textContent;
    if (link) { navigator.clipboard.writeText(link); showToast('Скопировано'); }
};

window.leaveChat = () => {
    if (confirm('Покинуть чат?')) {
        send({ type: 'leave_chat', chat_id: currentChat });
        myChats = myChats.filter(c => c.id !== currentChat);
        currentChat = null; renderChats();
        hideEl('chat-content'); showEl('empty-chat');
        window.closeModal();
    }
};

window.editChat = () => {
    showToast('Редактирование чата в разработке');
};


// Create Group/Channel
window.showCreateGroup = () => { showEl('create-group-modal'); newChatAvatarData = ''; };
window.showCreateChannel = () => { showEl('create-channel-modal'); newChatAvatarData = ''; };

window.pickChatAvatar = (type) => document.getElementById('chat-avatar-input')?.click();
window.handleChatAvatarPick = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
        newChatAvatarData = ev.target.result;
        const av = document.getElementById('group-avatar') || document.getElementById('channel-avatar');
        if (av) av.innerHTML = `<img src="${newChatAvatarData}">`;
    };
    r.readAsDataURL(f);
};

window.createGroup = () => {
    const name = document.getElementById('group-name')?.value.trim();
    if (!name) { showToast('Введите название'); return; }
    send({ type: 'create_chat', chat_type: 'group', name, description: document.getElementById('group-desc')?.value.trim() || '',
        avatar_color: '#a855f7', avatar_data: newChatAvatarData, is_public: document.getElementById('group-public')?.checked ? 1 : 0 });
};

window.createChannel = () => {
    const name = document.getElementById('channel-name')?.value.trim();
    if (!name) { showToast('Введите название'); return; }
    send({ type: 'create_chat', chat_type: 'channel', name, description: document.getElementById('channel-desc')?.value.trim() || '',
        avatar_color: '#ec4899', avatar_data: newChatAvatarData, is_public: document.getElementById('channel-public')?.checked ? 1 : 0 });
};

window.showJoinChat = () => showEl('join-chat-modal');
window.joinChat = () => {
    const link = document.getElementById('join-link')?.value.trim();
    if (link) send({ type: 'join_chat', link });
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
        bio: document.getElementById('edit-bio')?.value.trim() || '', avatar_color: selectedColor, avatar_data: currentUser.avatar_data || '' });
};

window.pickAvatar = () => document.getElementById('avatar-input')?.click();
window.handleAvatarPick = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.type === 'image/gif' && !currentUser?.premium) { showToast('GIF аватарки только для Premium'); return; }
    const r = new FileReader();
    r.onload = ev => { currentUser.avatar_data = ev.target.result; updateProfile(); };
    r.readAsDataURL(f);
};

window.showAppearanceSettings = () => { hideEl('main-settings'); showEl('appearance-settings'); initColors(); };
window.showNotifSettings = () => { hideEl('main-settings'); showEl('notif-settings'); };
window.showLanguageSettings = () => { hideEl('main-settings'); showEl('language-settings'); };

window.setTheme = (theme) => {
    currentTheme = theme;
    const app = document.querySelector('.app');
    app.classList.remove('theme-dark', 'theme-light', 'theme-purple');
    app.classList.add('theme-' + theme);
    localStorage.setItem('velora_theme', theme);
    showToast('Тема применена');
};

window.setFontSize = (size) => {
    currentFontSize = size;
    document.body.classList.remove('font-small', 'font-medium', 'font-large');
    document.body.classList.add('font-' + size);
    localStorage.setItem('velora_fontsize', size);
    showToast('Размер изменён');
};

window.toggleSound = () => { soundEnabled = document.getElementById('notif-sound')?.checked ?? true; };

window.setLang = (lang, btn) => {
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
    localStorage.setItem('velora_lang', lang);
    showToast('Язык сохранён');
};

window.logout = () => {
    disconnectFromServer();
    currentUser = null; myChats = []; privateChats = {}; chatMessages = {};
    localStorage.removeItem('velora_session_token');
    localStorage.removeItem('velora_username');
    window.closeModal();
    showScreen('auth');
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

// Transfer crystals
window.transferCrystals = () => {
    document.getElementById('transfer-to').value = viewingUser ? '@' + viewingUser : '';
    document.getElementById('transfer-balance').textContent = currentUser?.crystals || 0;
    showEl('transfer-modal');
};

window.doTransfer = () => {
    const to = document.getElementById('transfer-to')?.value.trim().replace('@','');
    const amount = parseInt(document.getElementById('transfer-amount')?.value);
    if (!to || !amount || amount < 1) { showToast('Введите данные'); return; }
    if (amount > (currentUser?.crystals || 0)) { showToast('Недостаточно кристаллов'); return; }
    send({ type: 'transfer_crystals', to, amount });
    window.closeModal();
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


// Admin Panel
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
function updateSupportButtons() {
    const isAdmin = currentUser && ADMINS.includes(currentUser.username);
    const supportBtn = document.getElementById('support-btn');
    const inboxBtn = document.getElementById('inbox-btn');
    if (supportBtn) supportBtn.style.display = isAdmin ? 'none' : 'block';
    if (inboxBtn) inboxBtn.style.display = isAdmin ? 'block' : 'none';
}

window.showSupportModal = () => {
    document.getElementById('support-email').value = '';
    document.getElementById('support-text').value = '';
    showEl('support-modal');
};

window.sendSupportFromLogin = () => {
    const email = document.getElementById('support-email')?.value.trim();
    const text = document.getElementById('support-text')?.value.trim();
    if (!email) { showToast('Введите email'); return; }
    if (!text) { showToast('Введите сообщение'); return; }
    const tempWs = new WebSocket(REMOTE_URL);
    tempWs.onopen = () => {
        tempWs.send(JSON.stringify({ type: 'support_message', username: null, email: email, text: text }));
        setTimeout(() => { window.closeModal(); showToast('Отправлено!'); tempWs.close(); }, 500);
    };
    tempWs.onerror = () => showToast('Ошибка подключения');
};

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
