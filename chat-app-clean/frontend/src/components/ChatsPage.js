import { PrettyChatWindow } from 'react-chat-engine-pretty';
import './ChatsPage.css';

const PROJECT_ID = process.env.REACT_APP_CHAT_ENGINE_PROJECT_ID;

/**
 * Chats Page Component
 * Displays the chat interface using Chat Engine
 */
const ChatsPage = ({ user, onLogout }) => {
    return (
        <div className="chats-page">
            <div className="chat-header">
                <h2>Welcome, {user.first_name || user.username}!</h2>
                <button onClick={onLogout} className="logout-button">
                    Logout
                </button>
            </div>

            <div className="chat-container">
                <PrettyChatWindow
                    projectId={PROJECT_ID}
                    username={user.username}
                    secret={user.secret}
                    style={{ height: '100%' }}
                />
            </div>
        </div>
    );
};

export default ChatsPage;
