import React, { useState, useEffect } from 'react';
import authService from '../services/authService';
import './QuotaDisplay.css';

const QuotaDisplay = () => {
    const [quotas, setQuotas] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        // Détecter le mode sombre
        const checkDarkMode = () => {
            setIsDarkMode(document.body.classList.contains('dark-mode'));
        };
        
        checkDarkMode();
        
        // Observer les changements de classe sur le body
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        loadQuotas();
    }, []);

    const loadQuotas = async () => {
        try {
            setLoading(true);
            const result = await authService.getQuotas();
            
            if (result.success) {
                setQuotas(result.quotas);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Erreur lors du chargement des quotas');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className={`quota-display ${isDarkMode ? 'dark-mode' : ''}`}>
                <div className="quota-loading">Chargement des quotas...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`quota-display ${isDarkMode ? 'dark-mode' : ''}`}>
                <div className="quota-error">{error}</div>
            </div>
        );
    }

    if (!quotas) {
        return null;
    }

    const dailyPercentage = (quotas.daily_used / quotas.daily_limit) * 100;
    const monthlyPercentage = (quotas.monthly_used / quotas.monthly_limit) * 100;

    return (
        <div className={`quota-display ${isDarkMode ? 'dark-mode' : ''}`}>
            <div className="quota-header">
                <h3>Vos quotas</h3>
                <button className="refresh-button" onClick={loadQuotas}>
                    ↻
                </button>
            </div>
            
            <div className="quota-cards">
                <div className="quota-card daily">
                    <div className="quota-title">Quotidien</div>
                    <div className="quota-progress">
                        <div className="progress-bar">
                            <div 
                                className="progress-fill daily-fill"
                                style={{ width: `${Math.min(dailyPercentage, 100)}%` }}
                            ></div>
                        </div>
                        <div className="quota-numbers">
                            <span className="used">{quotas.daily_used}</span>
                            <span className="separator">/</span>
                            <span className="limit">{quotas.daily_limit}</span>
                        </div>
                    </div>
                    <div className="quota-percentage">
                        {dailyPercentage.toFixed(1)}%
                    </div>
                </div>

                <div className="quota-card monthly">
                    <div className="quota-title">Mensuel</div>
                    <div className="quota-progress">
                        <div className="progress-bar">
                            <div 
                                className="progress-fill monthly-fill"
                                style={{ width: `${Math.min(monthlyPercentage, 100)}%` }}
                            ></div>
                        </div>
                        <div className="quota-numbers">
                            <span className="used">{quotas.monthly_used}</span>
                            <span className="separator">/</span>
                            <span className="limit">{quotas.monthly_limit}</span>
                        </div>
                    </div>
                    <div className="quota-percentage">
                        {monthlyPercentage.toFixed(1)}%
                    </div>
                </div>


            </div>

            {!quotas.can_process && (
                <div className="quota-warning">
                    ⚠️ {quotas.message}
                </div>
            )}
        </div>
    );
};

export default QuotaDisplay; 