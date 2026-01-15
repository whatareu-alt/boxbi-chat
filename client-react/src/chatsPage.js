import { useEffect, useState, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import axios from 'axios';
import { API_URL } from './config';
import './index.css';

const ChatsPage = ({ user, onLogout }) => {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const stompClientRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Connect to WebSocket
    const socket = new SockJS(`${API_URL}/ws`);
    const stompClient = Stomp.over(socket);

    stompClient.connect({}, (frame) => {
      console.log('Connected: ' + frame);
      setConnected(true);

      // Subscribe to public messages
      stompClient.subscribe('/topic/public', (message) => {
        const chatMessage = JSON.parse(message.body);
        setMessages((prevMessages) => [...prevMessages, chatMessage]);
      });

      // Send JOIN message
      stompClient.send('/app/chat.addUser', {}, JSON.stringify({
        sender: user.username,
        type: 'JOIN'
      }));
    }, (error) => {
      console.error('WebSocket connection error:', error);
      setConnected(false);
    });

    stompClientRef.current = stompClient;

    // Cleanup on unmount
    return () => {
      if (stompClient && connected) {
        stompClient.send('/app/chat.sendMessage', {}, JSON.stringify({
          sender: user.username,
          type: 'LEAVE'
        }));
        stompClient.disconnect();
      }
    };
  }, [user.username]);

  const sendMessage = (e) => {
    e.preventDefault();

    if (messageInput.trim() && stompClientRef.current && connected) {
      const chatMessage = {
        sender: user.username,
        content: messageInput,
        type: 'CHAT'
      };

      stompClientRef.current.send('/app/chat.sendMessage', {}, JSON.stringify(chatMessage));
      setMessageInput('');
    }
  };

  const handleLogout = () => {
    if (stompClientRef.current && connected) {
      stompClientRef.current.send('/app/chat.sendMessage', {}, JSON.stringify({
        sender: user.username,
        type: 'LEAVE'
      }));
      stompClientRef.current.disconnect();
    }
    onLogout();
  };

  const searchUsers = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const response = await axios.get(`${API_URL}/users/search/${searchQuery}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-content">
          <h2>💬 Chat Room</h2>
          <div className="user-info">
            <button onClick={() => setShowSearch(!showSearch)} className="search-btn">
              🔍 Find Users
            </button>
            <span className="username">{user.username}</span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </div>
        <div className="connection-status">
          <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}></span>
          <span className="status-text">{connected ? 'Connected' : 'Connecting...'}</span>
        </div>
      </div>

      <div className="chat-body" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Search Sidebar */}
        {showSearch && (
          <div className="search-sidebar">
            <div className="search-header">
              <h3>Find Users</h3>
              <button onClick={() => setShowSearch(false)} className="close-search">×</button>
            </div>
            <form onSubmit={searchUsers} className="search-form">
              <input
                type="text"
                placeholder="Search username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit">Go</button>
            </form>
            <div className="search-results">
              {searchResults.map((result, idx) => (
                <div key={idx} className="user-card">
                  <div className="user-card-avatar">{result.username[0].toUpperCase()}</div>
                  <div className="user-card-info">
                    <div className="user-card-name">{result.username}</div>
                    <div className="user-card-email">{result.first_name} {result.last_name}</div>
                  </div>
                </div>
              ))}
              {searchResults.length === 0 && searchQuery && (
                <div className="no-results">No users found</div>
              )}
            </div>
          </div>
        )}

        <div className="messages-container">
          {messages.map((msg, index) => {
            if (msg.type === 'JOIN' || msg.type === 'LEAVE') {
              return (
                <div key={index} className="message-notification">
                  {msg.sender} {msg.type === 'JOIN' ? 'joined' : 'left'} the chat
                </div>
              );
            } else {
              const isOwnMessage = msg.sender === user.username;
              return (
                <div key={index} className={`message ${isOwnMessage ? 'own-message' : 'other-message'}`}>
                  <div className="message-header">
                    <span className="message-sender">{msg.sender}</span>
                    <span className="message-time">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div className="message-content">{msg.content}</div>
                </div>
              );
            }
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={sendMessage} className="message-input-container">
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Type a message..."
          className="message-input"
          disabled={!connected}
        />
        <button type="submit" className="send-button" disabled={!connected || !messageInput.trim()}>
          Send
        </button>
      </form>

      <style>{`
        .search-btn {
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.4);
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          cursor: pointer;
          margin-right: 10px;
        }
        .search-sidebar {
          width: 300px;
          background: white;
          border-right: 1px solid #eee;
          display: flex;
          flex-direction: column;
          animation: slideRight 0.3s ease;
        }
        @keyframes slideRight {
          from { width: 0; opacity: 0; }
          to { width: 300px; opacity: 1; }
        }
        .search-header {
          padding: 15px;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .close-search {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
        }
        .search-form {
          padding: 15px;
          display: flex;
          gap: 10px;
        }
        .search-form input {
          flex: 1;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .search-form button {
          padding: 8px 15px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .search-results {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
        }
        .user-card {
          display: flex;
          align-items: center;
          padding: 10px;
          border-bottom: 1px solid #f0f0f0;
          gap: 10px;
        }
        .user-card-avatar {
          width: 36px;
          height: 36px;
          background: #764ba2;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }
        .user-card-name {
          font-weight: 600;
          color: #333;
        }
        .user-card-email {
          font-size: 12px;
          color: #666;
        }
        .no-results {
          text-align: center;
          color: #999;
          padding: 20px;
        }
      `}</style>
    </div>
  );
};

export default ChatsPage;
