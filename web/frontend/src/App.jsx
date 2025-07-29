import React, { useState, useRef, useEffect } from "react";
import './App.css';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

function App() {
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState([]); // [{file, status, result, error, bubbles, previewUrl, width, height}]
  const [globalError, setGlobalError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImg, setModalImg] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [currentBubbleIdx, setCurrentBubbleIdx] = useState(0);
  const [editBubbles, setEditBubbles] = useState([]); // [{ocrText, translatedText, fontSize, x_min, x_max, y_min, y_max}]
  const [editImageUrl, setEditImageUrl] = useState(null);
  const [editImageSize, setEditImageSize] = useState({width: 0, height: 0});
  const [editCleanedUrl, setEditCleanedUrl] = useState(null);
  const [initialAdjustmentDone, setInitialAdjustmentDone] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const canvasRef = useRef(null);

  // Appliquer le mode dark/light au body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    const allFiles = [...files];
    const allImages = [...images];
    selected.forEach(file => {
      const alreadyExists = allFiles.some(f => f.name === file.name && f.size === file.size);
      if (!alreadyExists) {
        allFiles.push(file);
        allImages.push({ file, status: 'en attente', result: null, error: null });
      }
    });
    setFiles(allFiles);
    setImages(allImages);
    setGlobalError("");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = Array.from(e.dataTransfer.files);
      const allFiles = [...files];
      const allImages = [...images];
      selected.forEach(file => {
        const alreadyExists = allFiles.some(f => f.name === file.name && f.size === file.size);
        if (!alreadyExists) {
          allFiles.push(file);
          allImages.push({ file, status: 'en attente', result: null, error: null });
        }
      });
      setFiles(allFiles);
      setImages(allImages);
      setGlobalError("");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Traitement des images (upload)
  const handleProcessAll = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setGlobalError("");
    const newImages = [...images];
    for (let i = 0; i < newImages.length; i++) {
      if (newImages[i].status === 'en attente' || newImages[i].status === 'erreur') {
        newImages[i].status = 'en cours';
        setImages([...newImages]);
        try {
          const formData = new FormData();
          formData.append("file", newImages[i].file);
          const res = await fetch("http://localhost:8000/process", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            throw new Error(`Erreur HTTP: ${res.status}`);
          }
          const data = await res.json();
          // data: { image_base64, bubbles, cleaned_base64 }
          const imageUrl = `data:image/png;base64,${data.image_base64}`;
          const cleanedUrl = data.cleaned_base64 ? `data:image/png;base64,${data.cleaned_base64}` : null;
          
          // Créer le blob pour l'image nettoyée
          let cleanedBlob = null;
          if (data.cleaned_base64) {
            try {
              const cleanedBytes = atob(data.cleaned_base64);
              const cleanedArray = new Uint8Array(cleanedBytes.length);
              for (let j = 0; j < cleanedBytes.length; j++) {
                cleanedArray[j] = cleanedBytes.charCodeAt(j);
              }
              cleanedBlob = new Blob([cleanedArray], { type: 'image/png' });
              console.log("Blob créé avec succès:", cleanedBlob.size, "bytes");
            } catch (error) {
              console.error("Erreur lors de la création du blob:", error);
              // Méthode alternative : créer le blob à partir de l'URL
              if (cleanedUrl) {
                fetch(cleanedUrl)
                  .then(res => res.blob())
                  .then(blob => {
                    cleanedBlob = blob;
                    console.log("Blob créé via fetch:", cleanedBlob.size, "bytes");
                  })
                  .catch(err => console.error("Erreur fetch:", err));
              }
            }
          } else {
            console.warn("cleaned_base64 manquant dans la réponse");
          }
          
          // Charger la taille de l'image
          const img = new window.Image();
          img.onload = function() {
            newImages[i].result = { url: imageUrl, blob: null };
            newImages[i].cleanedUrl = cleanedUrl;
            newImages[i].cleanedBlob = cleanedBlob;
            newImages[i].bubbles = data.bubbles.map(b => ({
              ocrText: b.ocr_text,
              translatedText: b.translated_text,
              fontSize: 14,
              x_min: b.x_min,
              x_max: b.x_max,
              y_min: b.y_min,
              y_max: b.y_max,
              confidence: b.confidence,
              class: b.class
            }));
            newImages[i].width = img.width;
            newImages[i].height = img.height;
            newImages[i].status = 'terminée';
            newImages[i].error = null;
            setImages([...newImages]);
          };
          img.src = imageUrl;
        } catch (err) {
          newImages[i].status = 'erreur';
          newImages[i].error = err.message;
          newImages[i].result = null;
          setImages([...newImages]);
        }
      }
    }
    setProcessing(false);
  };

  // Ouvre la popin d'édition
  const openEditModal = (img, idx) => {
    setEditIdx(idx);
    setCurrentBubbleIdx(0);
    const bubbles = img.bubbles ? img.bubbles.map(b => ({...b})) : [];
    setEditBubbles(bubbles);
    setEditImageUrl(img.cleanedUrl || img.result.url);
    setEditCleanedUrl(img.cleanedUrl || null);
    setEditImageSize({width: img.width, height: img.height});
    setEditModalOpen(true);
    setInitialAdjustmentDone(false);
    
    // Ajuster automatiquement toutes les tailles de police à la première ouverture
    setTimeout(() => {
      if (!initialAdjustmentDone) {
        bubbles.forEach((_, index) => autoAdjustFontSize(index));
        setInitialAdjustmentDone(true);
      }
    }, 100);
  };
  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditIdx(null);
    setCurrentBubbleIdx(0);
    setEditBubbles([]);
    setEditImageUrl(null);
    setEditImageSize({width: 0, height: 0});
    setInitialAdjustmentDone(false);
  };
  // Met à jour le texte traduit en temps réel
  const handleBubbleTextChange = (val) => {
    const newBubbles = [...editBubbles];
    newBubbles[currentBubbleIdx].translatedText = val;
    setEditBubbles(newBubbles);
  };
  // Met à jour la taille de police en temps réel
  const handleFontSizeChange = (val) => {
    const newBubbles = [...editBubbles];
    newBubbles[currentBubbleIdx].fontSize = parseInt(val, 10);
    setEditBubbles(newBubbles);
  };
  // Navigation entre bulles
  const goToPrevBubble = () => {
    if (currentBubbleIdx > 0) setCurrentBubbleIdx(currentBubbleIdx - 1);
  };
  const goToNextBubble = () => {
    if (currentBubbleIdx < editBubbles.length - 1) setCurrentBubbleIdx(currentBubbleIdx + 1);
  };
  // Sauvegarde les modifications dans l'état principal
  const saveEditModal = async () => {
    if (editIdx !== null) {
      const newImages = [...images];
      newImages[editIdx].bubbles = editBubbles.map(b => ({...b}));
      // Appel au backend pour réinsertion réelle
      try {
        const formData = new FormData();
        let cleanedBlob = newImages[editIdx].cleanedBlob;
        
        // Si le blob n'est pas disponible, essayer de le créer à partir de l'URL
        if (!cleanedBlob && newImages[editIdx].cleanedUrl) {
          try {
            const response = await fetch(newImages[editIdx].cleanedUrl);
            cleanedBlob = await response.blob();
            console.log("Blob créé à partir de l'URL:", cleanedBlob.size, "bytes");
          } catch (error) {
            console.error("Erreur lors de la création du blob depuis l'URL:", error);
          }
        }
        
        if (!cleanedBlob) {
          alert("Image nettoyée manquante. Impossible de créer le blob nécessaire pour l'édition.");
          closeEditModal();
          return;
        }
        
        formData.append("file", cleanedBlob, "cleaned.png");
        formData.append("bubbles", JSON.stringify(editBubbles.map(b => ({
          ...b,
          translated_text: b.translatedText,
          ocr_text: b.ocrText
        }))));
        const res = await fetch("http://localhost:8000/reinsert", {
          method: "POST",
          body: formData
        });
        if (!res.ok) throw new Error("Erreur lors de la réinsertion du texte");
        const data = await res.json();
        const finalUrl = `data:image/png;base64,${data.image_base64}`;
        
        // Mettre à jour l'image dans la grille avec la version modifiée
        newImages[editIdx].previewUrl = finalUrl;
        newImages[editIdx].result = { 
          url: finalUrl, 
          blob: null 
        };
        
        // Créer le blob pour le téléchargement
        const finalBytes = atob(data.image_base64);
        const finalArray = new Uint8Array(finalBytes.length);
        for (let j = 0; j < finalBytes.length; j++) {
          finalArray[j] = finalBytes.charCodeAt(j);
        }
        newImages[editIdx].result.blob = new Blob([finalArray], { type: 'image/png' });
        
        setImages(newImages);
        closeEditModal();
      } catch (err) {
        alert("Erreur lors de la réinsertion du texte: " + err.message);
        closeEditModal();
      }
    } else {
      closeEditModal();
    }
  };
  // Met à jour la preview (canvas -> url)
  const updatePreviewImage = (imagesArr, idx, imgUrl, bubbles, imgSize, cb) => {
    const img = new window.Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      // Dessiner chaque bulle à sa position bbox
      bubbles.forEach(bulle => {
        const x = (bulle.x_min + bulle.x_max) / 2;
        const y = (bulle.y_min + bulle.y_max) / 2;
        ctx.font = `${bulle.fontSize||24}px Arial`;
        ctx.fillStyle = '#111';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.strokeText(bulle.translatedText, x, y);
        ctx.fillText(bulle.translatedText, x, y);
      });
      const url = canvas.toDataURL('image/png');
      imagesArr[idx].previewUrl = url;
      if (cb) cb();
    };
    img.src = imgUrl;
  };
  // Fonction utilitaire pour word wrap sur le canvas
  function wrapText(ctx, text, x, y, maxWidth, lineHeight, color, font, align = 'center') {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    const words = text.split(' ');
    let line = '';
    let lines = [];
    for (let n = 0; n < words.length; n++) {
      const testLine = line + (line ? ' ' : '') + words[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line);
        line = words[n];
      } else {
        line = testLine;
      }
    }
    lines.push(line);
    // Calculer la hauteur totale
    const totalHeight = lines.length * lineHeight;
    let startY = y - totalHeight / 2 + lineHeight / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.strokeText(lines[i], x, startY + i * lineHeight);
      ctx.fillText(lines[i], x, startY + i * lineHeight);
    }
    ctx.restore();
  }
  // Met à jour la preview en temps réel dans la popin
  useEffect(() => {
    if (!editModalOpen || !editCleanedUrl || !editBubbles.length) return;
    
    // Forcer le chargement de la police avant de dessiner
    const testFont = new FontFace('Anime Ace', 'url(./fonts/animeace2_reg.ttf)');
    testFont.load().then(() => {
      document.fonts.add(testFont);
      
      const img = new window.Image();
      img.onload = function() {
        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        // Dessiner toutes les bulles (pour voir le rendu global)
        editBubbles.forEach((bulle, idx) => {
          const x = (bulle.x_min + bulle.x_max) / 2;
          const y = (bulle.y_min + bulle.y_max) / 2;
          // Utiliser les mêmes marges que dans calculateOptimalFontSize (10%)
          const bubbleWidth = bulle.x_max - bulle.x_min;
          const marginX = bubbleWidth * 0.1;
          const maxWidth = bubbleWidth - (2 * marginX);
          const fontSize = bulle.fontSize || 24;
          const font = `${fontSize}px 'Anime Ace', Arial, sans-serif`;
          const color = idx === currentBubbleIdx ? '#7c3aed' : '#111';
          wrapText(ctx, bulle.translatedText, x, y, maxWidth, fontSize * 1.15, color, font);
        });
        // Optionnel : dessiner un rectangle autour de la bulle sélectionnée
        const bulle = editBubbles[currentBubbleIdx];
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(bulle.x_min, bulle.y_min, bulle.x_max-bulle.x_min, bulle.y_max-bulle.y_min);
        ctx.restore();
      };
      img.src = editCleanedUrl;
    }).catch(() => {
      // Fallback si la police ne peut pas être chargée
      const img = new window.Image();
      img.onload = function() {
        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        // Dessiner toutes les bulles (pour voir le rendu global)
        editBubbles.forEach((bulle, idx) => {
          const x = (bulle.x_min + bulle.x_max) / 2;
          const y = (bulle.y_min + bulle.y_max) / 2;
          // Utiliser les mêmes marges que dans calculateOptimalFontSize (10%)
          const bubbleWidth = bulle.x_max - bulle.x_min;
          const marginX = bubbleWidth * 0.1;
          const maxWidth = bubbleWidth - (2 * marginX);
          const fontSize = bulle.fontSize || 24;
          const font = `${fontSize}px 'Anime Ace', Arial, sans-serif`;
          const color = idx === currentBubbleIdx ? '#7c3aed' : '#111';
          wrapText(ctx, bulle.translatedText, x, y, maxWidth, fontSize * 1.15, color, font);
        });
        // Optionnel : dessiner un rectangle autour de la bulle sélectionnée
        const bulle = editBubbles[currentBubbleIdx];
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(bulle.x_min, bulle.y_min, bulle.x_max-bulle.x_min, bulle.y_max-bulle.y_min);
        ctx.restore();
      };
      img.src = editCleanedUrl;
    });
  }, [editModalOpen, editCleanedUrl, editBubbles, currentBubbleIdx]);



  // Fonction pour gérer le clic sur le canvas
  const handleCanvasClick = (event) => {
    if (!editBubbles.length) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    // Trouver la bulle cliquée
    for (let i = 0; i < editBubbles.length; i++) {
      const bulle = editBubbles[i];
      if (x >= bulle.x_min && x <= bulle.x_max && 
          y >= bulle.y_min && y <= bulle.y_max) {
        setCurrentBubbleIdx(i);
        break;
      }
    }
  };

  // Lors du téléchargement, utiliser l'image modifiée si disponible
  const handleDownload = (img) => {
    // Priorité : image modifiée (previewUrl) > image traitée originale (result.url)
    const url = img.previewUrl || (img.result && img.result.url);
    if (!url) return;
    
    const link = document.createElement("a");
    link.href = url;
    
    // Nom du fichier avec indication si modifié
    const isModified = img.previewUrl && img.previewUrl !== img.result?.url;
    const fileName = isModified ? 
      `image_modifiee_${img.file.name}` : 
      `image_traitee_${img.file.name}`;
    
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Téléchargement de toutes les images dans un zip
  const handleDownloadAllZip = async () => {
    const zip = new JSZip();
    const folder = zip.folder('images');
    for (let img of images) {
      if (img.status === 'terminée' && img.result) {
        let url = img.previewUrl || img.result.url;
        let response = await fetch(url);
        let blob = await response.blob();
        let ext = img.file.name.split('.').pop();
        let name = img.file.name.replace(/\.[^.]+$/, '');
        folder.file(`${name}.png`, blob); // On force png pour la cohérence
      }
    }
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'images_bubble_cleaner.zip');
  };

  const handleDeleteImage = (idx) => {
    setFiles(files.filter((_, i) => i !== idx));
    setImages(images.filter((_, i) => i !== idx));
  };

  const openModal = (img) => {
    setModalImg(img);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setModalImg(null);
  };

  const progress = images.length === 0 ? 0 : (images.filter(img => img.status === 'terminée' || img.status === 'erreur').length / images.length) * 100;

  // Fonction pour toggle le mode dark/light
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Fonction intelligente pour calculer la taille de police
  const calculateSmartFontSize = (text, bubble) => {
    if (!text || !text.trim()) return 14;
    
    const bubbleWidth = bubble.x_max - bubble.x_min;
    const bubbleHeight = bubble.y_max - bubble.y_min;
    
    // Calculer la longueur du texte
    const textLength = text.length;
    
    // Base de calcul selon la longueur du texte
    let baseSize = 16; // Taille de base
    
    if (textLength <= 10) {
      baseSize = 20; // Texte court = police plus grande
    } else if (textLength <= 20) {
      baseSize = 18; // Texte moyen
    } else if (textLength <= 30) {
      baseSize = 16; // Texte long
    } else if (textLength <= 50) {
      baseSize = 14; // Très long texte
    } else {
      baseSize = 12; // Texte très long
    }
    
    // Calculer le facteur basé sur les dimensions de la bulle
    // Plus la bulle est grande, plus on peut utiliser une grande police
    const minDimension = Math.min(bubbleWidth, bubbleHeight);
    const maxDimension = Math.max(bubbleWidth, bubbleHeight);
    
    // Facteur basé sur la plus petite dimension (hauteur pour les bulles hautes, largeur pour les bulles larges)
    let dimensionFactor = minDimension / 50; // Normaliser par rapport à 50px
    
    // Ajuster selon le ratio largeur/hauteur
    const ratio = bubbleWidth / bubbleHeight;
    if (ratio > 2) {
      // Bulle très large, réduire un peu
      dimensionFactor *= 0.8;
    } else if (ratio < 0.5) {
      // Bulle très haute, réduire un peu
      dimensionFactor *= 0.8;
    }
    
    let finalSize = Math.round(baseSize * dimensionFactor);
    
    // Limites de sécurité
    finalSize = Math.max(8, Math.min(32, finalSize));
    
    console.log(`Calcul intelligent pour "${text}":`, {
      textLength: textLength,
      bubbleSize: { width: bubbleWidth, height: bubbleHeight },
      ratio: ratio,
      minDimension: minDimension,
      dimensionFactor: dimensionFactor,
      baseSize: baseSize,
      finalSize: finalSize
    });
    
    return finalSize;
  };

  // Fonction pour ajuster automatiquement la taille de police
  const autoAdjustFontSize = (bubbleIndex) => {
    if (!editBubbles[bubbleIndex]) return;
    
    const bubble = editBubbles[bubbleIndex];
    const text = bubble.translatedText || bubble.ocrText || '';
    
    if (!text.trim()) return;
    
    const smartSize = calculateSmartFontSize(text, bubble);
    
    const newBubbles = [...editBubbles];
    newBubbles[bubbleIndex].fontSize = smartSize;
    setEditBubbles(newBubbles);
  };

  return (
    <div className={`app-bg ${darkMode ? 'dark-mode' : ''}`}>
      <div className={`main-card ${darkMode ? 'dark-mode' : ''}`}>
        <div className="logo-container">
          <img src="/logo-bubble-hack.png" alt="Logo Bubble Hack" className="logo-bubble-hack" />
        </div>
        <div className="header-container">
          {/* Titre supprimé car déjà dans le logo */}
          <button 
            className="theme-toggle" 
            onClick={toggleDarkMode}
            title={darkMode ? "Passer en mode clair" : "Passer en mode sombre"}
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
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
          <button
            className="btn-primary"
            type="submit"
            disabled={files.length === 0 || processing}
          >
            {processing ? <span className="loader"></span> : `Traiter ${files.length > 1 ? 'les images' : "l'image"}`}
          </button>
          {/* Affichage du bouton ZIP uniquement si au moins une image traitée */}
          {images.some(img => img.status === 'terminée') && (
            <button className="btn-primary btn-outline-sm" style={{marginTop: 12}} type="button" onClick={handleDownloadAllZip}>
              ⬇ Télécharger tout (ZIP)
            </button>
          )}
        </form>
        {globalError && <div className="alert-error">{globalError}</div>}
        {images.length > 0 && (
          <>
            {processing && (
              <div className="progress-bar-container">
                <div className="progress-bar-bg">
                  <div className="progress-bar-fg" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="progress-bar-label">{images.filter(img => img.status === 'terminée' || img.status === 'erreur').length} / {images.length} images traitées</div>
              </div>
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
                      <button className="btn-outline btn-outline-sm" onClick={() => handleDownload(img)}>
                        ⬇ Télécharger
                      </button>
                      <button className="btn-outline btn-outline-sm btn-edit" onClick={() => openEditModal(img, idx)}>
                        ✏️ Éditer
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {modalOpen && modalImg && (
        <div className="modal-bg" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>✕</button>
            <img
              className="modal-image"
              src={modalImg.previewUrl || modalImg.result.url}
              alt="Aperçu"
            />
          </div>
        </div>
      )}

      {editModalOpen && (
        <div className="modal-bg" onClick={closeEditModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{
            width: '90vw',
            height: '90vh',
            maxWidth: 1600,
            maxHeight: 1000,
            minWidth: 900,
            minHeight: 500,
            display: 'flex',
            flexDirection: 'row',
            gap: 32,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: 0
          }}>
            <button className="modal-close" onClick={closeEditModal}>✕</button>
            {/* Image à gauche */}
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              minWidth: 0,
              minHeight: 0,
              height: '100%',
              overflow: 'auto'
            }}>
              <canvas
                ref={canvasRef}
                width={editImageSize.width}
                height={editImageSize.height}
                onClick={handleCanvasClick}
                className="editor-canvas"
                style={{
                  maxWidth: 'calc(90vw - 420px)',
                  maxHeight: '85vh',
                  width: 'auto',
                  height: 'auto',
                  borderRadius: 12,
                  border: '2px solid #a78bfa',
                  background: '#fff',
                  boxShadow: '0 4px 24px 0 rgba(124,58,237,0.12)',
                  display: 'block',
                  margin: '0 auto',
                  cursor: 'pointer'
                }}
              />
            </div>
            {/* Zone d'édition à droite */}
            <div style={{
              width: 400,
              minWidth: 320,
              maxWidth: 440,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              overflowY: 'auto',
              background: 'rgba(255,255,255,0.97)',
              borderLeft: '1.5px solid #ede9fe',
              padding: '24px 18px 18px 18px',
              boxSizing: 'border-box'
            }}>
              <div style={{marginBottom: 8, color: '#6366f1', fontWeight: 600}}>
                Bulle {currentBubbleIdx + 1} / {editBubbles.length}
              </div>
              <div style={{marginBottom: 12, color: '#7c3aed', fontSize: 13, fontStyle: 'italic'}}>
                💡 Cliquez sur une bulle dans l'image pour la sélectionner
              </div>
              <div style={{marginBottom: 8, color: '#888', fontSize: 14}}>
                <b>Texte original :</b><br/>{editBubbles[currentBubbleIdx]?.ocrText || <i>(vide)</i>}
              </div>
              <div style={{marginBottom: 8, color: '#7c3aed', fontWeight: 500, fontSize: 15}}>
                <b>Texte traduit :</b>
              </div>
              <textarea
                className="edit-textarea"
                value={editBubbles[currentBubbleIdx]?.translatedText || ""}
                onChange={e => handleBubbleTextChange(e.target.value)}
                rows={6}
                style={{ width: '100%', borderRadius: 8, border: '1.5px solid #a78bfa', padding: 10, fontSize: 16, resize: 'vertical', marginBottom: 8 }}
              />
              <div style={{marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8}}>
                <label style={{color: '#6366f1', fontWeight: 500}}>Taille police :</label>
                <input type="number" min={8} max={80} value={editBubbles[currentBubbleIdx]?.fontSize || 14} onChange={e => handleFontSizeChange(e.target.value)} style={{width: 70, borderRadius: 6, border: '1.5px solid #a78bfa', padding: 4, fontSize: 15}} />
              </div>
              <div style={{display: 'flex', gap: 8, marginTop: 12}}>
                <button className="btn-outline btn-outline-sm" onClick={goToPrevBubble} disabled={currentBubbleIdx === 0}>◀ Précédente</button>
                <button className="btn-outline btn-outline-sm" onClick={goToNextBubble} disabled={currentBubbleIdx === editBubbles.length - 1}>Suivante ▶</button>
                <div style={{flex: 1}}></div>
                <button className="btn-outline btn-outline-sm" onClick={closeEditModal}>Annuler</button>
                <button className="btn-primary btn-outline-sm" onClick={saveEditModal}>Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 