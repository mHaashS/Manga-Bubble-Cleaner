import React, { useState, useEffect } from 'react';
import authService from '../services/authService';
import './ResetPasswordModal.css';

const ResetPasswordModal = ({ isOpen, onClose, onSuccess }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [token, setToken] = useState('');

    // Récupérer le token depuis l'URL
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const resetToken = urlParams.get('token');
        if (resetToken) {
            setToken(resetToken);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas');
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caractères');
            setLoading(false);
            return;
        }

        try {
            const response = await authService.resetPassword(token, password);
            setSuccess(true);
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);
        } catch (error) {
            setError(error.response?.data?.detail || 'Erreur lors de la réinitialisation du mot de passe');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="reset-password-modal-overlay">
            <div className="reset-password-modal">
                <div className="reset-password-modal-header">
                    <h2>Réinitialiser le mot de passe</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                {success ? (
                    <div className="reset-password-success">
                        <div className="success-icon">✅</div>
                        <h3>Mot de passe mis à jour !</h3>
                        <p>Vous allez être redirigé vers la page de connexion...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="reset-password-form">
                        <div className="form-group">
                            <label htmlFor="password">Nouveau mot de passe</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Entrez votre nouveau mot de passe"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirmer le mot de passe</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirmez votre nouveau mot de passe"
                                required
                            />
                        </div>

                        {error && <div className="error-message">{error}</div>}

                        <button 
                            type="submit" 
                            className="reset-password-button"
                            disabled={loading}
                        >
                            {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPasswordModal; 