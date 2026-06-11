
        // API URL CONFIGURATION
        let API_URL = window.location.origin;
        if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '8787') {
            API_URL = 'http://localhost:8081'; // Port of Spring Boot backend
        }

        let stompClient = null;
        let currentUser = null;
        let selectedRecipient = null;
        let selectedGroupId = null;
        let userGroups = [];
        let allUsers = [];
        let currentTab = 'chats';
        let sidebarMode = 'friends'; // 'friends', 'groups', or 'discover'
        let unreadCounts = {};
        let lastMessages = {};
        let typingTimeout = null;
        let typingHideTimeout = null;
        let tempSignupUsername = null;
        let tempSignupEmail = null;
        let tempResetEmail = null;

        async function authFetch(url, options = {}) {
            if (currentUser && currentUser.token) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${currentUser.token}`
                };
            }
            return fetch(url, options);
        }

        function switchSidebarTab(mode) {
            sidebarMode = mode;
            document.getElementById('tab-btn-friends').classList.toggle('active', mode === 'friends');
            document.getElementById('tab-btn-discover').classList.toggle('active', mode === 'discover');
            displayUsers(allUsers, document.getElementById('user-search').value);
        }


        function switchTab(tab) {
            currentTab = tab;
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            if (tab === 'chats') {
                document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
                document.getElementById('tab-chats').classList.add('active');
            }
        }

        // Auto-login from saved session
        window.addEventListener('DOMContentLoaded', () => {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                try {
                    currentUser = JSON.parse(savedUser);
                    console.log('🔄 Auto-logging in as:', currentUser.username);
                    enterChat();
                } catch (e) {
                    console.error('Failed to parse saved user:', e);
                    localStorage.removeItem('currentUser');
                }
            }
        });

        // Toggle between login and signup
        document.getElementById('show-signup').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-form').classList.add('hidden');
            document.querySelector('.toggle-auth').classList.add('hidden');
            document.getElementById('signup-form').classList.remove('hidden');
            document.getElementById('show-login-link').classList.remove('hidden');
        });

        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('signup-form').classList.add('hidden');
            document.getElementById('show-login-link').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
            document.querySelector('.toggle-auth').classList.remove('hidden');
        });

        // Show Password Reset Request Form
        document.getElementById('forgot-password-link').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-form').classList.add('hidden');
            document.querySelector('.toggle-auth').classList.add('hidden');
            document.getElementById('password-reset-request-form').classList.remove('hidden');
            document.getElementById('reset-request-error').classList.add('hidden');
            document.getElementById('reset-request-email').value = '';
        });

        // Back to login from password reset forms
        document.querySelectorAll('.back-to-login').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('password-reset-request-form').classList.add('hidden');
                document.getElementById('password-reset-confirm-form').classList.add('hidden');
                document.getElementById('login-form').classList.remove('hidden');
                document.querySelector('.toggle-auth').classList.remove('hidden');
            });
        });

        // Request Password Reset Submit
        document.getElementById('password-reset-request-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('reset-request-email').value.trim();
            const errorDiv = document.getElementById('reset-request-error');

            try {
                const response = await fetch(`${API_URL}/password-reset/request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                if (response.ok) {
                    tempResetEmail = email;
                    errorDiv.classList.add('hidden');
                    document.getElementById('password-reset-request-form').classList.add('hidden');
                    document.getElementById('password-reset-confirm-form').classList.remove('hidden');
                    document.getElementById('reset-confirm-error').classList.add('hidden');
                    document.getElementById('reset-confirm-otp').value = '';
                    document.getElementById('reset-confirm-password').value = '';
                } else {
                    const error = await response.json();
                    errorDiv.textContent = error.error || 'Request failed';
                    errorDiv.classList.remove('hidden');
                }
            } catch (err) {
                console.error(err);
                errorDiv.textContent = 'Server connection failed';
                errorDiv.classList.remove('hidden');
            }
        });

        // Confirm Password Reset Submit
        document.getElementById('password-reset-confirm-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const otpCode = document.getElementById('reset-confirm-otp').value.trim();
            const newPassword = document.getElementById('reset-confirm-password').value;
            const errorDiv = document.getElementById('reset-confirm-error');

            try {
                const response = await fetch(`${API_URL}/password-reset/confirm`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: tempResetEmail,
                        otp: otpCode,
                        secret: newPassword
                    })
                });

                if (response.ok) {
                    alert('✅ Password reset successful! You can now log in with your new password.');
                    errorDiv.classList.add('hidden');
                    document.getElementById('password-reset-confirm-form').classList.add('hidden');
                    document.getElementById('login-form').classList.remove('hidden');
                    document.querySelector('.toggle-auth').classList.remove('hidden');
                    document.getElementById('login-username').value = '';
                    document.getElementById('login-password').value = '';
                } else {
                    const error = await response.json();
                    errorDiv.textContent = error.error || 'Verification failed';
                    errorDiv.classList.remove('hidden');
                }
            } catch (err) {
                console.error(err);
                errorDiv.textContent = 'Server connection failed';
                errorDiv.classList.remove('hidden');
            }
        });

        // Resend Password Reset OTP
        document.getElementById('reset-otp-resend').addEventListener('click', async (e) => {
            e.preventDefault();
            const errorDiv = document.getElementById('reset-confirm-error');
            const resendLink = document.getElementById('reset-otp-resend');
            const originalText = resendLink.textContent;

            resendLink.textContent = 'Sending...';
            resendLink.style.pointerEvents = 'none';

            try {
                const response = await fetch(`${API_URL}/password-reset/request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: tempResetEmail })
                });

                if (response.ok) {
                    alert('✅ A new reset OTP has been sent to your email.');
                    errorDiv.classList.add('hidden');
                } else {
                    const error = await response.json();
                    errorDiv.textContent = error.error || 'Resend failed';
                    errorDiv.classList.remove('hidden');
                }
            } catch (err) {
                console.error(err);
                errorDiv.textContent = 'Server connection failed';
                errorDiv.classList.remove('hidden');
            } finally {
                resendLink.textContent = originalText;
                resendLink.style.pointerEvents = 'auto';
            }
        });

        // Login
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;

            try {
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, secret: password })
                });

                if (response.ok) {
                    currentUser = await response.json();
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    showError('login', '');
                    enterChat();
                } else {
                    const error = await response.json();
                    showError('login', error.error || 'Invalid credentials');
                }
            } catch (e) {
                console.error(e);
                showError('login', 'Server connection failed');
            }
        });

        // Signup
        document.getElementById('signup-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('signup-username').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const firstName = document.getElementById('signup-firstname').value.trim();
            const lastName = document.getElementById('signup-lastname').value.trim();
            const password = document.getElementById('signup-password').value;

            try {
                const response = await fetch(`${API_URL}/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, firstName, lastName, secret: password })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.otpRequired) {
                        // Show OTP verification form
                        document.getElementById('signup-form').classList.add('hidden');
                        document.getElementById('show-login-link').classList.add('hidden');
                        document.getElementById('otp-form').classList.remove('hidden');
                        document.getElementById('otp-error').classList.add('hidden');
                        document.getElementById('otp-code').value = '';
                        
                        // Keep track of registration details for validation
                        tempSignupUsername = data.username;
                        tempSignupEmail = data.email;
                        showError('signup', '');
                    } else {
                        currentUser = data;
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                        showError('signup', '');
                        enterChat();
                    }
                } else {
                    const error = await response.json();
                    showError('signup', error.error || 'Signup failed');
                }
            } catch (e) {
                console.error(e);
                showError('signup', 'Server connection failed');
            }
        });

        // OTP Verification Submission
        document.getElementById('otp-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const otpCode = document.getElementById('otp-code').value.trim();
            const errorDiv = document.getElementById('otp-error');

            try {
                const response = await fetch(`${API_URL}/signup/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: tempSignupUsername,
                        email: tempSignupEmail,
                        otp: otpCode
                    })
                });

                if (response.ok) {
                    currentUser = await response.json();
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    errorDiv.classList.add('hidden');
                    
                    // Hide OTP Form and Enter Chat
                    document.getElementById('otp-form').classList.add('hidden');
                    enterChat();
                } else {
                    const error = await response.json();
                    errorDiv.textContent = error.error || 'Verification failed';
                    errorDiv.classList.remove('hidden');
                }
            } catch (e) {
                console.error(e);
                errorDiv.textContent = 'Server connection failed';
                errorDiv.classList.remove('hidden');
            }
        });

        // OTP "Change Details" (Back to Signup)
        document.getElementById('show-signup-from-otp').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('otp-form').classList.add('hidden');
            document.getElementById('signup-form').classList.remove('hidden');
            document.getElementById('show-login-link').classList.remove('hidden');
        });

        // OTP "Resend OTP"
        document.getElementById('otp-resend').addEventListener('click', async (e) => {
            e.preventDefault();
            const errorDiv = document.getElementById('otp-error');
            const resendLink = document.getElementById('otp-resend');
            const originalText = resendLink.textContent;
            
            resendLink.textContent = 'Sending...';
            resendLink.style.pointerEvents = 'none';

            try {
                // Re-trigger signup submit
                const username = document.getElementById('signup-username').value.trim();
                const email = document.getElementById('signup-email').value.trim();
                const firstName = document.getElementById('signup-firstname').value.trim();
                const lastName = document.getElementById('signup-lastname').value.trim();
                const password = document.getElementById('signup-password').value;

                const response = await fetch(`${API_URL}/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, firstName, lastName, secret: password })
                });

                if (response.ok) {
                    alert('✅ A new OTP verification code has been sent to your email.');
                    errorDiv.classList.add('hidden');
                } else {
                    const error = await response.json();
                    errorDiv.textContent = error.error || 'Resend failed';
                    errorDiv.classList.remove('hidden');
                }
            } catch (err) {
                console.error(err);
                errorDiv.textContent = 'Server connection failed';
                errorDiv.classList.remove('hidden');
            } finally {
                resendLink.textContent = originalText;
                resendLink.style.pointerEvents = 'auto';
            }
        });

        function showError(type, message) {
            const errorDiv = document.getElementById(`${type}-error`);
            if (message) {
                errorDiv.textContent = message;
                errorDiv.classList.remove('hidden');
            } else {
                errorDiv.classList.add('hidden');
            }
        }

        async function enterChat() {
            document.getElementById('auth-page').style.display = 'none';
            const adminBtn = document.querySelector('.admin-menu-btn');
            if (adminBtn) adminBtn.style.display = 'none';
            document.getElementById('chat-app').classList.add('active');
            document.getElementById('current-username').textContent = currentUser.username;

            // Set sidebar avatar initials
            const _name = currentUser.firstName && currentUser.lastName
                ? `${currentUser.firstName} ${currentUser.lastName}`
                : currentUser.username;
            const _initials = _name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            document.getElementById('sidebar-avatar-initials').textContent = _initials;

            // Connect to WebSocket via standard WebSocket (not SockJS)
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${API_URL.replace(/^http/, 'ws')}/ws?username=${currentUser.username}&token=${currentUser.token}`;
            const socket = new WebSocket(wsUrl);
            stompClient = Stomp.over(socket);

            stompClient.debug = null;

            // Pre-load groups list so we can subscribe to them on socket connect
            try {
                const response = await authFetch(`${API_URL}/groups/user/${currentUser.username}`);
                if (response.ok) {
                    userGroups = await response.json();
                }
            } catch (e) { console.error("Failed to load user groups:", e); }

            stompClient.connect({}, onConnected, onError);
        }

        let globalRefreshInterval = null;
        let requestRefreshInterval = null;

        function startAutoRefresh() {
            // Refresh user list + last message previews every 10s
            globalRefreshInterval = setInterval(async () => {
                if (!currentUser) return;
                try {
                    await loadFriendsList();
                    const r = await authFetch(`${API_URL}/users/search?username=`);
                    if (!r.ok) return;
                    const users = await r.json();
                    allUsers = users.filter(u => u.username !== currentUser.username);
                    const currentItems = document.querySelectorAll('.user-item').length;
                    if (currentItems !== allUsers.length && sidebarMode !== 'groups') {
                        displayUsers(allUsers);
                    }
                } catch (e) { /* silent */ }
            }, 10000);

            // Refresh friend request badge every 30s
            requestRefreshInterval = setInterval(() => {
                if (currentUser) loadPendingRequests();
            }, 30000);
        }

        function stopAutoRefresh() {
            if (globalRefreshInterval) { clearInterval(globalRefreshInterval); globalRefreshInterval = null; }
            if (requestRefreshInterval) { clearInterval(requestRefreshInterval); requestRefreshInterval = null; }
        }

        function onConnected() {
            console.log('✅ Connected to WebSocket');
            stompClient.subscribe('/user/queue/private', onMessageReceived);
            stompClient.subscribe('/user/queue/typing', onTypingReceived);
            
            // Subscribe to all group channels
            userGroups.forEach(group => {
                stompClient.subscribe(`/topic/group.${group.id}`, onGroupMessageReceived);
            });

            // Load users and pending requests
            loadUsers();
            loadPendingRequests();
            // Start background auto-refresh
            startAutoRefresh();
        }

        function onMessageReceived(payload) {
            const message = JSON.parse(payload.body);
            
            if (message.type === 'MESSAGE_EDITED') {
                updateMessageInDOM(message.id, message.content, true);
                return;
            }
            if (message.type === 'MESSAGE_DELETED') {
                updateMessageInDOM(message.id, 'This message was deleted', false, true);
                return;
            }
            if (message.type === 'REACTION_ADDED' || message.type === 'REACTION_REMOVED') {
                loadMessageReactions(message.messageId);
                return;
            }

            console.log('[WS] Private message from', message.sender);
            const otherUser = message.sender === currentUser.username ? message.recipient : message.sender;

            updateLastMessage(otherUser, message.content);

            if (selectedRecipient === otherUser) {
                displayMessage(message);
                if (message.sender !== currentUser.username) {
                    markAsRead(otherUser);
                }
            } else {
                if (message.sender !== currentUser.username) {
                    unreadCounts[otherUser] = (unreadCounts[otherUser] || 0) + 1;
                    const badge = document.getElementById(`unread-${otherUser}`);
                    if (badge) {
                        badge.textContent = unreadCounts[otherUser];
                        badge.style.display = 'flex';
                    }
                }
            }
        }

        function onGroupMessageReceived(payload) {
            const message = JSON.parse(payload.body);
            
            if (message.type === 'MESSAGE_EDITED') {
                updateMessageInDOM(message.id, message.content, true);
                return;
            }
            if (message.type === 'MESSAGE_DELETED') {
                updateMessageInDOM(message.id, 'This message was deleted', false, true);
                return;
            }
            if (message.type === 'REACTION_ADDED' || message.type === 'REACTION_REMOVED') {
                loadMessageReactions(message.messageId);
                return;
            }

            const groupId = message.groupId;
            const previewEl = document.getElementById(`preview-group-${groupId}`);
            if (previewEl) {
                previewEl.textContent = `${message.sender}: ${message.content.length > 20 ? message.content.slice(0, 20) + '…' : message.content}`;
            }

            if (selectedGroupId === groupId) {
                displayMessage(message);
            } else {
                if (message.sender !== currentUser.username) {
                    unreadCounts[`group:${groupId}`] = (unreadCounts[`group:${groupId}`] || 0) + 1;
                    const badge = document.getElementById(`unread-group-${groupId}`);
                    if (badge) {
                        badge.textContent = unreadCounts[`group:${groupId}`];
                        badge.style.display = 'flex';
                    }
                }
            }
        }

        function updateMessageInDOM(msgId, content, isEdited, isDeleted = false) {
            const msgEl = document.getElementById(`msg-${msgId}`);
            if (!msgEl) return;

            const bodyEl = msgEl.querySelector('.msg-body');
            if (bodyEl) {
                bodyEl.textContent = content;
            }

            if (isEdited) {
                let badge = msgEl.querySelector('.msg-edited-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'msg-edited-badge';
                    badge.textContent = ' (edited)';
                    msgEl.querySelector('.message-content').appendChild(badge);
                }
            }

            if (isDeleted) {
                msgEl.classList.add('deleted');
                const actions = msgEl.querySelector('.msg-actions');
                if (actions) actions.remove();
                const replyBtn = msgEl.querySelector('.reply-action-btn');
                if (replyBtn) replyBtn.remove();
                const reactBtn = msgEl.querySelector('.react-action-btn');
                if (reactBtn) reactBtn.remove();
            }
        }

        function onTypingReceived(payload) {
            // status indicator removed
        }

        function sendTypingEvent() {
            if (stompClient && selectedRecipient) {
                stompClient.send('/app/chat.typing', {}, JSON.stringify({
                    sender: currentUser.username,
                    recipient: selectedRecipient
                }));
            }
        }

        function updateLastMessage(username, content) {
            lastMessages[username] = { content };
            const previewEl = document.getElementById(`preview-${username}`);
            if (previewEl) {
                previewEl.textContent = content.length > 28 ? content.slice(0, 28) + '…' : content;
            }
        }

        function onError(error) {
            console.error('WebSocket error:', error);
            alert('Could not connect to chat server');
        }

        function switchSidebarTab(mode) {
            sidebarMode = mode;
            document.getElementById('tab-btn-friends').classList.toggle('active', mode === 'friends');
            document.getElementById('tab-btn-groups').classList.toggle('active', mode === 'groups');
            document.getElementById('tab-btn-discover').classList.toggle('active', mode === 'discover');
            
            if (mode === 'groups') {
                loadGroups();
            } else {
                displayUsers(allUsers, document.getElementById('user-search').value);
            }
        }

        // Friend Request Functions
        function toggleFriendRequests() {
            const panel = document.getElementById('requests-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }

        async function loadPendingRequests() {
            try {
                const response = await authFetch(`${API_URL}/friends/requests/pending?username=${currentUser.username}`);
                if (response.ok) {
                    const requests = await response.json();
                    const badge = document.getElementById('request-badge');
                    const list = document.getElementById('pending-requests-list');

                    if (requests.length > 0) {
                        badge.textContent = requests.length;
                        badge.style.display = 'flex';

                        list.innerHTML = requests.map(req => `
                            <div style="background: white; padding: 8px; border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                <span style="font-weight: 600; font-size: 13px;">${req.sender}</span>
                                <div style="display: flex; gap: 5px;">
                                    <button onclick="acceptRequest(${req.id})" style="background: #4ade80; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">Accept</button>
                                    <button onclick="rejectRequest(${req.id})" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">Reject</button>
                                </div>
                            </div>
                        `).join('');
                    } else {
                        badge.style.display = 'none';
                        list.innerHTML = '<div style="color: #999; font-size: 12px; text-align: center;">No pending requests</div>';
                    }
                }
            } catch (e) { console.error("Error loading requests:", e); }
        }

        async function sendFriendRequest(receiver) {
            try {
                const response = await authFetch(`${API_URL}/friends/request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sender: currentUser.username, receiver: receiver })
                });

                if (response.ok) {
                    alert(`✅ Friend request sent to ${receiver}!`);
                    loadUsers();
                } else {
                    const error = await response.json();
                    alert(`❌ ${error.error || 'Failed to send request'}`);
                }
            } catch (e) {
                console.error(e);
                alert('Connection error');
            }
        }

        async function acceptRequest(id) {
            try {
                await authFetch(`${API_URL}/friends/accept/${id}`, { method: 'POST' });
                loadPendingRequests();
                loadUsers();
                loadFriendsList();
            } catch (e) { console.error(e); }
        }

        async function rejectRequest(id) {
            try {
                await authFetch(`${API_URL}/friends/reject/${id}`, { method: 'POST' });
                loadPendingRequests();
            } catch (e) { console.error(e); }
        }

        let friendsList = [];
        async function loadFriendsList() {
            try {
                const response = await authFetch(`${API_URL}/friends/list?username=${currentUser.username}`);
                if (response.ok) {
                    friendsList = await response.json();
                }
            } catch (e) { console.error(e); }
        }

        async function loadUsers() {
            try {
                await loadFriendsList();
                const response = await authFetch(`${API_URL}/users/search?username=`);
                const users = await response.json();
                allUsers = users.filter(u => u.username !== currentUser.username);
                if (sidebarMode !== 'groups') {
                    displayUsers(allUsers);
                }
            } catch (e) {
                console.error('Load users error:', e);
                document.getElementById('users-list').innerHTML = '<div class="empty-state">Error loading users</div>';
            }
        }

        function displayUsers(users, query = '') {
            const usersList = document.getElementById('users-list');

            if (users.length === 0) {
                usersList.innerHTML = '<div class="empty-state">No users found</div>';
                return;
            }

            usersList.innerHTML = '';

            const friends = users.filter(u => friendsList.includes(u.username));
            const available = users.filter(u => !friendsList.includes(u.username));

            if (query) {
                renderSection(`Search Results for "${query}"`, users);
            } else if (sidebarMode === 'friends') {
                renderSection('My Friends', friends);
                if (friends.length === 0) {
                    usersList.innerHTML = '<div class="empty-state">No friends yet. Search and add some!</div>';
                }
            } else if (sidebarMode === 'discover') {
                renderSection('Discover Users', available);
                if (available.length === 0) {
                    usersList.innerHTML = '<div class="empty-state">Everyone is your friend! Wow!</div>';
                }
            }

            function renderSection(label, list) {
                if (list.length === 0) return;
                const labelEl = document.createElement('div');
                labelEl.className = 'sidebar-section-label';
                labelEl.textContent = label;
                usersList.appendChild(labelEl);

                list.forEach(user => {
                    const isFriend = friendsList.includes(user.username);
                    let statusHtml = isFriend
                        ? `<span style="color: var(--success); font-size: 12px; font-weight: 600;">Friend ✅</span>
                           <button onclick="unfriend('${user.username}'); event.stopPropagation();" class="btn-unfriend" title="Remove friend">✕ Unfriend</button>`
                        : `<button onclick="sendFriendRequest('${user.username}'); event.stopPropagation();" class="btn btn-primary" style="padding:3px 10px; font-size:11px;">Add Friend</button>`;

                    const gradient = avatarColor(user.username);

                    const userItem = document.createElement('div');
                    userItem.className = 'user-item';
                    userItem.id = `user-${user.username}`;
                    userItem.onclick = () => selectUser(user.username);

                    userItem.innerHTML = `
                        <div class="user-avatar-wrap">
                            <div class="user-avatar" style="background:${gradient}">${user.username[0].toUpperCase()}</div>
                        </div>
                        <div class="user-info">
                            <div class="user-name-row">
                                <div class="user-name">${user.username}</div>
                                <div class="unread-badge" id="unread-${user.username}" style="display:none;">0</div>
                            </div>
                            <div class="user-last-preview" id="preview-${user.username}">${isFriend ? '👋 Say hi!' : 'Send a friend request'}</div>
                            <div class="status-row">
                                <div>${statusHtml}</div>
                            </div>
                        </div>
                    `;
                    usersList.appendChild(userItem);
                });
            }
        }

        async function loadGroups() {
            try {
                const response = await authFetch(`${API_URL}/groups/user/${currentUser.username}`);
                if (response.ok) {
                    userGroups = await response.json();
                    displayGroups(userGroups);
                }
            } catch (e) {
                console.error("Error loading groups:", e);
                document.getElementById('users-list').innerHTML = '<div class="empty-state">Error loading groups</div>';
            }
        }

        function displayGroups(groups) {
            const list = document.getElementById('users-list');
            list.innerHTML = '';

            const createCard = document.createElement('div');
            createCard.className = 'create-group-btn-card';
            createCard.innerHTML = `
                <button onclick="openCreateGroupModal()" class="btn btn-primary" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:12px; border-radius:var(--radius-sm);">
                    <span class="material-symbols-outlined">group_add</span> Create New Group
                </button>
            `;
            list.appendChild(createCard);

            if (groups.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'empty-state';
                empty.textContent = 'No groups yet. Create one above!';
                list.appendChild(empty);
                return;
            }

            const sectionLabel = document.createElement('div');
            sectionLabel.className = 'sidebar-section-label';
            sectionLabel.textContent = 'My Groups';
            list.appendChild(sectionLabel);

            groups.forEach(group => {
                const groupEl = document.createElement('div');
                groupEl.className = 'user-item group-item';
                groupEl.id = `group-${group.id}`;
                groupEl.onclick = () => selectGroup(group.id, group.name);

                const unreadId = `unread-group-${group.id}`;
                const previewId = `preview-group-${group.id}`;
                const gradient = avatarColor(group.name);

                groupEl.innerHTML = `
                    <div class="user-avatar-wrap">
                        <div class="user-avatar" style="background:${gradient}">👥</div>
                    </div>
                    <div class="user-info">
                        <div class="user-name-row">
                            <div class="user-name">${escapeHtml(group.name)}</div>
                            <div class="unread-badge" id="${unreadId}" style="display:none;">0</div>
                        </div>
                        <div class="user-last-preview" id="${previewId}">Group chat</div>
                    </div>
                `;
                list.appendChild(groupEl);
            });
        }

        function openCreateGroupModal() {
            document.getElementById('create-group-modal').style.display = 'flex';
            const selectList = document.getElementById('group-members-select-list');
            selectList.innerHTML = '';

            if (friendsList.length === 0) {
                selectList.innerHTML = '<div style="color:#999; font-size:13px; text-align:center; padding:10px 0;">No friends to add. Add friends first!</div>';
                return;
            }

            friendsList.forEach(friend => {
                const item = document.createElement('div');
                item.className = 'friend-checkbox-item';
                item.innerHTML = `
                    <input type="checkbox" id="chk-${friend}" value="${friend}">
                    <label for="chk-${friend}">${friend}</label>
                `;
                selectList.appendChild(item);
            });
        }

        function closeCreateGroupModal() {
            document.getElementById('create-group-modal').style.display = 'none';
            document.getElementById('group-name-input').value = '';
        }

        async function submitCreateGroup() {
            const name = document.getElementById('group-name-input').value.trim();
            if (!name) return alert('Group name is required');

            const checkedBoxes = document.querySelectorAll('#group-members-select-list input[type="checkbox"]:checked');
            const members = Array.from(checkedBoxes).map(cb => cb.value);

            try {
                const response = await authFetch(`${API_URL}/groups/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        createdBy: currentUser.username,
                        members: members
                    })
                });

                if (response.ok) {
                    const group = await response.json();
                    closeCreateGroupModal();
                    await loadGroups();
                    if (stompClient && stompClient.connected) {
                        stompClient.subscribe(`/topic/group.${group.id}`, onGroupMessageReceived);
                    }
                    selectGroup(group.id, group.name);
                } else {
                    const err = await response.json();
                    alert('Error: ' + (err.error || 'Failed to create group'));
                }
            } catch (e) {
                console.error(e);
                alert('Connection error');
            }
        }

        async function leaveGroup(groupId) {
            if (!confirm('Are you sure you want to leave this group?')) return;
            try {
                const response = await authFetch(`${API_URL}/groups/${groupId}/leave`, {
                    method: 'POST'
                });
                if (response.ok) {
                    exitChatView();
                    loadGroups();
                } else {
                    alert('Failed to leave group');
                }
            } catch (e) {
                console.error(e);
                alert('Connection error');
            }
        }

        function filterUsers(query) {
            const filtered = query
                ? allUsers.filter(user => user.username.toLowerCase().includes(query.toLowerCase()))
                : allUsers;
            displayUsers(filtered, query);
        }

        function exitChatView() {
            stopChatPolling();
            stopGroupPolling();
            document.getElementById('chat-app').classList.remove('mobile-chat-active');
            selectedRecipient = null;
            selectedGroupId = null;
            cancelReply();
            toggleChatSearch(false);
            
            const blockBtn = document.getElementById('block-user-header-btn');
            if (blockBtn) blockBtn.style.display = 'none';
            const searchBtn = document.getElementById('search-chat-header-btn');
            if (searchBtn) searchBtn.style.display = 'none';

            document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
        }

        async function selectUser(username) {
            selectedRecipient = username;
            selectedGroupId = null;
            cancelReply();
            toggleChatSearch(false);

            // Enable Mobile View
            document.getElementById('chat-app').classList.add('mobile-chat-active');

            // Update header
            document.getElementById('chat-avatar').textContent = username[0].toUpperCase();
            document.getElementById('chat-avatar').style.background = avatarColor(username);
            document.getElementById('chat-name').textContent = username;

            // Show delete and block buttons
            const deleteBtn = document.getElementById('delete-chat-btn');
            deleteBtn.style.display = 'inline-flex';
            deleteBtn.innerHTML = '<span class="material-symbols-outlined">delete</span> Delete Chat';
            deleteBtn.onclick = () => deleteChat();

            let blockBtn = document.getElementById('block-user-header-btn');
            if (!blockBtn) {
                blockBtn = document.createElement('button');
                blockBtn.id = 'block-user-header-btn';
                blockBtn.className = 'btn-danger-outline';
                document.querySelector('.chat-header-actions').insertBefore(blockBtn, deleteBtn);
            }
            blockBtn.style.display = 'inline-flex';
            blockBtn.innerHTML = '<span class="material-symbols-outlined">block</span> Block User';
            blockBtn.onclick = () => blockUserAction(username);

            let searchBtn = document.getElementById('search-chat-header-btn');
            if (!searchBtn) {
                searchBtn = document.createElement('button');
                searchBtn.id = 'search-chat-header-btn';
                searchBtn.className = 'icon-btn';
                searchBtn.title = 'Search Messages';
                searchBtn.innerHTML = '<span class="material-symbols-outlined">search</span>';
                document.querySelector('.chat-header-actions').insertBefore(searchBtn, blockBtn);
            }
            searchBtn.style.display = 'inline-flex';
            searchBtn.onclick = () => toggleChatSearch(true);

            // Check if friend to enable/disable input
            const isFriend = friendsList.includes(username);
            const input = document.getElementById('message-input');
            const btn = document.getElementById('send-btn');

            if (isFriend) {
                input.disabled = false;
                input.placeholder = "Type a message...";
                btn.disabled = false;
                btn.style.opacity = "1";
                btn.style.cursor = "pointer";
            } else {
                input.disabled = true;
                input.placeholder = "Accepted friend request required to chat";
                btn.disabled = true;
                btn.style.opacity = "0.5";
                btn.style.cursor = "not-allowed";
            }

            document.getElementById('messages').innerHTML = '';

            unreadCounts[username] = 0;
            const badge = document.getElementById(`unread-${username}`);
            if (badge) badge.style.display = 'none';

            document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
            const userEl = document.getElementById(`user-${username}`);
            if (userEl) userEl.classList.add('active');

            loadChatHistory(username);
            markAsRead(username);
        }

        async function selectGroup(groupId, groupName) {
            selectedGroupId = groupId;
            selectedRecipient = null;
            cancelReply();
            toggleChatSearch(false);

            document.getElementById('chat-app').classList.add('mobile-chat-active');

            document.getElementById('chat-avatar').textContent = '👥';
            document.getElementById('chat-avatar').style.background = avatarColor(groupName);
            document.getElementById('chat-name').textContent = groupName;

            const deleteBtn = document.getElementById('delete-chat-btn');
            deleteBtn.style.display = 'inline-flex';
            deleteBtn.innerHTML = '<span class="material-symbols-outlined">logout</span> Leave Group';
            deleteBtn.onclick = () => leaveGroup(groupId);

            // Hide block user btn in groups
            const blockBtn = document.getElementById('block-user-header-btn');
            if (blockBtn) blockBtn.style.display = 'none';

            let searchBtn = document.getElementById('search-chat-header-btn');
            if (!searchBtn) {
                searchBtn = document.createElement('button');
                searchBtn.id = 'search-chat-header-btn';
                searchBtn.className = 'icon-btn';
                searchBtn.title = 'Search Messages';
                searchBtn.innerHTML = '<span class="material-symbols-outlined">search</span>';
                document.querySelector('.chat-header-actions').insertBefore(searchBtn, deleteBtn);
            }
            searchBtn.style.display = 'inline-flex';
            searchBtn.onclick = () => toggleChatSearch(true);

            const input = document.getElementById('message-input');
            const btn = document.getElementById('send-btn');
            input.disabled = false;
            input.placeholder = "Type a message to group...";
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";

            document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
            const groupEl = document.getElementById(`group-${groupId}`);
            if (groupEl) groupEl.classList.add('active');

            const unreadBadge = document.getElementById(`unread-group-${groupId}`);
            if (unreadBadge) unreadBadge.style.display = 'none';

            document.getElementById('messages').innerHTML = '';

            loadGroupHistory(groupId);
        }

        async function markAsRead(contact) {
            try {
                await authFetch(`${API_URL}/messages/${contact}/read`, { method: 'POST' });
            } catch (e) { /* ignore */ }
        }

        async function deleteChat() {
            if (!selectedRecipient) return;
            if (!confirm(`Are you sure you want to delete all messages with ${selectedRecipient}? This cannot be undone.`)) return;

            try {
                const response = await authFetch(`${API_URL}/messages/${selectedRecipient}?currentUser=${currentUser.username}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    document.getElementById('messages').innerHTML = `
                        <div class="empty-state-chat">
                            <span class="material-symbols-outlined" style="font-size:48px; color: var(--text-muted);">delete_sweep</span>
                            <p>Conversation deleted</p>
                        </div>
                    `;
                    lastMessages[selectedRecipient] = null;
                    const previewEl = document.getElementById(`preview-${selectedRecipient}`);
                    if (previewEl) previewEl.textContent = '👋 Say hi!';
                } else {
                    alert('Failed to delete chat');
                }
            } catch (err) {
                console.error('Error deleting chat:', err);
                alert('Connection error');
            }
        }

        let chatPollInterval = null;
        let groupPollInterval = null;
        let dbMsgCount = 0; 

        function startChatPolling(contact) {
            stopChatPolling();
            stopGroupPolling();
            chatPollInterval = setInterval(async () => {
                if (!selectedRecipient || selectedRecipient !== contact) return stopChatPolling();
                try {
                    const r = await authFetch(`${API_URL}/messages/${contact}?currentUser=${currentUser.username}`);
                    if (!r.ok) return;
                    const msgs = await r.json();
                    if (msgs.length > dbMsgCount) {
                        const newMsgs = msgs.slice(dbMsgCount);
                        newMsgs.forEach(displayMessage);
                        dbMsgCount = msgs.length;
                    }
                } catch (e) { /* silent */ }
            }, 2000);
        }

        function stopChatPolling() {
            if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
        }

        function startGroupPolling(groupId) {
            stopChatPolling();
            stopGroupPolling();
            groupPollInterval = setInterval(async () => {
                if (selectedGroupId !== groupId) return stopGroupPolling();
                try {
                    const r = await authFetch(`${API_URL}/groups/${groupId}/messages`);
                    if (!r.ok) return;
                    const msgs = await r.json();
                    if (msgs.length > dbMsgCount) {
                        const newMsgs = msgs.slice(dbMsgCount);
                        newMsgs.forEach(displayMessage);
                        dbMsgCount = msgs.length;
                    }
                } catch (e) { /* silent */ }
            }, 2000);
        }

        function stopGroupPolling() {
            if (groupPollInterval) { clearInterval(groupPollInterval); groupPollInterval = null; }
        }

        async function loadChatHistory(contact) {
            dbMsgCount = 0; 
            try {
                const response = await authFetch(`${API_URL}/messages/${contact}?currentUser=${currentUser.username}`);
                if (response.ok) {
                    const messages = await response.json();
                    messages.forEach(displayMessage);
                    dbMsgCount = messages.length; 
                    startChatPolling(contact);
                }
            } catch (e) {
                console.error('Error loading history:', e);
            }
        }

        async function loadGroupHistory(groupId) {
            dbMsgCount = 0;
            try {
                const response = await authFetch(`${API_URL}/groups/${groupId}/messages`);
                if (response.ok) {
                    const messages = await response.json();
                    messages.forEach(displayMessage);
                    dbMsgCount = messages.length;
                    startGroupPolling(groupId);
                }
            } catch (e) {
                console.error('Error loading group history:', e);
            }
        }

        // Typing indicator trigger
        document.getElementById('message-input').addEventListener('input', () => {
            clearTimeout(typingTimeout);
            sendTypingEvent();
            typingTimeout = setTimeout(() => { }, 2000);
        });

        // Send message
        document.getElementById('message-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const messageInput = document.getElementById('message-input');
            const messageContent = messageInput.value.trim();

            if (messageContent && stompClient) {
                const chatMessage = {
                    sender: currentUser.username,
                    content: messageContent,
                    type: 'CHAT',
                    timestamp: Date.now()
                };

                if (activeReplyToId) {
                    chatMessage.replyToId = activeReplyToId;
                    cancelReply();
                }

                if (selectedRecipient) {
                    chatMessage.recipient = selectedRecipient;
                    stompClient.send("/app/chat.private", {}, JSON.stringify(chatMessage));
                } else if (selectedGroupId) {
                    chatMessage.groupId = selectedGroupId;
                    stompClient.send("/app/chat.group", {}, JSON.stringify(chatMessage));
                }

                messageInput.value = '';
            }
        });

        function displayMessage(message) {
            const messagesDiv = document.getElementById('messages');

            const welcome = messagesDiv.querySelector('.welcome-screen');
            if (welcome) welcome.remove();

            if (message.id && document.getElementById(`msg-${message.id}`)) {
                return;
            }

            const messageDiv = document.createElement('div');
            messageDiv.className = 'message';
            if (message.id) {
                messageDiv.id = `msg-${message.id}`;
            }

            const isOwn = message.sender === currentUser.username;
            if (isOwn) {
                messageDiv.classList.add('own');
            }
            if (message.isDeleted || message.deleted) {
                messageDiv.classList.add('deleted');
            }

            const safeContent = escapeHtml(message.content);

            let actionButtons = '';
            if (!message.isDeleted && !message.deleted && message.id) {
                actionButtons += `<button class="msg-action-btn reply-action-btn" title="Reply" onclick="replyToMessage(${message.id})">↩️</button>`;
                actionButtons += `<button class="msg-action-btn react-action-btn" title="React" onclick="toggleReactionMenu(event, ${message.id})">😀</button>`;
                
                if (isOwn) {
                    actionButtons += `<button class="msg-action-btn edit-action-btn" title="Edit" onclick="startEditMessage(${message.id})">✏️</button>`;
                    actionButtons += `<button class="msg-action-btn delete-action-btn" title="Delete" onclick="deleteMessage(${message.id})">🗑️</button>`;
                }
            }

            let replyQuoteHtml = '';
            if (message.replyToId) {
                replyQuoteHtml = `
                    <div class="reply-quote" onclick="scrollToMessage(${message.replyToId})">
                        <span class="reply-quote-sender">Replying...</span>
                        <div class="reply-quote-body" id="reply-quote-body-${message.id}">Original message</div>
                    </div>
                `;
                fetchParentMessage(message.replyToId, message.id);
            }

            messageDiv.innerHTML = `
                <div class="message-content">
                    <div class="msg-actions">
                        ${actionButtons}
                    </div>
                    ${replyQuoteHtml}
                    <div class="message-sender">${escapeHtml(message.sender)}</div>
                    <div class="msg-body">${safeContent}</div>
                    ${message.isEdited || message.edited ? '<span class="msg-edited-badge"> (edited)</span>' : ''}
                    <div class="reactions-list" id="reactions-${message.id || 'temp'}"></div>
                </div>
            `;

            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;

            if (message.id && !message.isDeleted && !message.deleted) {
                loadMessageReactions(message.id);
            }

            dbMsgCount++;
            
            updateLastMessage(
                message.groupId ? `group-${message.groupId}` : (message.sender === currentUser.username ? message.recipient : message.sender),
                message.content
            );
        }

        async function fetchParentMessage(parentId, replyMsgId) {
            try {
                const localMsg = document.getElementById(`msg-${parentId}`);
                if (localMsg) {
                    const body = localMsg.querySelector('.msg-body').textContent;
                    const sender = localMsg.querySelector('.message-sender').textContent;
                    const quoteEl = document.getElementById(`reply-quote-body-${replyMsgId}`);
                    if (quoteEl) {
                        quoteEl.previousElementSibling.textContent = `Replying to ${sender}`;
                        quoteEl.textContent = body.length > 50 ? body.slice(0, 50) + '...' : body;
                    }
                }
            } catch (e) { console.error(e); }
        }

        function scrollToMessage(messageId) {
            const el = document.getElementById(`msg-${messageId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('highlight-flash');
                setTimeout(() => el.classList.remove('highlight-flash'), 2000);
            } else {
                alert("Original message is too far up or was deleted.");
            }
        }

        let activeReplyToId = null;
        function replyToMessage(messageId) {
            activeReplyToId = messageId;
            const msgEl = document.getElementById(`msg-${messageId}`);
            if (!msgEl) return;

            const sender = msgEl.querySelector('.message-sender').textContent;
            const body = msgEl.querySelector('.msg-body').textContent;

            let replyBar = document.getElementById('reply-preview-bar');
            if (!replyBar) {
                replyBar = document.createElement('div');
                replyBar.id = 'reply-preview-bar';
                replyBar.className = 'reply-preview-bar';
                const inputForm = document.querySelector('.chat-input');
                inputForm.insertBefore(replyBar, inputForm.firstChild);
            }

            const previewBody = body.length > 40 ? body.slice(0, 40) + '...' : body;
            replyBar.innerHTML = `
                <div class="reply-preview-content">
                    <span class="reply-preview-title">Replying to ${escapeHtml(sender)}</span>
                    <span class="reply-preview-body">${escapeHtml(previewBody)}</span>
                </div>
                <button onclick="cancelReply()" class="reply-preview-close">✕</button>
            `;
        }

        function cancelReply() {
            activeReplyToId = null;
            const replyBar = document.getElementById('reply-preview-bar');
            if (replyBar) replyBar.remove();
        }

        async function loadMessageReactions(messageId) {
            try {
                const response = await authFetch(`${API_URL}/messages/msg/${messageId}/reactions`);
                if (response.ok) {
                    const reactions = await response.json();
                    renderReactionsList(messageId, reactions);
                }
            } catch (e) { console.error(e); }
        }

        function renderReactionsList(messageId, reactions) {
            const container = document.getElementById(`reactions-${messageId}`);
            if (!container) return;
            container.innerHTML = '';

            if (reactions.length === 0) return;

            reactions.forEach(react => {
                const bubble = document.createElement('span');
                bubble.className = 'reaction-bubble';
                const usersList = react.users ? react.users.split(',') : (react.usersList || []);
                const hasReacted = usersList.includes(currentUser.username);
                if (hasReacted) {
                    bubble.classList.add('active');
                }
                bubble.title = `Reacted by: ${usersList.join(', ')}`;
                bubble.onclick = (e) => {
                    e.stopPropagation();
                    toggleReaction(messageId, react.emoji);
                };
                bubble.innerHTML = `${react.emoji} <span class="count">${react.count}</span>`;
                container.appendChild(bubble);
            });
        }

        async function toggleReaction(messageId, emoji) {
            try {
                const response = await authFetch(`${API_URL}/messages/msg/${messageId}/react`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ emoji: emoji })
                });
                if (response.ok) {
                    loadMessageReactions(messageId);
                }
            } catch (e) { console.error(e); }
        }

        let activeReactionMenu = null;
        function toggleReactionMenu(event, messageId) {
            event.stopPropagation();
            closeReactionMenu();

            const menu = document.createElement('div');
            menu.className = 'reaction-picker-menu';
            const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
            emojis.forEach(emoji => {
                const btn = document.createElement('button');
                btn.className = 'reaction-picker-btn';
                btn.textContent = emoji;
                btn.onclick = () => {
                    toggleReaction(messageId, emoji);
                    closeReactionMenu();
                };
                menu.appendChild(btn);
            });

            document.body.appendChild(menu);
            menu.style.left = `${event.clientX}px`;
            menu.style.top = `${event.clientY - 45}px`;
            
            activeReactionMenu = menu;
            document.addEventListener('click', closeReactionMenuOnce);
        }

        function closeReactionMenu() {
            if (activeReactionMenu) {
                activeReactionMenu.remove();
                activeReactionMenu = null;
            }
            document.removeEventListener('click', closeReactionMenuOnce);
        }

        function closeReactionMenuOnce() {
            closeReactionMenu();
        }

        function startEditMessage(messageId) {
            const msgEl = document.getElementById(`msg-${messageId}`);
            if (!msgEl) return;

            const bodyEl = msgEl.querySelector('.msg-body');
            const originalText = bodyEl.textContent;

            bodyEl.innerHTML = `
                <div class="inline-edit-container">
                    <input type="text" class="inline-edit-input" id="edit-input-${messageId}" value="${originalText}">
                    <div class="inline-edit-actions">
                        <button onclick="saveEdit(${messageId})" class="btn-save-edit">Save</button>
                        <button onclick="cancelEdit(${messageId}, '${escapeHtml(originalText)}')" class="btn-cancel-edit">Cancel</button>
                    </div>
                </div>
            `;
            const inp = document.getElementById(`edit-input-${messageId}`);
            inp.focus();
            inp.onkeyup = (e) => {
                if (e.key === 'Enter') saveEdit(messageId);
                if (e.key === 'Escape') cancelEdit(messageId, originalText);
            };
        }

        function cancelEdit(messageId, originalText) {
            const msgEl = document.getElementById(`msg-${messageId}`);
            if (!msgEl) return;
            msgEl.querySelector('.msg-body').textContent = originalText;
        }

        async function saveEdit(messageId) {
            const input = document.getElementById(`edit-input-${messageId}`);
            if (!input) return;
            const content = input.value.trim();
            if (!content) return alert('Message content cannot be empty');

            try {
                const response = await authFetch(`${API_URL}/messages/msg/${messageId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: content })
                });

                if (response.ok) {
                    updateMessageInDOM(messageId, content, true);
                } else {
                    alert('Failed to edit message');
                }
            } catch (e) { console.error(e); }
        }

        async function deleteMessage(messageId) {
            if (!confirm('Are you sure you want to delete this message?')) return;
            try {
                const response = await authFetch(`${API_URL}/messages/msg/${messageId}`, {
                    method: 'DELETE'
                });
                if (response.ok) {
                    updateMessageInDOM(messageId, 'This message was deleted', false, true);
                } else {
                    alert('Failed to delete message');
                }
            } catch (e) { console.error(e); }
        }

        async function blockUserAction(username) {
            if (!confirm(`Are you sure you want to block ${username}?`)) return;
            try {
                const response = await authFetch(`${API_URL}/users/${username}/block`, {
                    method: 'POST'
                });
                if (response.ok) {
                    alert(`Blocked ${username}`);
                    exitChatView();
                    loadUsers();
                } else {
                    alert('Failed to block user');
                }
            } catch (e) { console.error(e); }
        }

        async function loadBlockedUsers() {
            const list = document.getElementById('blocked-users-list');
            if (!list) return;
            list.innerHTML = '<div style="color:#999; font-size:12px; text-align:center;">Loading...</div>';
            try {
                const response = await authFetch(`${API_URL}/users/blocked`);
                if (response.ok) {
                    const blocked = await response.json();
                    list.innerHTML = '';
                    if (blocked.length === 0) {
                        list.innerHTML = '<div style="color:#999; font-size:12px; text-align:center; padding:4px 0;">No blocked users</div>';
                        return;
                    }
                    blocked.forEach(u => {
                        const item = document.createElement('div');
                        item.style = 'display:flex; justify-content:space-between; align-items:center; background:#f3f4f6; padding:6px 10px; border-radius:6px;';
                        item.innerHTML = `
                            <span style="font-weight:600; font-size:13px; color:var(--text-primary);">${u.username}</span>
                            <button onclick="unblockUserAction('${u.username}')" style="background:var(--accent); color:white; border:none; padding:3px 8px; border-radius:4px; font-size:11px; cursor:pointer;">Unblock</button>
                        `;
                        list.appendChild(item);
                    });
                }
            } catch (e) { console.error("Error loading blocked users:", e); }
        }

        async function unblockUserAction(username) {
            try {
                const response = await authFetch(`${API_URL}/users/${username}/block`, {
                    method: 'DELETE'
                });
                if (response.ok) {
                    loadBlockedUsers();
                    loadUsers();
                } else {
                    alert('Failed to unblock user');
                }
            } catch (e) { console.error(e); }
        }

        function toggleChatSearch(show) {
            let searchContainer = document.getElementById('chat-header-search-container');
            if (!searchContainer) {
                searchContainer = document.createElement('div');
                searchContainer.id = 'chat-header-search-container';
                searchContainer.style = 'display:flex; align-items:center; gap:6px; margin-left:12px;';
                searchContainer.innerHTML = `
                    <input type="text" id="chat-message-search-input" placeholder="Search in chat..." style="padding:6px 10px; border-radius:var(--radius-sm); border:1px solid rgba(0,0,0,0.1); font-size:13px; outline:none;" onkeyup="searchChatMessages(this.value)">
                    <button onclick="toggleChatSearch(false)" style="background:none; border:none; cursor:pointer; font-size:16px; color:var(--text-secondary);">✕</button>
                `;
                const infoDiv = document.querySelector('.chat-header-info');
                infoDiv.appendChild(searchContainer);
            }
            searchContainer.style.display = show ? 'flex' : 'none';
            if (!show) {
                document.getElementById('chat-message-search-input').value = '';
                document.querySelectorAll('.message').forEach(msg => {
                    msg.style.display = 'flex';
                    const body = msg.querySelector('.msg-body');
                    if (body) {
                        body.innerHTML = escapeHtml(body.textContent);
                    }
                });
            } else {
                document.getElementById('chat-message-search-input').focus();
            }
        }

        function searchChatMessages(query) {
            const q = query.trim().toLowerCase();
            document.querySelectorAll('.message').forEach(msg => {
                const body = msg.querySelector('.msg-body');
                if (!body) return;
                const text = body.textContent.toLowerCase();
                if (!q) {
                    msg.style.display = 'flex';
                    body.innerHTML = escapeHtml(body.textContent);
                } else if (text.includes(q)) {
                    msg.style.display = 'flex';
                    const escaped = escapeHtml(body.textContent);
                    const regex = new RegExp(`(${q})`, 'gi');
                    body.innerHTML = escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
                } else {
                    msg.style.display = 'none';
                }
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function copyMessage(btn) {
            const text = btn.getAttribute('data-content') || '';
            navigator.clipboard.writeText(text).then(() => {
                btn.textContent = '✅';
                setTimeout(() => btn.textContent = '📋', 1500);
            });
        }

        async function refreshData() {
            const btn = document.getElementById('refresh-btn');
            btn.style.transform = 'rotate(360deg)';
            console.log('🔄 Refreshing data...');
            try {
                await loadFriendsList();
                await loadUsers();
                await loadPendingRequests();
                if (sidebarMode === 'groups') await loadGroups();

                if (selectedRecipient) {
                    loadChatHistory(selectedRecipient);
                } else if (selectedGroupId) {
                    loadGroupHistory(selectedGroupId);
                }

                if (!stompClient || !stompClient.connected) {
                    console.log('🔄 Reconnecting WebSocket...');
                    enterChat();
                }
            } catch (e) {
                console.error('Refresh failed:', e);
            } finally {
                setTimeout(() => { btn.style.transform = 'none'; }, 1000);
            }
        }

        // ===== PROFILE PANEL =====
        function openProfile() {
            if (!currentUser) return;

            const name = currentUser.firstName && currentUser.lastName
                ? `${currentUser.firstName} ${currentUser.lastName}`
                : currentUser.username;
            const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

            const profileAvatar = document.getElementById('profile-avatar-lg');
            const sidebarAvatar = document.getElementById('sidebar-avatar-initials');

            if (currentUser.profilePicture) {
                profileAvatar.style.backgroundImage = `url('${currentUser.profilePicture}')`;
                profileAvatar.style.backgroundSize = 'cover';
                profileAvatar.style.backgroundPosition = 'center';
                profileAvatar.textContent = '';

                if (sidebarAvatar) {
                    sidebarAvatar.style.backgroundImage = `url('${currentUser.profilePicture}')`;
                    sidebarAvatar.style.backgroundSize = 'cover';
                    sidebarAvatar.style.backgroundPosition = 'center';
                    sidebarAvatar.textContent = '';
                }
            } else {
                profileAvatar.style.backgroundImage = '';
                profileAvatar.textContent = initials;

                if (sidebarAvatar) {
                    sidebarAvatar.style.backgroundImage = '';
                    sidebarAvatar.textContent = initials;
                }
            }

            document.getElementById('profile-fullname').textContent = name;
            document.getElementById('profile-username').textContent = '@' + currentUser.username;

            document.getElementById('profile-panel').classList.add('open');
            document.getElementById('profile-backdrop').classList.add('open');

            loadBlockedUsers();
        }

        function closeProfile() {
            document.getElementById('profile-panel').classList.remove('open');
            document.getElementById('profile-backdrop').classList.remove('open');
        }

        function toggleProfileEdit() {
            const viewMode = document.getElementById('profile-view-mode');
            const editMode = document.getElementById('profile-edit-mode');
            const logoutBtn = document.getElementById('profile-actions-logout');

            if (editMode.classList.contains('hidden')) {
                editMode.classList.remove('hidden');
                viewMode.style.display = 'none';
                logoutBtn.style.display = 'none';

                if (currentUser) {
                    document.getElementById('edit-firstname').value = currentUser.firstName || '';
                    document.getElementById('edit-lastname').value = currentUser.lastName || '';
                    document.getElementById('edit-email').value = currentUser.email || '';
                }
            } else {
                editMode.classList.add('hidden');
                viewMode.style.display = 'block';
                logoutBtn.style.display = 'block';
            }
        }

        async function saveProfileChanges() {
            if (!currentUser) return;

            const firstName = document.getElementById('edit-firstname').value.trim();
            const lastName = document.getElementById('edit-lastname').value.trim();
            const email = document.getElementById('edit-email').value.trim();

            if (!firstName || !lastName || !email) {
                alert('Please fill in all fields');
                return;
            }

            const saveBtn = document.querySelector('#profile-edit-mode .btn-primary');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;

            try {
                const response = await authFetch(`${API_URL}/users/${currentUser.username}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ firstName, lastName, email, bio: currentUser.bio || "" })
                });

                if (!response.ok) throw new Error('Server error');

                currentUser.firstName = firstName;
                currentUser.lastName = lastName;
                currentUser.email = email;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                sessionStorage.setItem('currentUser', JSON.stringify(currentUser));

                const name = `${firstName} ${lastName}`;
                const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                const avatarEl = document.getElementById('profile-avatar-lg');
                if (!avatarEl.style.backgroundImage) avatarEl.textContent = initials;
                const sidebarAv = document.getElementById('sidebar-avatar-initials');
                if (sidebarAv && !sidebarAv.style.backgroundImage) sidebarAv.textContent = initials;
                document.getElementById('profile-fullname').textContent = name;
                const usernameEl = document.getElementById('sidebar-username');
                if (usernameEl) usernameEl.textContent = firstName;

                toggleProfileEdit();
                alert('Profile updated successfully!');
            } catch (err) {
                console.error('Profile update failed:', err);
                alert('Failed to update profile. Please try again.');
            } finally {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }
        }

        function previewProfilePic(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('pic-preview');
                preview.innerHTML = `<img src="${e.target.result}" alt="Profile Picture Preview">`;
                preview.classList.remove('hidden');

                if (!currentUser) currentUser = {};
                currentUser.profilePicture = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        function handleProfilePicChange(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const profileAvatar = document.getElementById('profile-avatar-lg');
                profileAvatar.style.backgroundImage = `url('${e.target.result}')`;
                profileAvatar.style.backgroundSize = 'cover';
                profileAvatar.style.backgroundPosition = 'center';
                profileAvatar.textContent = '';

                if (!currentUser) currentUser = {};
                currentUser.profilePicture = e.target.result;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));

                const sidebarAvatar = document.getElementById('sidebar-avatar-initials');
                if (sidebarAvatar) {
                    sidebarAvatar.style.backgroundImage = `url('${e.target.result}')`;
                    sidebarAvatar.style.backgroundSize = 'cover';
                    sidebarAvatar.style.backgroundPosition = 'center';
                    sidebarAvatar.textContent = '';
                }
            };
            reader.readAsDataURL(file);
        }

        async function deleteAccount() {
            if (!currentUser) return;
            if (!confirm(`⚠️ Are you sure you want to permanently delete your account "@${currentUser.username}"? This will delete all your messages and friend connections. This CANNOT be undone.`)) return;
            if (!confirm('Last warning: all your data will be deleted forever. Continue?')) return;

            try {
                const response = await authFetch(`${API_URL}/users/${currentUser.username}`, {
                    method: 'DELETE'
                });
                if (response.ok) {
                    if (stompClient) stompClient.disconnect();
                    localStorage.clear();
                    sessionStorage.clear();
                    alert('Your account has been deleted.');
                    window.location.reload();
                } else {
                    alert('Failed to delete account. Please try again.');
                }
            } catch (err) {
                console.error('Delete account error:', err);
                alert('Connection error. Please try again.');
            }
        }

        async function unfriend(friendUsername) {
            if (!currentUser) return;
            if (!confirm(`Remove ${friendUsername} from your friends?`)) return;

            try {
                const response = await authFetch(`${API_URL}/friends/${friendUsername}?currentUser=${currentUser.username}`, {
                    method: 'DELETE'
                });
                if (response.ok) {
                    if (selectedRecipient === friendUsername) exitChatView();
                    await loadFriendsList();
                    await loadUsers();
                } else {
                    alert('Failed to unfriend. Please try again.');
                }
            } catch (err) {
                console.error('Unfriend error:', err);
                alert('Connection error.');
            }
        }

        function logout() {
            stopAutoRefresh();
            stopChatPolling();
            stopGroupPolling();
            if (stompClient) {
                stompClient.disconnect();
            }
            localStorage.removeItem('currentUser');
            sessionStorage.removeItem('currentUser');
            currentUser = null;
            document.getElementById('chat-app').classList.remove('active');
            document.getElementById('auth-page').style.display = 'block';
            const adminBtn = document.querySelector('.admin-menu-btn');
            if (adminBtn) adminBtn.style.display = 'flex';
            document.getElementById('login-form').reset();
            window.location.reload();
        }

        // Admin Reset Functions
        function showAdminReset() {
            document.getElementById('admin-modal').style.display = 'flex';
            document.getElementById('admin-secret').value = '';
            document.getElementById('admin-error').style.display = 'none';
        }

        function hideAdminReset() {
            document.getElementById('admin-modal').style.display = 'none';
        }

        async function executeAdminReset(type) {
            const secret = document.getElementById('admin-secret').value.trim();
            const errorDiv = document.getElementById('admin-error');

            if (!secret) {
                errorDiv.textContent = 'Please enter admin secret code';
                errorDiv.style.display = 'block';
                return;
            }

            const EXPECTED_SECRET = "boxbi_secure_reset_key_7e57c6df4a51e892c90c73295e840e69123b5fde81c4e97a3da124806a9db3f1";

            if (type === 'local') {
                if (secret !== EXPECTED_SECRET) {
                    errorDiv.textContent = 'Invalid secret code';
                    errorDiv.style.display = 'block';
                    return;
                }

                if (!confirm('⚠️ This will delete all saved login sessions and local preferences. Are you sure?')) {
                    return;
                }

                localStorage.clear();
                sessionStorage.clear();
                hideAdminReset();
                alert('✅ Local app data has been cleared.');
                location.reload();
                return;
            }

            if (!confirm('⚠️ WARNING: This will delete ALL users and messages permanently. Are you sure?')) {
                return;
            }

            try {
                const response = await fetch(`${API_URL}/admin/reset`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ secret })
                });

                if (response.ok) {
                    alert('✅ System has been reset successfully');
                    localStorage.removeItem('currentUser');
                    sessionStorage.removeItem('currentUser');
                    location.reload();
                } else {
                    const error = await response.text();
                    errorDiv.textContent = 'Invalid secret code';
                    errorDiv.style.display = 'block';
                }
            } catch (e) {
                console.error(e);
                errorDiv.textContent = 'Connection error';
                errorDiv.style.display = 'block';
            }
        }

        function avatarColor(username) {
            // Warm, muted palette to match the Claude-inspired theme
            const palette = [
                ['#D97757', '#C96442'], // terracotta
                ['#B8860B', '#96690a'], // ochre
                ['#7D8F69', '#5e7050'], // sage
                ['#A5708E', '#8a5a76'], // dusty rose
                ['#6E8CA0', '#577386'], // slate blue
                ['#C0975C', '#a37d49'], // sand
                ['#8A6FA8', '#715a8c'], // muted violet
                ['#5F9E8F', '#4c8273'], // teal clay
            ];
            let hash = 0;
            for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
            const [a, b] = palette[Math.abs(hash) % palette.length];
            return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
        }

        function scrollToBottom() {
            const container = document.getElementById('messages');
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }

        function setupScrollObserver() {
            const container = document.getElementById('messages');
            const btn = document.getElementById('scroll-to-bottom');
            if (!container || !btn) return;
            container.addEventListener('scroll', () => {
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
                btn.classList.toggle('visible', !isNearBottom);
            });
        }
        setupScrollObserver();
