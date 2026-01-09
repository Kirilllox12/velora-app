// Velora Android App
const SERVER_URL = 'wss://velora-server-bxcg.onrender.com';

let socket = null;
let currentUser = null;
let currentChat = null;
let currentChatType = null;
let myChats = [];
let privateChats = {};
let chatMessages = {};
let isLoginMode = true;
let replyingTo = null;
let viewingUser = null;
let selectedMsgId = null;

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
    { name: 'Без рекламы', desc: 'Никакой рекламы', icon: '🚫' },
    { name: 'Анимированный аватар', desc: 'GIF аватарка', icon: '🎭' },
    { name: 'Переводчик', desc: 'Перевод сообщений', icon: '🌍' },
    { name: 'Большие файлы', desc: 'До 4 ГБ', icon: '📁' },
    { name: 'Бейдж Premium', desc: 'Звезда у имени', icon: '💎' },
    { name: 'x2 Кристаллы', desc: 'Двойные награды', icon: '✨' },
    { name: 'Скидка -20%', desc: 'На подарки', icon: '💰' },
    { name: 'Секретные чаты', desc: 'Шифрование', icon: '🔒' },
    { name: 'Скрытый онлайн', desc: 'Невидимый статус', icon: '👻' },
    { name: 'HD видеозвонки', desc: '1080p качество', icon: '📹' }
];

// Init
document.addEventListener('DOMContentLoaded', () => {
    initGifts();
    initPremium();
    initAdmin();
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu')) {
            document.getElementById('context-menu').style.display = 'none';
        }
    });
});

function initGifts() {
    const grid = document.getElementById('gifts-grid');
    if (grid) {
        grid.innerHTML = gifts.map(g => {
            const price = currentUser?.premium ? Math.floor(g.price * 0.8) : g.price;
            return `<div class="gift-item" onclick="buyGift('${g.id}')">
                <span class="gift-emoji">${g.emoji}</span>
                <span class="gift-name">${g.name}</span>
                <span class="gift-price">${price} 💎</span>
            </div>`;
        }).join('');
    }
}

function initPremium() {
    const list = document.getElementById('premium-features');
    if (list) {
        list.innerHTML = premiumFeatures.map(f => `
            <div class="premium-feature">
                <div class="premium-feature-icon">${f.icon}</div>
                <div class="premium-feature-info">
                    <div class="premium-feature-name">${f.name}</div>
                    <div class="premium-feature-desc">${f.desc}</div>
                </div>
            </div>
        `).join('');
    }
}

function initAdmin() {
    const actions = [
        ['freeze', 'Заморозить'], ['unfreeze', 'Разморозить'],
        ['ban', 'Забанить'], ['unban', 'Разбанить'],
        ['delete', 'Удалить'], ['warn', 'Предупреждение'],
        ['give_premium', 'Выдать Premium'], ['remove_premium', 'Убрать Premium'],
        ['give_crystals', 'Выдать кристаллы'], ['reset_crystals', 'Обнулить'],
        ['change_name', 'Изменить имя'], ['verify', 'Верифицировать'],
        ['shadow_ban', 'Теневой бан'], ['view_info', 'Информация'],
        ['give_gift', 'Выдать подарок'], ['kick_all_chats', 'Кикнуть из чатов']
    ];
    const el = document.getElementById('admin-actions');
    if (el) {
        el.innerHTML = actions.map(([a, t]) => `<button onclick="adminAction('${a}')">${t}</button>`).join('');
    }
}

// Connection
function connect() {
    showError('Подключение...');
    socket = new WebSocket(SERVER_URL);
    
    socket.onopen = () => {
        showError('');
        console.log('Connected');
    };
    
    socket.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            handleMessage(msg);
        } catch (e) {
            console.error('Parse error:', e);
        }
    };
    
    socket.onerror = (err) => {
        showError('Ошибка подключения');
        console.error('Socket error:', err);
    };
    
    socket.onclose = () => {
        console.log('Disconnected');
        setTimeout(connect, 3000);
    };
}

function send(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    }
}

