import React, { useState, useEffect } from 'react';
import './App.css';
import { processImage } from './services/api';
import { validateFile, createZipFile } from './utils/fileUtils';
import ThemeToggle from './components/ui/ThemeToggle';
import ProgressBar from './components/ui/ProgressBar';
import ImagePreviewModal from './components/modals/ImagePreviewModal';
import TextEditorModal from './components/modals/TextEditorModal';
import BubbleEditorModal from './components/modals/BubbleEditorModal';
import LoginModal from './components/LoginModal';
import RegisterModal from './components/RegisterModal';
import QuotaDisplay from './components/QuotaDisplay';
import ProfileModal from './components/ProfileModal';
import ResetPasswordModal from './components/ResetPasswordModal';
import authService from './services/authService';

function App() {
  // === ÉTATS PRINCIPAUX ===
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  
  // === ÉTATS D'AUTHENTIFICATION ===
  const [user, setUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  
  // === ÉTATS DES MODALES ===
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImg, setModalImg] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [bubbleEditorOpen, setBubbleEditorOpen] = useState(false);
  const [bubbleEditorIdx, setBubbleEditorIdx] = useState(null);

  // === GESTION DU THÈME ===
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
  }, []);

  useEffect(() => {
    document.body.className = darkMode ? 'dark-mode' : '';
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  // === GESTION DE L'AUTHENTIFICATION ===
  useEffect(() => {
    const currentUser = authService.getUser();
    const token = authService.getToken();
    console.log("🔍 État de l'authentification:", { user: currentUser, token: token ? "Présent" : "Absent" });
    
    if (currentUser && token) {
      setUser(currentUser);
      console.log("✅ Utilisateur connecté:", currentUser.username);
    } else {
      console.log("❌ Utilisateur non connecté");
      setUser(null);
    }

    // Vérifier s'il y a un token de récupération dans l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    if (resetToken) {
      console.log("🔑 Token de récupération détecté dans l'URL");
      setShowResetPasswordModal(true);
      // Nettoyer l'URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setShowLoginModal(false);
  };

  const handleRegisterSuccess = (userData) => {
    setUser(userData);
    setShowRegisterModal(false);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setFiles([]);
    setImages([]);
  };

  const switchToRegister = () => {
    setShowLoginModal(false);
    setShowRegisterModal(true);
  };

  const switchToLogin = () => {
    setShowRegisterModal(false);
    setShowLoginModal(true);
  };

  // === GESTION DES RACCOURCIS CLAVIER ===
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setModalOpen(false);
        setEditModalOpen(false);
        setBubbleEditorOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // === GESTION DES FICHIERS ===
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const validFiles = [];
    const errors = [];

    selectedFiles.forEach(file => {
      try {
        validateFile(file);
        validFiles.push(file);
      } catch (error) {
        errors.push(`${file.name}: ${error.message}`);
      }
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
      setTimeout(() => setError(null), 5000);
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      setImages(prev => [...prev, ...validFiles.map(file => ({
        file,
        status: 'en attente',
        result: null,
        bubbles: [],
        previewUrl: null,
        cleanedUrl: null,
        cleanedBlob: null,
        width: 0,
        height: 0
      }))]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = [];
    const errors = [];

    droppedFiles.forEach(file => {
      try {
        validateFile(file);
        validFiles.push(file);
      } catch (error) {
        errors.push(`${file.name}: ${error.message}`);
      }
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
      setTimeout(() => setError(null), 5000);
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      setImages(prev => [...prev, ...validFiles.map(file => ({
        file,
        status: 'en attente',
        result: null,
        bubbles: [],
        previewUrl: null,
        cleanedUrl: null,
        cleanedBlob: null,
        width: 0,
        height: 0
      }))]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // === TRAITEMENT DES IMAGES ===
  const handleProcessAll = async (e) => {
    e.preventDefault();
    if (files.length === 0) return;

    // Vérifier l'authentification
    if (!user || !authService.isAuthenticated()) {
      console.log("❌ Utilisateur non authentifié, affichage de la modale de connexion");
      setShowLoginModal(true);
      return;
    }

    setIsProcessing(true);
    setError(null);

    for (let i = 0; i < files.length; i++) {
      if (images[i].status === 'en attente') {
        try {
          setImages(prev => prev.map((img, idx) => 
            idx === i ? { ...img, status: 'traitement' } : img
          ));

          // Utiliser le service d'authentification pour le traitement
          const result = await authService.processImage(files[i]);
          
          if (!result.success) {
            throw new Error(result.error);
          }
          
          // Normaliser la structure des bulles
          const normalizedBubbles = (result.result.bubbles || []).map(bubble => ({
            ...bubble,
            translatedText: bubble.translated_text || bubble.translatedText || '',
            ocrText: bubble.ocr_text || bubble.ocrText || '',
            text: bubble.translated_text || bubble.translatedText || '',
            fontSize: 14
          }));

          setImages(prev => prev.map((img, idx) => 
            idx === i ? {
              ...img,
              status: 'terminée',
              result: { url: `data:image/png;base64,${result.result.image_base64}`, blob: null },
              bubbles: normalizedBubbles,
              previewUrl: `data:image/png;base64,${result.result.image_base64}`,
              cleanedUrl: `data:image/png;base64,${result.result.cleaned_base64}`,
              cleanedBlob: null,
              width: result.result.width || 0,
              height: result.result.height || 0
            } : img
          ));

          // Créer les blobs pour le téléchargement
          const finalBytes = atob(result.result.image_base64);
          const finalArray = new Uint8Array(finalBytes.length);
          for (let j = 0; j < finalBytes.length; j++) {
            finalArray[j] = finalBytes.charCodeAt(j);
          }
          
          const cleanedBytes = atob(result.result.cleaned_base64);
          const cleanedArray = new Uint8Array(cleanedBytes.length);
          for (let j = 0; j < cleanedBytes.length; j++) {
            cleanedArray[j] = cleanedBytes.charCodeAt(j);
          }

          setImages(prev => prev.map((img, idx) => 
            idx === i ? {
              ...img,
              result: { ...img.result, blob: new Blob([finalArray], { type: 'image/png' }) },
              cleanedBlob: new Blob([cleanedArray], { type: 'image/png' })
            } : img
          ));

        } catch (err) {
          console.error(`Erreur lors du traitement de ${files[i].name}:`, err);
          setImages(prev => prev.map((img, idx) => 
            idx === i ? { ...img, status: 'erreur' } : img
          ));
        }
      }
    }

    setIsProcessing(false);
  };

  // === FONCTIONS DES MODALES ===
  const openEditModal = (img, idx) => {
    setEditIdx(idx);
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditIdx(null);
  };

  const openBubbleEditor = (img, idx) => {
    setBubbleEditorIdx(idx);
    setBubbleEditorOpen(true);
  };

  const closeBubbleEditor = () => {
    setBubbleEditorOpen(false);
    setBubbleEditorIdx(null);
  };

  const openModal = (img) => {
    setModalImg(img);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalImg(null);
  };

  // === FONCTIONS DE TÉLÉCHARGEMENT ===
  const handleDownload = (img) => {
    const url = img.previewUrl || (img.result && img.result.url);
    if (!url) return;
    
    const isModified = img.previewUrl && img.previewUrl !== img.result?.url;
    const fileName = isModified ? 
      `image_modifiee_${img.file.name}` : 
      `image_traitee_${img.file.name}`;
    
    createDownloadLink(url, fileName);
  };

  const handleDownloadAllZip = async () => {
    await createZipFile(images);
  };

  const handleDeleteImage = (idx) => {
    setFiles(files.filter((_, i) => i !== idx));
    setImages(images.filter((_, i) => i !== idx));
  };

  // === FONCTIONS DE CALLBACK ===
  const handleSaveImages = (newImages) => {
    setImages(newImages);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // === CALCULS ===
  const progress = images.length === 0 ? 0 : (images.filter(img => img.status === 'terminée' || img.status === 'erreur').length / images.length) * 100;

  // === RENDU ===
  return (
    <div className={`app-bg ${darkMode ? 'dark-mode' : ''}`}>
      <div className={`main-card ${darkMode ? 'dark-mode' : ''}`}>
        {/* Boutons en haut à droite */}
        <div className="top-buttons-container">
          <div className="top-buttons">
            {user ? (
              <div className="user-section">
                <span className="user-info">
                  Bonjour, {user.username}!
                </span>
                <button 
                  className="btn-profile" 
                  onClick={() => setShowProfileModal(true)}
                  title="Gérer le profil"
                >
                  👤
                </button>
                <button 
                  className="btn-logout" 
                  onClick={handleLogout}
                  title="Se déconnecter"
                >
                  🚪
                </button>
              </div>
            ) : (
              <div className="auth-buttons">
                <button 
                  className="btn-auth btn-login" 
                  onClick={() => setShowLoginModal(true)}
                >
                  Se connecter
                </button>
                <button 
                  className="btn-auth btn-register" 
                  onClick={() => setShowRegisterModal(true)}
                >
                  S'inscrire
                </button>
              </div>
            )}
            <ThemeToggle darkMode={darkMode} onToggle={toggleDarkMode} />
          </div>
        </div>
        
        {/* Logo et quotas sur la même ligne */}
        <div className="logo-quota-container">
          <div className="logo-container">
            <img src="/logo-bubble-hack.png" alt="Logo Bubble Hack" className="logo-bubble-hack" />
          </div>
          {/* Affichage des quotas à côté du logo quand connecté */}
          {user && authService.isAuthenticated() && (
            <div className="quota-container">
              <QuotaDisplay />
            </div>
          )}
        </div>
        <p className="subtitle">Uploadez vos pages, nettoyez et traduisez les bulles en un clic.</p>

        <form className="upload-form" onSubmit={handleProcessAll}>
          <div
            className="upload-dropzone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById('file-input').click()}
          >
            <input
              id="file-input"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <div className="upload-icon">📤</div>
            <div className="upload-text">Glissez-déposez ou cliquez pour sélectionner vos images</div>
            {files.length > 0 && (
              <div className="upload-count">{files.length} fichier{files.length > 1 ? 's' : ''} sélectionné{files.length > 1 ? 's' : ''}</div>
            )}
          </div>

          {error && (
            <div className="alert-error">
              {error}
            </div>
          )}

          <button
            className="btn-primary"
            type="submit"
            disabled={files.length === 0 || isProcessing}
          >
            {isProcessing ? <span className="loader"></span> : `Traiter ${files.length > 1 ? 'les images' : "l'image"}`}
          </button>
          {/* Affichage du bouton ZIP uniquement si au moins une image traitée */}
          {images.some(img => img.status === 'terminée') && (
            <button className="btn-primary btn-outline-sm" style={{marginTop: 12}} type="button" onClick={handleDownloadAllZip}>
              ⬇ Télécharger tout (ZIP)
            </button>
          )}
        </form>
        {error && <div className="alert-error">{error}</div>}
        {images.length > 0 && (
          <>
            {isProcessing && (
              <ProgressBar 
                current={images.filter(img => img.status === 'terminée' || img.status === 'erreur').length}
                total={images.length}
              />
            )}

            <div className="image-grid">
              {images.map((img, idx) => (
                <div className="image-card" key={idx}>
                  {img.status === 'en cours' && <div className="loader loader-sm"></div>}
                  {img.status === 'erreur' && <div className="alert-error">{img.error}</div>}
                  {img.result && (
                    <>
                      <div className="image-preview-container">
                        <button className="image-delete-in-img" onClick={() => handleDeleteImage(idx)} title="Supprimer">✕</button>
                        <img
                          className="image-preview"
                          src={img.previewUrl || img.result.url}
                          alt="Image traitée"
                          onClick={() => openModal(img)}
                        />
                        {img.previewUrl && img.previewUrl !== img.result?.url && (
                          <div className="modified-indicator" title="Image modifiée">✏️</div>
                        )}
                      </div>
                      <div className="image-name-sm">{img.file.name}</div>
                      <div 
                        style={{
                          display: 'flex', 
                          gap: 8, 
                          width: '100%',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                        onMouseLeave={(e) => {
                          // Réinitialiser tous les boutons quand on quitte la zone
                          const buttons = e.currentTarget.querySelectorAll('button');
                          buttons.forEach(button => {
                            button.style.width = '33.33%';
                            button.style.minWidth = 'auto';
                            const emojiElement = button.querySelector('.button-emoji');
                            const textElement = button.querySelector('.button-text');
                            if (emojiElement) {
                              emojiElement.style.opacity = '1';
                              emojiElement.style.transform = 'translate(-50%, -50%) scale(1)';
                            }
                            if (textElement) {
                              textElement.style.opacity = '0';
                              textElement.style.transform = 'translate(-50%, -50%) scale(0.8)';
                            }
                          });
                        }}
                      >
                        <button 
                          className="btn-outline btn-outline-sm" 
                          onClick={() => handleDownload(img)}
                          style={{
                            width: '33.33%',
                            minWidth: 'auto',
                            height: '36px',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            maxWidth: 'none'
                          }}
                          onMouseEnter={(e) => {
                            // Réinitialiser d'abord tous les boutons
                            const buttons = e.currentTarget.parentElement.querySelectorAll('button');
                            buttons.forEach(button => {
                              // Réinitialiser la taille
                              button.style.width = '33.33%';
                              button.style.minWidth = 'auto';
                              
                              // Réinitialiser l'emoji et le texte
                              const emojiElement = button.querySelector('.button-emoji');
                              const textElement = button.querySelector('.button-text');
                              if (emojiElement) {
                                emojiElement.style.opacity = '1';
                                emojiElement.style.transform = 'translate(-50%, -50%) scale(1)';
                              }
                              if (textElement) {
                                textElement.style.opacity = '0';
                                textElement.style.transform = 'translate(-50%, -50%) scale(0.8)';
                              }
                            });
                            
                            // Agrandir ce bouton
                            e.target.style.width = '50%';
                            e.target.style.minWidth = '100px';
                            
                            // Rétrécir les autres boutons
                            buttons.forEach(button => {
                              if (button !== e.target) {
                                button.style.width = '25%';
                                button.style.minWidth = 'auto';
                              }
                            });
                            
                            // Masquer l'emoji et afficher le texte pour ce bouton
                            const emojiElement = e.target.querySelector('.button-emoji');
                            const textElement = e.target.querySelector('.button-text');
                            if (emojiElement) {
                              emojiElement.style.opacity = '0';
                              emojiElement.style.transform = 'translate(-50%, -50%) scale(0.8)';
                            }
                            if (textElement) {
                              textElement.style.opacity = '1';
                              textElement.style.transform = 'translate(-50%, -50%) scale(1)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            // Utiliser un délai pour permettre au onMouseEnter du nouveau bouton de s'exécuter
                            setTimeout(() => {
                              // Vérifier si aucun bouton n'est survolé
                              const container = e.currentTarget?.parentElement;
                              if (!container) return;
                              
                              const hoveredButton = container.querySelector(':hover');
                              
                              if (!hoveredButton) {
                                // Réinitialiser ce bouton
                                e.target.style.width = '33.33%';
                                e.target.style.minWidth = 'auto';
                                
                                // Réinitialiser les autres boutons
                                const buttons = container.querySelectorAll('button');
                                buttons.forEach(button => {
                                  button.style.width = '33.33%';
                                  button.style.minWidth = 'auto';
                                });
                                
                                // Afficher l'emoji et masquer le texte
                                const emojiElement = e.target.querySelector('.button-emoji');
                                const textElement = e.target.querySelector('.button-text');
                                if (emojiElement) {
                                  emojiElement.style.opacity = '1';
                                  emojiElement.style.transform = 'translate(-50%, -50%) scale(1)';
                                }
                                if (textElement) {
                                  textElement.style.opacity = '0';
                                  textElement.style.transform = 'translate(-50%, -50%) scale(0.8)';
                                }
                              }
                            }, 10);
                          }}
                        >
                          <span 
                            className="button-emoji"
                            style={{
                              fontSize: '1.2rem',
                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%) scale(1)',
                              opacity: '1'
                            }}
                          >
                            ⬇
                          </span>
                          <span 
                            className="button-text"
                            style={{
                              opacity: '0',
                              transform: 'translate(-50%, -50%) scale(0.8)',
                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              fontSize: '0.8rem',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                              position: 'absolute',
                              top: '50%',
                              left: '50%'
                            }}
                          >
                            Télécharger
                          </span>
                        </button>
                        <button 
                          className="btn-outline btn-outline-sm" 
                          onClick={() => openEditModal(img, idx)}
                          style={{
                            width: '33.33%',
                            minWidth: 'auto',
                            height: '36px',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            maxWidth: 'none'
                          }}
                          onMouseEnter={(e) => {
                            // Réinitialiser d'abord tous les boutons
                            const buttons = e.currentTarget.parentElement.querySelectorAll('button');
                            buttons.forEach(button => {
                              // Réinitialiser la taille
                              button.style.width = '33.33%';
                              button.style.minWidth = 'auto';
                              
                              // Réinitialiser l'emoji et le texte
                              const emojiElement = button.querySelector('.button-emoji');
                              const textElement = button.querySelector('.button-text');
                              if (emojiElement) {
                                emojiElement.style.opacity = '1';
                                emojiElement.style.transform = 'translate(-50%, -50%) scale(1)';
                              }
                              if (textElement) {
                                textElement.style.opacity = '0';
                                textElement.style.transform = 'translate(-50%, -50%) scale(0.8)';
                              }
                            });
                            
                            // Agrandir ce bouton
                            e.target.style.width = '50%';
                            e.target.style.minWidth = '100px';
                            
                            // Rétrécir les autres boutons
                            buttons.forEach(button => {
                              if (button !== e.target) {
                                button.style.width = '25%';
                                button.style.minWidth = 'auto';
                              }
                            });
                            
                            // Masquer l'emoji et afficher le texte pour ce bouton
                            const emojiElement = e.target.querySelector('.button-emoji');
                            const textElement = e.target.querySelector('.button-text');
                            if (emojiElement) {
                              emojiElement.style.opacity = '0';
                              emojiElement.style.transform = 'translate(-50%, -50%) scale(0.8)';
                            }
                            if (textElement) {
                              textElement.style.opacity = '1';
                              textElement.style.transform = 'translate(-50%, -50%) scale(1)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            // Utiliser un délai pour permettre au onMouseEnter du nouveau bouton de s'exécuter
                            setTimeout(() => {
                              // Vérifier si aucun bouton n'est survolé
                              const container = e.currentTarget?.parentElement;
                              if (!container) return;
                              const hoveredButton = container.querySelector(':hover');
                              
                              if (!hoveredButton) {
                                // Réinitialiser ce bouton
                                e.target.style.width = '33.33%';
                                e.target.style.minWidth = 'auto';
                                
                                // Réinitialiser les autres boutons
                                const buttons = container.querySelectorAll('button');
                                buttons.forEach(button => {
                                  button.style.width = '33.33%';
                                  button.style.minWidth = 'auto';
                                });
                                
                                // Afficher l'emoji et masquer le texte
                                const emojiElement = e.target.querySelector('.button-emoji');
                                const textElement = e.target.querySelector('.button-text');
                                if (emojiElement) {
                                  emojiElement.style.opacity = '1';
                                  emojiElement.style.transform = 'translate(-50%, -50%) scale(1)';
                                }
                                if (textElement) {
                                  textElement.style.opacity = '0';
                                  textElement.style.transform = 'translate(-50%, -50%) scale(0.8)';
                                }
                              }
                            }, 10);
                          }}
                        >
                          <span 
                            className="button-emoji"
                            style={{
                              fontSize: '1.2rem',
                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%) scale(1)',
                              opacity: '1'
                            }}
                          >
                            ✏️
                          </span>
                          <span 
                            className="button-text"
                            style={{
                              opacity: '0',
                              transform: 'translate(-50%, -50%) scale(0.8)',
                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              fontSize: '0.8rem',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                              position: 'absolute',
                              top: '50%',
                              left: '50%'
                            }}
                          >
                            Éditer texte
                          </span>
                        </button>
                        <button 
                          className="btn-outline btn-outline-sm btn-bubble-edit" 
                          onClick={() => openBubbleEditor(img, idx)}
                          style={{
                            width: '33.33%',
                            minWidth: 'auto',
                            height: '36px',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            maxWidth: 'none'
                          }}
                          onMouseEnter={(e) => {
                            // Réinitialiser d'abord tous les boutons
                            const buttons = e.currentTarget.parentElement.querySelectorAll('button');
                            buttons.forEach(button => {
                              // Réinitialiser la taille
                              button.style.width = '33.33%';
                              button.style.minWidth = 'auto';
                              
                              // Réinitialiser l'emoji et le texte
                              const emojiElement = button.querySelector('.button-emoji');
                              const textElement = button.querySelector('.button-text');
                              if (emojiElement) {
                                emojiElement.style.opacity = '1';
                                emojiElement.style.transform = 'translate(-50%, -50%) scale(1)';
                              }
                              if (textElement) {
                                textElement.style.opacity = '0';
                                textElement.style.transform = 'translate(-50%, -50%) scale(0.8)';
                              }
                            });
                            
                            // Agrandir ce bouton
                            e.target.style.width = '50%';
                            e.target.style.minWidth = '100px';
                            
                            // Rétrécir les autres boutons
                            buttons.forEach(button => {
                              if (button !== e.target) {
                                button.style.width = '25%';
                                button.style.minWidth = 'auto';
                              }
                            });
                            
                            // Masquer l'emoji et afficher le texte pour ce bouton
                            const emojiElement = e.target.querySelector('.button-emoji');
                            const textElement = e.target.querySelector('.button-text');
                            if (emojiElement) {
                              emojiElement.style.opacity = '0';
                              emojiElement.style.transform = 'translate(-50%, -50%) scale(0.8)';
                            }
                            if (textElement) {
                              textElement.style.opacity = '1';
                              textElement.style.transform = 'translate(-50%, -50%) scale(1)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            // Utiliser un délai pour permettre au onMouseEnter du nouveau bouton de s'exécuter
                            setTimeout(() => {
                              // Vérifier si aucun bouton n'est survolé
                              const container = e.currentTarget?.parentElement;
                              if (!container) return;
                              const hoveredButton = container.querySelector(':hover');
                              
                              if (!hoveredButton) {
                                // Réinitialiser ce bouton
                                e.target.style.width = '33.33%';
                                e.target.style.minWidth = 'auto';
                                
                                // Réinitialiser les autres boutons
                                const buttons = container.querySelectorAll('button');
                                buttons.forEach(button => {
                                  button.style.width = '33.33%';
                                  button.style.minWidth = 'auto';
                                });
                                
                                // Afficher l'emoji et masquer le texte
                                const emojiElement = e.target.querySelector('.button-emoji');
                                const textElement = e.target.querySelector('.button-text');
                                if (emojiElement) {
                                  emojiElement.style.opacity = '1';
                                  emojiElement.style.transform = 'translate(-50%, -50%) scale(1)';
                                }
                                if (textElement) {
                                  textElement.style.opacity = '0';
                                  textElement.style.transform = 'translate(-50%, -50%) scale(0.8)';
                                }
                              }
                            }, 10);
                          }}
                        >
                          <span 
                            className="button-emoji"
                            style={{
                              fontSize: '1.2rem',
                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%) scale(1)',
                              opacity: '1'
                            }}
                          >
                            🛠
                          </span>
                          <span 
                            className="button-text"
                            style={{
                              opacity: '0',
                              transform: 'translate(-50%, -50%) scale(0.8)',
                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              fontSize: '0.8rem',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                              position: 'absolute',
                              top: '50%',
                              left: '50%'
                            }}
                          >
                            Éditer bulles
                          </span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modales */}
      <ImagePreviewModal 
        isOpen={modalOpen} 
        image={modalImg} 
        onClose={closeModal} 
      />
      
      <TextEditorModal 
        isOpen={editModalOpen}
        imageIndex={editIdx}
        images={images}
        onClose={closeEditModal}
        onSave={handleSaveImages}
      />
      
      <BubbleEditorModal 
        isOpen={bubbleEditorOpen}
        imageIndex={bubbleEditorIdx}
        images={images}
        onClose={closeBubbleEditor}
        onSave={handleSaveImages}
      />

      {/* Modales d'authentification */}
      <LoginModal 
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
        onSwitchToRegister={switchToRegister}
      />
      
      <RegisterModal 
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onRegisterSuccess={handleRegisterSuccess}
        onSwitchToLogin={switchToLogin}
      />

      {/* Modal de gestion du profil */}
      <ProfileModal 
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
      />

      {/* Modal de récupération de mot de passe */}
      <ResetPasswordModal 
        isOpen={showResetPasswordModal}
        onClose={() => setShowResetPasswordModal(false)}
        onSuccess={() => {
          setShowResetPasswordModal(false);
          setShowLoginModal(true);
        }}
      />
    </div>
  );
}

export default App; 