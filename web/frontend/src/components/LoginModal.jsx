import React, { useState } from 'react';
import authService from '../services/authService';
import './LoginModal.css';

const LoginModal = ({ isOpen, onClose, onLoginSuccess, onSwitchToRegister }) => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [forgotPasswordData, setForgotPasswordData] = useState({
        email: ''
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const result = await authService.login(formData);
            
            if (result.success) {
                onLoginSuccess(result.user);
                onClose();
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Erreur de connexion. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const result = await authService.forgotPassword(forgotPasswordData.email);

            if (result.success) {
                setMessage('Email de récupération envoyé. Vérifiez votre boîte mail.');
                setForgotPasswordData({ email: '' });
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Erreur lors de l\'envoi de l\'email de récupération');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{showForgotPassword ? 'Mot de passe oublié' : 'Connexion'}</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                {!showForgotPassword ? (
                    // Formulaire de connexion
                    <>
                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="form-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="votre@email.com"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Mot de passe</label>
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="Votre mot de passe"
                                />
                            </div>

                            {error && <div className="error-message">{error}</div>}

                            <button 
                                type="submit" 
                                className="submit-button"
                                disabled={loading}
                            >
                                {loading ? 'Connexion...' : 'Se connecter'}
                            </button>
                        </form>

                        <div className="modal-footer">
                            <p>
                                <button 
                                    className="link-button" 
                                    onClick={() => setShowForgotPassword(true)}
                                >
                                    Mot de passe oublié ?
                                </button>
                            </p>
                            <p>
                                Pas encore de compte ?{' '}
                                <button 
                                    className="link-button" 
                                    onClick={onSwitchToRegister}
                                >
                                    S'inscrire
                                </button>
                            </p>
                        </div>
                    </>
                ) : (
                    // Formulaire de mot de passe oublié
                    <>
                        <form onSubmit={handleForgotPassword} className="auth-form">
                            <p className="forgot-password-text">
                                Entrez votre email pour recevoir un lien de récupération.
                            </p>
                            
                            <div className="form-group">
                                <label htmlFor="forgot-email">Email</label>
                                <input
                                    type="email"
                                    id="forgot-email"
                                    value={forgotPasswordData.email}
                                    onChange={(e) => setForgotPasswordData({ email: e.target.value })}
                                    required
                                    placeholder="votre@email.com"
                                />
                            </div>

                            {error && <div className="error-message">{error}</div>}
                            {message && <div className="success-message">{message}</div>}

                            <button 
                                type="submit" 
                                className="submit-button"
                                disabled={loading}
                            >
                                {loading ? 'Envoi en cours...' : 'Envoyer le lien de récupération'}
                            </button>
                        </form>

                        <div className="modal-footer">
                            <p>
                                <button 
                                    className="link-button" 
                                    onClick={() => {
                                        setShowForgotPassword(false);
                                        setError('');
                                        setMessage('');
                                    }}
                                >
                                    Retour à la connexion
                                </button>
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default LoginModal; 