/**
 * Service d'authentification pour l'API
 */

const API_BASE_URL = 'http://localhost:8000';

class AuthService {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user'));
    }

    // Sauvegarder le token et les infos utilisateur
    setAuth(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(user));
    }

    // Récupérer le token
    getToken() {
        return this.token;
    }

    // Récupérer l'utilisateur
    getUser() {
        return this.user;
    }

    // Vérifier si l'utilisateur est connecté
    isAuthenticated() {
        if (!this.token) return false;
        
        // Vérifier si le token n'est pas expiré
        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            const exp = payload.exp * 1000; // Convertir en millisecondes
            const now = Date.now();
            
            if (now >= exp) {
                console.log("⚠️ Token expiré, déconnexion automatique");
                this.logout();
                return false;
            }
            
            return true;
        } catch (error) {
            console.log("❌ Erreur lors de la vérification du token:", error);
            this.logout();
            return false;
        }
    }

    // Déconnexion
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
    }

    // Headers pour les requêtes authentifiées
    getAuthHeaders() {
        console.log("🔑 Token utilisé dans headers:", this.token ? this.token.substring(0, 20) + "..." : "Aucun");
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
        };
    }

    // Inscription
    async register(userData) {
        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Erreur lors de l\'inscription');
            }

            const user = await response.json();
            
            // Connexion automatique après inscription réussie
            const loginResult = await this.login({
                email: userData.email,
                password: userData.password
            });
            
            if (loginResult.success) {
                return { success: true, user: loginResult.user };
            } else {
                // Si la connexion automatique échoue, on retourne quand même l'utilisateur créé
                return { success: true, user: user, warning: 'Inscription réussie mais connexion automatique échouée' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Connexion
    async login(credentials) {
        try {
            console.log("🔐 Tentative de connexion...");
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });

            console.log("📡 Réponse de connexion:", response.status);

            if (!response.ok) {
                const error = await response.json();
                console.log("❌ Erreur de connexion:", error);
                throw new Error(error.detail || 'Email ou mot de passe incorrect');
            }

            const { access_token, token_type } = await response.json();
            console.log("✅ Token reçu:", access_token ? "Présent" : "Absent");
            
            // Récupérer les infos utilisateur
            console.log("👤 Récupération du profil...");
            const userResponse = await fetch(`${API_BASE_URL}/profile`, {
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                },
            });

            console.log("📡 Réponse profil:", userResponse.status);

            if (userResponse.ok) {
                const userData = await userResponse.json();
                console.log("✅ Profil récupéré:", userData);
                this.setAuth(access_token, userData.user);
                return { success: true, user: userData.user };
            } else {
                console.log("❌ Erreur profil:", userResponse.status, userResponse.text);
                throw new Error('Erreur lors de la récupération du profil');
            }
        } catch (error) {
            console.log("❌ Erreur lors de la connexion:", error);
            return { success: false, error: error.message };
        }
    }

    // Récupérer le profil utilisateur
    async getProfile() {
        try {
            const response = await fetch(`${API_BASE_URL}/profile`, {
                headers: this.getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la récupération du profil');
            }

            const profile = await response.json();
            this.user = profile.user;
            localStorage.setItem('user', JSON.stringify(profile.user));
            return { success: true, profile };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Récupérer les quotas
    async getQuotas() {
        try {
            console.log("📊 Récupération des quotas...");
            console.log("🔑 Token présent:", this.token ? "Oui" : "Non");
            
            const response = await fetch(`${API_BASE_URL}/quotas`, {
                headers: this.getAuthHeaders(),
            });

            console.log("📡 Réponse quotas:", response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.log("❌ Erreur quotas:", response.status, errorText);
                throw new Error('Erreur lors de la récupération des quotas');
            }

            const quotas = await response.json();
            console.log("✅ Quotas récupérés:", quotas);
            return { success: true, quotas };
        } catch (error) {
            console.log("❌ Erreur lors de la récupération des quotas:", error);
            return { success: false, error: error.message };
        }
    }

    // Traitement d'image avec authentification
    async processImage(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_BASE_URL}/process`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Erreur lors du traitement');
            }

            const result = await response.json();
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Traitement avec polygones personnalisés
    async retreatWithPolygons(file, polygons) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('polygons', JSON.stringify(polygons));

            const response = await fetch(`${API_BASE_URL}/retreat-with-polygons`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Erreur lors du retraitement');
            }

            const result = await response.json();
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Récupérer les polygones de bulles
    async getBubblePolygons(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_BASE_URL}/get-bubble-polygons`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Erreur lors de l\'extraction des polygones');
            }

            const result = await response.json();
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Réinsérer le texte
    async reinsertText(file, bubbles) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('bubbles', JSON.stringify(bubbles));

            const response = await fetch(`${API_BASE_URL}/reinsert`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Erreur lors de la réinsertion');
            }

            const result = await response.json();
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Instance singleton
const authService = new AuthService();
export default authService; 