// Auth
function switchTab(tab) {
    isLoginMode = (tab === 'login');
    document.querySelectorAll('.tab').forEach((t, i) => {
        t.classList.toggle('active', i === (isLoginMode ? 0 : 1));
    });
    document.getElementById('register-fields').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('auth-btn').textContent = isLoginMode ? 'Войти' : 'Создать аккаунт';
    showError('');
}

function submitAuth(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showError('Заполните все поля');
        return;
    }
    
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        connect();
        setTimeout(() => submitAuth(e), 1000);
        return;
    }
    
    if (isLoginMode) {
        send({ type: 'login', username, password });
    } else {
        const p2 = document.getElementById('password2').value;
        if (p2 !== password) {
            showError('Пароли не совпадают');
            return;
        }
        const displayName = document.getElementById('displayname').value.trim() || username;
        send({ type: 'register', username, password, display_name: displayName });
    }
}

function showError(msg) {
    const el = document.getElementById('auth-error');
    if (el) el.textContent = msg;
}

function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(name + '-screen')?.classList.add('active');
}

function showToast(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// Handle server messages
function handleMessage(msg) {
    console.log('MSG:', msg.type, msg);
    
    if (msg.type === 'register_response' || msg.type === 'login_response') {
        if (msg.success) {
            currentUser = msg.user;
            showScreen('chat');
            updateProfile();
            document.getElementById('admin-btn').style.display = 
                currentUser.username === 'maloy' ? 'block' : 'none';
            showToast('Добро пожаловать!');
        } else {
            showError(msg.error || 'Ошибка');
        }
    }
    else if (msg.type === 'my_chats') {
        myChats = msg.chats || [];
        renderChats();
    }
    else if (msg.type === 'chat_created') {
        myChats.push(msg.chat);
        renderChats();
        openGroupChat(msg.chat.id);
        closeModal();
        showToast('Создано!');
    }
    else if (msg.type === 'join_response') {
        if (msg.success) {
            if (!msg.already) myChats.push(msg.chat);
            renderChats();
            openGroupChat(msg.chat.id);
        } else {
            showToast(msg.error || 'Ошибка');
        }
    }
    else if (msg.type === 'chat_message') {
        if (!chatMessages[msg.chat_id]) chatMessages[msg.chat_id] = [];
        chatMessages[msg.chat_id].push(msg);
        if (currentChat === msg.chat_id) renderMessages();
    }
    else if (msg.type === 'chat_history') {
        chatMessages[msg.chat_id] = msg.messages || [];
        if (currentChat === msg.chat_id) renderMessages();
    }
    else if (msg.type === 'private_message') {
        const cid = msg.from === currentUser.username ? msg.to : msg.from;
        if (!privateChats[cid]) privateChats[cid] = [];
        privateChats[cid].push(msg);
        if (currentChat === cid && currentChatType === 'private') renderMessages();
    }
    else if (msg.type === 'private_history') {
        privateChats[msg.with] = msg.messages || [];
        if (currentChat === msg.with && currentChatType === 'private') renderMessages();
    }
    else if (msg.type === 'search_results') {
        renderSearchResults(msg.results);
    }
    else if (msg.type === 'user_profile') {
        showUserProfileData(msg.user);
    }
    else if (msg.type === 'profile_updated') {
        if (msg.success) {
            currentUser = msg.user;
            updateProfile();
            closeModal();
            showToast('Сохранено');
        }
    }
    else if (msg.type === 'crystals_update') {
        currentUser.crystals = msg.crystals;
        updateCrystals();
    }
    else if (msg.type === 'premium_activated') {
        currentUser.premium = true;
        updateProfile();
        closeModal();
        showToast('Premium активирован!');
    }
    else if (msg.type === 'admin_response') {
        document.getElementById('admin-result').textContent = msg.message;
        showToast(msg.message);
    }
    else if (msg.type === 'reaction_added') {
        const msgs = currentChatType === 'private' ? privateChats[currentChat] : chatMessages[currentChat];
        if (msgs) {
            const m = msgs.find(x => x.id === msg.message_id);
            if (m) {
                if (!m.reactions) m.reactions = {};
                if (!m.reactions[msg.emoji]) m.reactions[msg.emoji] = [];
                if (!m.reactions[msg.emoji].includes(msg.username)) {
                    m.reactions[msg.emoji].push(msg.username);
                }
                renderMessages();
            }
        }
    }
    else if (msg.type === 'message_deleted') {
        const msgs = currentChatType === 'private' ? privateChats[currentChat] : chatMessages[currentChat];
        if (msgs) {
            const m = msgs.find(x => x.id === msg.message_id);
            if (m) {
                m.is_deleted = true;
                m.text = '[Удалено]';
            }
            renderMessages();
        }
    }
}

function updateProfile() {
    const avatar = (currentUser.display_name || currentUser.username)[0].toUpperCase();
    document.getElementById('settings-avatar').textContent = avatar;
    document.getElementById('settings-avatar').style.background = currentUser.avatar_color || '#a855f7';
    document.getElementById('settings-name').textContent = currentUser.display_name || currentUser.username;
    document.getElementById('settings-username').textContent = '@' + currentUser.username;
    updateCrystals();
}

function updateCrystals() {
    document.getElementById('my-crystals').textContent = currentUser.crystals || 0;
    const tb = document.getElementById('transfer-balance');
    if (tb) tb.textContent = currentUser.crystals || 0;
}

// Chats
function renderChats() {
    const list = document.getElementById('chats-list');
    if (!list) return;
    
    if (myChats.length === 0) {
        list.innerHTML = '<div class="empty-text" style="padding:20px;text-align:center">Нет чатов</div>';
        return;
    }
    
    list.innerHTML = myChats.map(chat => {
        const icon = chat.type === 'channel' ? '📢' : '👥';
        const av = chat.avatar_data ? `<img src="${chat.avatar_data}">` : icon;
        return `<div class="chat-item ${currentChat === chat.id ? 'active' : ''}" onclick="openGroupChat('${chat.id}')">
            <div class="chat-icon" style="background:${chat.avatar_color || '#a855f7'}">${av}</div>
            <div class="chat-info">
                <div class="chat-name">${esc(chat.name)}</div>
                <div class="chat-preview">${chat.type === 'channel' ? 'Канал' : 'Группа'}</div>
            </div>
        </div>`;
    }).join('');
}

function openGroupChat(id) {
    currentChat = id;
    currentChatType = 'group';
    const chat = myChats.find(c => c.id === id);
    
    if (chat) {
        document.getElementById('chat-title').textContent = chat.name;
        document.getElementById('chat-subtitle').textContent = chat.type === 'channel' ? 'Канал' : 'Группа';
        const av = document.getElementById('chat-avatar');
        av.innerHTML = chat.avatar_data ? `<img src="${chat.avatar_data}">` : (chat.type === 'channel' ? '📢' : '👥');
        av.style.background = chat.avatar_color || '#a855f7';
    }
    
    send({ type: 'get_chat_history', chat_id: id });
    
    document.getElementById('empty-chat').style.display = 'none';
    document.getElementById('chat-content').style.display = 'flex';
    document.getElementById('chat-screen').classList.add('chat-open');
    
    renderChats();
    renderMessages();
}

function openPrivateChat() {
    if (!viewingUser) return;
    currentChat = viewingUser;
    currentChatType = 'private';
    
    document.getElementById('chat-title').textContent = viewingUser;
    document.getElementById('chat-subtitle').textContent = 'Личные сообщения';
    document.getElementById('chat-avatar').textContent = viewingUser[0].toUpperCase();
    
    send({ type: 'get_private_history', with: viewingUser });
    
    document.getElementById('empty-chat').style.display = 'none';
    document.getElementById('chat-content').style.display = 'flex';
    document.getElementById('chat-screen').classList.add('chat-open');
    
    closeModal();
    renderMessages();
}

function backToChats(e) {
    e.stopPropagation();
    document.getElementById('chat-screen').classList.remove('chat-open');
    currentChat = null;
}

// Messages
function renderMessages() {
    const container = document.getElementById('messages');
    if (!container) return;
    
    const msgs = currentChatType === 'private' ? (privateChats[currentChat] || []) : (chatMessages[currentChat] || []);
    
    container.innerHTML = msgs.map(m => {
        if (m.is_deleted) {
            return `<div class="message"><div class="message-content"><div class="message-text" style="color:var(--text2)">[Удалено]</div></div></div>`;
        }
        
        const isOwn = m.from === currentUser.username;
        const time = m.time ? new Date(m.time).toLocaleTimeString('ru', {hour:'2-digit', minute:'2-digit'}) : '';
        
        let reactHtml = '';
        if (m.reactions && Object.keys(m.reactions).length) {
            reactHtml = '<div class="reactions">' + 
                Object.entries(m.reactions).map(([e, u]) => 
                    `<span class="reaction" onclick="addReaction(${m.id},'${e}')">${e}${u.length}</span>`
                ).join('') + '</div>';
        }
        
        return `<div class="message ${isOwn ? 'own' : ''}" onclick="showContextMenu(event, ${m.id}, '${esc(m.from)}', '${esc((m.text||'').replace(/'/g, "\\'"))}', ${isOwn})">
            <div class="avatar" style="background:${m.avatar_color || '#a855f7'}">${(m.from || 'U')[0].toUpperCase()}</div>
            <div class="message-content">
                <div class="message-author">${esc(m.from)}</div>
                <div class="message-text">${esc(m.text)}</div>
                ${reactHtml}
                <div class="message-time">${time}</div>
            </div>
        </div>`;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('message-text');
    const text = input.value.trim();
    
    if (!text || !currentChat) return;
    
    const data = { text };
    if (replyingTo) {
        data.reply_to = replyingTo.id;
        cancelReply();
    }
    
    if (currentChatType === 'private') {
        send({ type: 'private_message', to: currentChat, ...data });
    } else {
        send({ type: 'chat_message', chat_id: currentChat, ...data });
    }
    
    input.value = '';
}

// Context menu
function showContextMenu(e, msgId, from, text, isOwn) {
    e.stopPropagation();
    selectedMsgId = msgId;
    
    const menu = document.getElementById('context-menu');
    menu.dataset.msgId = msgId;
    menu.dataset.from = from;
    menu.dataset.text = text;
    
    document.getElementById('menu-delete').style.display = isOwn ? 'block' : 'none';
    
    let x = e.clientX;
    let y = e.clientY;
    if (x + 200 > window.innerWidth) x = window.innerWidth - 210;
    if (y + 250 > window.innerHeight) y = window.innerHeight - 260;
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'block';
}

function menuReply() {
    const menu = document.getElementById('context-menu');
    replyingTo = {
        id: parseInt(menu.dataset.msgId),
        from: menu.dataset.from,
        text: menu.dataset.text
    };
    
    document.getElementById('reply-preview').style.display = 'flex';
    document.getElementById('reply-to-name').textContent = replyingTo.from;
    document.getElementById('reply-to-text').textContent = (replyingTo.text || '').substring(0, 50);
    document.getElementById('message-text').focus();
    menu.style.display = 'none';
}

function cancelReply() {
    replyingTo = null;
    document.getElementById('reply-preview').style.display = 'none';
}

function menuForward() {
    showToast('Пересылка в разработке');
    document.getElementById('context-menu').style.display = 'none';
}

function menuReaction(emoji) {
    const menu = document.getElementById('context-menu');
    const msgId = parseInt(menu.dataset.msgId);
    send({
        type: 'add_reaction',
        message_id: msgId,
        chat_id: currentChat,
        emoji,
        is_private: currentChatType === 'private'
    });
    menu.style.display = 'none';
}

function addReaction(msgId, emoji) {
    send({
        type: 'add_reaction',
        message_id: msgId,
        chat_id: currentChat,
        emoji,
        is_private: currentChatType === 'private'
    });
}

function menuDelete() {
    const menu = document.getElementById('context-menu');
    send({
        type: 'delete_message',
        message_id: parseInt(menu.dataset.msgId),
        chat_id: currentChat,
        is_private: currentChatType === 'private'
    });
    menu.style.display = 'none';
}

// Search
function doSearch() {
    const query = document.getElementById('search-input').value.trim().replace('@', '');
    
    if (query.length >= 1) {
        document.getElementById('search-results').style.display = 'block';
        document.getElementById('chats-list').style.display = 'none';
        send({ type: 'search', query });
    } else {
        document.getElementById('search-results').style.display = 'none';
        document.getElementById('chats-list').style.display = 'block';
    }
}

function renderSearchResults(results) {
    const container = document.getElementById('search-results');
    let html = '';
    
    if (results.users?.length) {
        html += '<div class="section-title">ПОЛЬЗОВАТЕЛИ</div>';
        results.users.forEach(u => {
            if (u.is_deleted) {
                html += `<div class="user-item"><div class="avatar" style="background:#666">X</div>
                    <div class="user-info"><div class="user-name" style="color:var(--text2)">Удалённый аккаунт</div></div></div>`;
                return;
            }
            
            const badges = [];
            if (u.username === 'maloy') badges.push('⭐');
            if (u.premium) badges.push('💎');
            if (u.is_verified) badges.push('✓');
            if (u.is_frozen) badges.push('❄️');
            
            html += `<div class="user-item" onclick="showUserProfile('${u.username}')">
                <div class="avatar" style="background:${u.avatar_color || '#a855f7'}">${(u.display_name || u.username)[0].toUpperCase()}</div>
                <div class="user-info">
                    <div class="user-name">${esc(u.display_name || u.username)} ${badges.join(' ')}</div>
                    <div class="user-status">@${u.username}</div>
                </div>
            </div>`;
        });
    }
    
    if (results.chats?.length) {
        html += '<div class="section-title">ЧАТЫ</div>';
        results.chats.forEach(ch => {
            html += `<div class="chat-item" onclick="joinChat('${ch.link}')">
                <div class="chat-icon" style="background:${ch.avatar_color || '#a855f7'}">${ch.type === 'channel' ? '📢' : '👥'}</div>
                <div class="chat-info"><div class="chat-name">${esc(ch.name)}</div></div>
            </div>`;
        });
    }
    
    if (!html) html = '<div class="empty-text" style="padding:20px;text-align:center">Ничего не найдено</div>';
    container.innerHTML = html;
}

function joinChat(link) {
    send({ type: 'join_chat', link });
}

// Modals
function showModal(id) {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

function showSettings() {
    showModal('settings-modal');
}

function backToSettings() {
    closeModal();
    showModal('settings-modal');
}

function showMyProfile() {
    document.getElementById('edit-name').value = currentUser.display_name || '';
    document.getElementById('edit-bio').value = currentUser.bio || '';
    document.getElementById('edit-avatar').textContent = (currentUser.display_name || currentUser.username)[0].toUpperCase();
    document.getElementById('edit-avatar').style.background = currentUser.avatar_color || '#a855f7';
    showModal('my-profile-modal');
}

function saveProfile() {
    const displayName = document.getElementById('edit-name').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    send({ type: 'update_profile', display_name: displayName, bio });
}

function pickAvatar() {
    document.getElementById('avatar-input').click();
}

function handleAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
        const data = ev.target.result;
        document.getElementById('edit-avatar').innerHTML = `<img src="${data}">`;
        send({ type: 'update_profile', avatar_data: data });
    };
    reader.readAsDataURL(file);
}

function showUserProfile(username) {
    viewingUser = username;
    send({ type: 'get_user_profile', username });
}

function showUserProfileData(user) {
    const badges = [];
    if (user.username === 'maloy') badges.push('⭐');
    if (user.premium) badges.push('💎');
    if (user.is_verified) badges.push('✓');
    if (user.is_frozen) badges.push('❄️');
    
    document.getElementById('profile-avatar').textContent = (user.display_name || user.username)[0].toUpperCase();
    document.getElementById('profile-avatar').style.background = user.avatar_color || '#a855f7';
    document.getElementById('profile-badges').textContent = badges.join(' ');
    document.getElementById('profile-name').textContent = user.display_name || user.username;
    document.getElementById('profile-username').textContent = '@' + user.username;
    document.getElementById('profile-bio').textContent = user.bio || '';
    
    // Gifts
    const giftsEl = document.getElementById('profile-gifts');
    if (user.gifts?.length) {
        giftsEl.innerHTML = user.gifts.slice(0, 10).map(g => {
            const gift = gifts.find(x => x.id === g.id);
            return gift ? `<span title="От ${g.from}">${gift.emoji}</span>` : '';
        }).join(' ');
    } else {
        giftsEl.innerHTML = '';
    }
    
    showModal('profile-modal');
}

// Create group/channel
function showCreateGroup() {
    document.getElementById('group-name').value = '';
    document.getElementById('group-desc').value = '';
    document.getElementById('group-public').checked = false;
    showModal('create-group-modal');
}

function createGroup() {
    const name = document.getElementById('group-name').value.trim();
    if (!name) {
        showToast('Введите название');
        return;
    }
    send({
        type: 'create_chat',
        chat_type: 'group',
        name,
        description: document.getElementById('group-desc').value.trim(),
        is_public: document.getElementById('group-public').checked
    });
}

function showCreateChannel() {
    document.getElementById('channel-name').value = '';
    document.getElementById('channel-desc').value = '';
    document.getElementById('channel-public').checked = false;
    showModal('create-channel-modal');
}

function createChannel() {
    const name = document.getElementById('channel-name').value.trim();
    if (!name) {
        showToast('Введите название');
        return;
    }
    send({
        type: 'create_chat',
        chat_type: 'channel',
        name,
        description: document.getElementById('channel-desc').value.trim(),
        is_public: document.getElementById('channel-public').checked
    });
}

// Gifts
function sendGift() {
    if (!viewingUser) return;
    initGifts();
    showModal('gift-modal');
}

function buyGift(giftId) {
    if (!viewingUser) return;
    send({ type: 'send_gift', to: viewingUser, gift_id: giftId });
    closeModal();
    showToast('Подарок отправлен!');
}

// Crystals
function transferCrystals() {
    if (!viewingUser) return;
    document.getElementById('transfer-balance').textContent = currentUser.crystals || 0;
    document.getElementById('transfer-amount').value = '';
    showModal('transfer-modal');
}

function doTransfer() {
    const amount = parseInt(document.getElementById('transfer-amount').value);
    if (!amount || amount <= 0) {
        showToast('Введите количество');
        return;
    }
    if (amount > currentUser.crystals) {
        showToast('Недостаточно кристаллов');
        return;
    }
    send({ type: 'transfer_crystals', to: viewingUser, amount });
    closeModal();
    showToast(`Передано ${amount} 💎`);
}

// Premium
function showPremium() {
    showModal('premium-modal');
}

function buyPremium() {
    send({ type: 'buy_premium' });
}

// Themes
function showThemes() {
    showToast('Темы в разработке');
}

// Admin
function showAdminPanel() {
    document.getElementById('admin-username').value = '';
    document.getElementById('admin-value').value = '';
    document.getElementById('admin-result').textContent = '';
    showModal('admin-modal');
}

function adminAction(action) {
    const username = document.getElementById('admin-username').value.trim().replace('@', '');
    const value = document.getElementById('admin-value').value.trim();
    
    if (!username) {
        showToast('Введите @username');
        return;
    }
    
    const data = { type: 'admin_action', action, target: username };
    
    if (action === 'give_crystals' && value) data.amount = parseInt(value);
    if (action === 'change_name' && value) data.new_name = value;
    if (action === 'warn' && value) data.reason = value;
    if (action === 'delete' && value) data.reason = value;
    if (action === 'shadow_ban' && value) data.reason = value;
    if (action === 'give_gift' && value) data.gift_id = value;
    
    send(data);
}

// Files
function attachFile() {
    document.getElementById('file-input').click();
}

function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
        const data = ev.target.result;
        let mediaType = 'file';
        if (file.type.startsWith('image/')) mediaType = 'image';
        else if (file.type.startsWith('video/')) mediaType = 'video';
        
        if (currentChatType === 'private') {
            send({ type: 'private_message', to: currentChat, text: file.name, media_type: mediaType, media_data: data });
        } else {
            send({ type: 'chat_message', chat_id: currentChat, text: file.name, media_type: mediaType, media_data: data });
        }
    };
    reader.readAsDataURL(file);
}

// Logout
function logout() {
    currentUser = null;
    currentChat = null;
    myChats = [];
    privateChats = {};
    chatMessages = {};
    if (socket) socket.close();
    showScreen('auth');
    closeModal();
}

function showChatInfo() {
    showToast('Информация о чате');
}

// Utils
function esc(s) {
    return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
}

// Start
connect();
