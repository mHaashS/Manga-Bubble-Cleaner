import React, { useState, useEffect } from 'react';
import authService from '../services/authService';
import './ProfileModal.css';

const ProfileModal = ({ isOpen, onClose, user }) => {
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(false);

    // Détecter le mode sombre
    useEffect(() => {
        const darkMode = localStorage.getItem('darkMode') === 'true';
        setIsDarkMode(darkMode);
        
        const handleStorageChange = () => {
            const newDarkMode = localStorage.getItem('darkMode') === 'true';
            setIsDarkMode(newDarkMode);
        };
        
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // États pour les formulaires
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [usernameData, setUsernameData] = useState({
        newUsername: '',
        password: ''
    });

    const [emailData, setEmailData] = useState({
        newEmail: '',
        password: ''
    });

    const [resetPasswordData, setResetPasswordData] = useState({
        token: '',
        newPassword: '',
        confirmPassword: ''
    });

    // Récupérer le token depuis l'URL si présent
    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (token) {
            setResetPasswordData(prev => ({ ...prev, token }));
            setActiveTab('reset-password');
        }
    }, []);

    // Mettre à jour l'onglet actif quand l'utilisateur change
    React.useEffect(() => {
        if (user) {
            setActiveTab('profile');
        }
    }, [user]);

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setError('Les mots de passe ne correspondent pas');
            setLoading(false);
            return;
        }

        try {
            const result = await authService.changePassword(
                passwordData.currentPassword,
                passwordData.newPassword
            );

            if (result.success) {
                setMessage('Mot de passe mis à jour avec succès');
                setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });
                // Rediriger vers la page de connexion
                setTimeout(() => {
                    authService.logout();
                    window.location.reload();
                }, 2000);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Erreur lors du changement de mot de passe');
        } finally {
            setLoading(false);
        }
    };

    const handleUsernameChange = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const result = await authService.changeUsername(
                usernameData.newUsername,
                usernameData.password
            );

            if (result.success) {
                setMessage('Nom d\'utilisateur mis à jour avec succès');
                setUsernameData({ newUsername: '', password: '' });
                // Mettre à jour l'utilisateur dans le service
                authService.updateUser({ ...user, username: usernameData.newUsername });
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Erreur lors du changement de nom d\'utilisateur');
        } finally {
            setLoading(false);
        }
    };

    const handleEmailChange = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const result = await authService.changeEmail(
                emailData.newEmail,
                emailData.password
            );

            if (result.success) {
                setMessage('Email mis à jour avec succès');
                setEmailData({ newEmail: '', password: '' });
                // Mettre à jour l'utilisateur dans le service
                authService.updateUser({ ...user, email: emailData.newEmail });
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Erreur lors du changement d\'email');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
            setError('Les mots de passe ne correspondent pas');
            setLoading(false);
            return;
        }

        try {
            const result = await authService.resetPassword(
                resetPasswordData.token,
                resetPasswordData.newPassword
            );

            if (result.success) {
                setMessage('Mot de passe réinitialisé avec succès');
                setResetPasswordData({
                    token: '',
                    newPassword: '',
                    confirmPassword: ''
                });
                // Rediriger vers la page de connexion
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Erreur lors de la réinitialisation du mot de passe');
        } finally {
            setLoading(false);
        }
    };

    // Ne pas afficher le modal si l'utilisateur n'est pas connecté ou si le modal n'est pas ouvert
    if (!isOpen || !user) return null;

    return (
        <div className="profile-modal-overlay">
            <div className={`profile-modal ${isDarkMode ? 'dark-mode' : ''}`}>
                <div className="profile-modal-header">
                    <h2>Gestion du Profil</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    <div className="profile-modal-tabs">
                        <button 
                            className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
                            onClick={() => setActiveTab('profile')}
                        >
                            <span>👤</span>
                            Profil
                        </button>
                        <button 
                            className={`tab-button ${activeTab === 'password' ? 'active' : ''}`}
                            onClick={() => setActiveTab('password')}
                        >
                            <span>🔒</span>
                            Mot de passe
                        </button>
                        {resetPasswordData.token && (
                            <button 
                                className={`tab-button ${activeTab === 'reset-password' ? 'active' : ''}`}
                                onClick={() => setActiveTab('reset-password')}
                            >
                                <span>🔄</span>
                                Réinitialiser
                            </button>
                        )}
                    </div>

                    <div className="profile-modal-content">
                        {message && <div className="success-message">{message}</div>}
                        {error && <div className="error-message">{error}</div>}

                        {activeTab === 'profile' && (
                            <div className="profile-section">
                                <h3>Informations du profil</h3>
                                <div className="profile-info">
                                    <p><strong>Nom d'utilisateur:</strong> {user?.username}</p>
                                    <p><strong>Email:</strong> {user?.email}</p>
                                    <p><strong>Membre depuis:</strong> {new Date(user?.created_at).toLocaleDateString()}</p>
                                </div>

                                <div className="profile-actions">
                                    <button 
                                        className="action-button"
                                        onClick={() => setActiveTab('username')}
                                    >
                                        Changer le nom d'utilisateur
                                    </button>
                                    <button 
                                        className="action-button"
                                        onClick={() => setActiveTab('email')}
                                    >
                                        Changer l'email
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'password' && (
                            <form onSubmit={handlePasswordChange} className="form-section">
                                <h3>Changer le mot de passe</h3>
                                <div className="form-group">
                                    <label>Mot de passe actuel:</label>
                                    <input
                                        type="password"
                                        value={passwordData.currentPassword}
                                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Nouveau mot de passe:</label>
                                    <input
                                        type="password"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Confirmer le nouveau mot de passe:</label>
                                    <input
                                        type="password"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                        required
                                    />
                                </div>
                                <button type="submit" disabled={loading} className="submit-button">
                                    {loading ? 'Changement en cours...' : 'Changer le mot de passe'}
                                </button>
                            </form>
                        )}

                        {activeTab === 'username' && (
                            <form onSubmit={handleUsernameChange} className="form-section">
                                <h3>Changer le nom d'utilisateur</h3>
                                <div className="form-group">
                                    <label>Nouveau nom d'utilisateur:</label>
                                    <input
                                        type="text"
                                        value={usernameData.newUsername}
                                        onChange={(e) => setUsernameData(prev => ({ ...prev, newUsername: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Mot de passe (confirmation):</label>
                                    <input
                                        type="password"
                                        value={usernameData.password}
                                        onChange={(e) => setUsernameData(prev => ({ ...prev, password: e.target.value }))}
                                        required
                                    />
                                </div>
                                <button type="submit" disabled={loading} className="submit-button">
                                    {loading ? 'Changement en cours...' : 'Changer le nom d\'utilisateur'}
                                </button>
                            </form>
                        )}

                        {activeTab === 'email' && (
                            <form onSubmit={handleEmailChange} className="form-section">
                                <h3>Changer l'email</h3>
                                <div className="form-group">
                                    <label>Nouvel email:</label>
                                    <input
                                        type="email"
                                        value={emailData.newEmail}
                                        onChange={(e) => setEmailData(prev => ({ ...prev, newEmail: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Mot de passe (confirmation):</label>
                                    <input
                                        type="password"
                                        value={emailData.password}
                                        onChange={(e) => setEmailData(prev => ({ ...prev, password: e.target.value }))}
                                        required
                                    />
                                </div>
                                <button type="submit" disabled={loading} className="submit-button">
                                    {loading ? 'Changement en cours...' : 'Changer l\'email'}
                                </button>
                            </form>
                        )}

                        {activeTab === 'reset-password' && (
                            <form onSubmit={handleResetPassword} className="form-section">
                                <h3>Réinitialiser le mot de passe</h3>
                                <div className="form-group">
                                    <label>Nouveau mot de passe:</label>
                                    <input
                                        type="password"
                                        value={resetPasswordData.newPassword}
                                        onChange={(e) => setResetPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Confirmer le nouveau mot de passe:</label>
                                    <input
                                        type="password"
                                        value={resetPasswordData.confirmPassword}
                                        onChange={(e) => setResetPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                        required
                                    />
                                </div>
                                <button type="submit" disabled={loading} className="submit-button">
                                    {loading ? 'Réinitialisation en cours...' : 'Réinitialiser le mot de passe'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileModal; 