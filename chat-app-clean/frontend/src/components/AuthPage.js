import { useState } from 'react';
import axios from 'axios';
import './AuthPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api/auth';

/**
 * Authentication Page Component
 * Handles user login and signup
 */
const AuthPage = ({ onAuth }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form state
    const [username, setUsername] = useState('');
    const [secret, setSecret] = useState('');
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    /**
     * Handles login form submission
     */
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await axios.post(`${API_URL}/login`, {
                username,
                secret,
            });

            // Include secret in user data for Chat Engine authentication
            onAuth({ ...response.data, secret });
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Login failed. Please check your credentials.';
            setError(errorMessage);
            console.error('Login error:', err);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handles signup form submission
     */
    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Validation
        if (!email || !firstName || !lastName) {
            setError('Please fill in all fields');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post(`${API_URL}/signup`, {
                username,
                secret,
                email,
                first_name: firstName,
                last_name: lastName,
            });

            // Include secret in user data for Chat Engine authentication
            onAuth({ ...response.data, secret });
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Signup failed. Please try again.';
            setError(errorMessage);
            console.error('Signup error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-card">
                    <h1 className="auth-title">💬 Chat App</h1>

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    {isLogin ? (
                        // Login Form
                        <form onSubmit={handleLogin} className="auth-form">
                            <h2>Login</h2>

                            <input
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                disabled={loading}
                            />

                            <input
                                type="password"
                                placeholder="Password"
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                                required
                                disabled={loading}
                            />

                            <button type="submit" disabled={loading}>
                                {loading ? 'Logging in...' : 'Login'}
                            </button>

                            <p className="toggle-text">
                                Don't have an account?{' '}
                                <span onClick={() => setIsLogin(false)} className="toggle-link">
                                    Sign up
                                </span>
                            </p>
                        </form>
                    ) : (
                        // Signup Form
                        <form onSubmit={handleSignup} className="auth-form">
                            <h2>Sign Up</h2>

                            <input
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                disabled={loading}
                            />

                            <input
                                type="password"
                                placeholder="Password"
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                                required
                                disabled={loading}
                            />

                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                            />

                            <input
                                type="text"
                                placeholder="First Name"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                required
                                disabled={loading}
                            />

                            <input
                                type="text"
                                placeholder="Last Name"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                required
                                disabled={loading}
                            />

                            <button type="submit" disabled={loading}>
                                {loading ? 'Creating account...' : 'Sign Up'}
                            </button>

                            <p className="toggle-text">
                                Already have an account?{' '}
                                <span onClick={() => setIsLogin(true)} className="toggle-link">
                                    Login
                                </span>
                            </p>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
