import { useState } from 'react';
import AuthPage from './components/AuthPage';
import ChatsPage from './components/ChatsPage';
import './App.css';

/**
 * Main App Component
 * Handles authentication state and renders appropriate page
 */
function App() {
    const [user, setUser] = useState(null);

    const handleAuth = (userData) => {
        setUser(userData);
    };

    const handleLogout = () => {
        setUser(null);
    };

    return (
        <div className="App">
            {!user ? (
                <AuthPage onAuth={handleAuth} />
            ) : (
                <ChatsPage user={user} onLogout={handleLogout} />
            )}
        </div>
    );
}

export default App;
