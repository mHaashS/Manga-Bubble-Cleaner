import React, { useState, useEffect, useRef } from 'react';
import { reinsertText } from '../../services/api';
import { wrapText, calculateSmartFontSize } from '../../utils/canvasUtils';
import { base64ToBlob } from '../../utils/fileUtils';

// Configuration des polices disponibles
const AVAILABLE_FONTS = [
  { 
    name: 'Anime Ace', 
    file: 'animeace2_reg.ttf',
    displayName: 'Anime Ace (défaut)'
  },
  { 
    name: 'CC Wild Words Roman', 
    file: 'CC Wild Words Roman.ttf',
    displayName: 'CC Wild Words Roman'
  },
  { 
    name: 'DJB Almost Perfect', 
    file: 'DJB Almost Perfect.ttf',
    displayName: 'DJB Almost Perfect'
  },
  { 
    name: 'Manga Temple', 
    file: 'Manga Temple.ttf',
    displayName: 'Manga Temple'
  }
];

const TextEditorModal = ({ isOpen, imageIndex, images, onClose, onSave }) => {
  // === ÉTATS ===
  const [currentBubbleIdx, setCurrentBubbleIdx] = useState(0);
  const [editBubbles, setEditBubbles] = useState([]);
  const [editImageUrl, setEditImageUrl] = useState(null);
  const [editImageSize, setEditImageSize] = useState({width: 0, height: 0});
  const [editCleanedUrl, setEditCleanedUrl] = useState(null);
  const [initialAdjustmentDone, setInitialAdjustmentDone] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  
  const canvasRef = useRef(null);

  // === CHARGEMENT DES POLICES ===
  useEffect(() => {
    const loadFonts = async () => {
      try {
        const fontPromises = AVAILABLE_FONTS.map(async (font) => {
          try {
            // Encoder le nom de fichier pour gérer les espaces dans les URLs
            const encodedFileName = encodeURIComponent(font.file);
            const fontFace = new FontFace(font.name, `url(/fonts/${encodedFileName})`);
            const loadedFont = await fontFace.load();
            document.fonts.add(loadedFont);
            console.log(`Police chargée avec succès: ${font.name}`);
            return font;
          } catch (error) {
            console.warn(`Impossible de charger la police: ${font.name}`, error);
            return null;
          }
        });
        
        await Promise.all(fontPromises);
        setFontsLoaded(true);
        console.log('Toutes les polices ont été chargées');
      } catch (error) {
        console.error('Erreur lors du chargement des polices:', error);
        setFontsLoaded(true); // Continuer même si certaines polices échouent
      }
    };

    if (isOpen) {
      loadFonts();
    }
  }, [isOpen]);

  // === INITIALISATION ===
  useEffect(() => {
    if (isOpen && imageIndex !== null && images[imageIndex]) {
      const img = images[imageIndex];
      setCurrentBubbleIdx(0);
      const bubbles = img.bubbles ? img.bubbles.map(b => ({...b})) : [];
      
      // S'assurer que toutes les bulles ont une taille de police et une police valides
      const normalizedBubbles = bubbles.map(bubble => ({
        ...bubble,
        fontSize: bubble.fontSize || 14,
        fontFamily: bubble.fontFamily || 'Anime Ace' // Police par défaut
      }));
      
      setEditBubbles(normalizedBubbles);
      
      // Utiliser la bonne image : cleanedUrl si disponible, sinon result.url
      const imageToUse = img.cleanedUrl || img.result.url;
      setEditImageUrl(imageToUse);
      setEditCleanedUrl(img.cleanedUrl || null);
      setEditImageSize({width: img.width, height: img.height});
      setInitialAdjustmentDone(false);
      
      // Ajuster automatiquement toutes les tailles de police à la première ouverture
      setTimeout(() => {
        if (!initialAdjustmentDone) {
          normalizedBubbles.forEach((_, index) => autoAdjustFontSize(index));
          setInitialAdjustmentDone(true);
        }
      }, 100);
    }
  }, [isOpen, imageIndex, images]);

  // === FONCTIONS ===
  const handleBubbleTextChange = (val) => {
    const newBubbles = [...editBubbles];
    newBubbles[currentBubbleIdx].translatedText = val;
    setEditBubbles(newBubbles);
  };

  const handleFontSizeChange = (val) => {
    const newBubbles = [...editBubbles];
    newBubbles[currentBubbleIdx].fontSize = parseInt(val, 10);
    setEditBubbles(newBubbles);
  };

  const handleFontFamilyChange = (fontFamily) => {
    const newBubbles = [...editBubbles];
    newBubbles[currentBubbleIdx].fontFamily = fontFamily;
    setEditBubbles(newBubbles);
  };

  const goToPrevBubble = () => {
    if (currentBubbleIdx > 0) setCurrentBubbleIdx(currentBubbleIdx - 1);
  };

  const goToNextBubble = () => {
    if (currentBubbleIdx < editBubbles.length - 1) setCurrentBubbleIdx(currentBubbleIdx + 1);
  };

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

  const saveEditModal = async () => {
    if (imageIndex !== null) {
      const newImages = [...images];
      
      // S'assurer que les informations de police sont conservées dans l'état des images
      const updatedBubbles = editBubbles.map(bubble => ({
        ...bubble,
        fontFamily: bubble.fontFamily || 'Anime Ace',
        fontSize: bubble.fontSize || 14
      }));
      
      newImages[imageIndex].bubbles = updatedBubbles;
      
      try {
        let cleanedBlob = newImages[imageIndex].cleanedBlob;
        
        // Si le blob n'est pas disponible, essayer de le créer à partir de l'URL
        if (!cleanedBlob && newImages[imageIndex].cleanedUrl) {
          try {
            const response = await fetch(newImages[imageIndex].cleanedUrl);
            cleanedBlob = await response.blob();
          } catch (error) {
            console.error("Erreur lors de la création du blob depuis l'URL:", error);
          }
        }
        
        if (!cleanedBlob) {
          alert("Image nettoyée manquante. Impossible de créer le blob nécessaire pour l'édition.");
          onClose();
          return;
        }
        
        // Préparer les données avec les informations de police
        const bubblesWithFonts = updatedBubbles.map(b => ({
          ...b,
          translated_text: b.translatedText,
          ocr_text: b.ocrText,
          font_family: b.fontFamily || 'Anime Ace',
          font_size: b.fontSize || 14
        }));
        
        console.log('Données envoyées au backend:', bubblesWithFonts);
        console.log('Détail des polices envoyées:', bubblesWithFonts.map(b => ({
          index: b.index,
          translated_text: b.translated_text,
          font_family: b.font_family,
          font_size: b.font_size
        })));
        
        const data = await reinsertText(cleanedBlob, bubblesWithFonts);
        
        const finalUrl = `data:image/png;base64,${data.image_base64}`;
        
        // Mettre à jour l'image dans la grille avec la version modifiée
        newImages[imageIndex].previewUrl = finalUrl;
        newImages[imageIndex].result = { 
          url: finalUrl, 
          blob: base64ToBlob(data.image_base64)
        };
        
        // S'assurer que les informations de police sont conservées dans l'état final
        newImages[imageIndex].bubbles = updatedBubbles;
        
        console.log('Images mises à jour avec les polices:', newImages[imageIndex].bubbles);
        
        onSave(newImages);
        onClose();
      } catch (err) {
        alert("Erreur lors de la réinsertion du texte: " + err.message);
        onClose();
      }
    } else {
      onClose();
    }
  };

  // === EFFET POUR DESSINER LE CANVAS ===
  useEffect(() => {
    if (!isOpen || !editCleanedUrl || !editBubbles.length || !fontsLoaded) return;
    
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
        const fontSize = bulle.fontSize || 14;
        const fontFamily = bulle.fontFamily || 'Anime Ace';
        
        // Vérifier si la police est disponible avec plus de détails
        const isFontAvailable = document.fonts.check(`12px "${fontFamily}"`);
        const finalFontFamily = isFontAvailable ? fontFamily : 'Anime Ace';
        
        const font = `${fontSize}px "${finalFontFamily}", Arial, sans-serif`;
        const color = idx === currentBubbleIdx ? '#7c3aed' : '#111';
        
        console.log(`Rendu bulle ${idx}: police "${finalFontFamily}" (demandée: "${fontFamily}", disponible: ${isFontAvailable})`);
        wrapText(ctx, bulle.translatedText, x, y, maxWidth, fontSize * 1.15, color, font);
      });
      
      // Dessiner un rectangle autour de la bulle sélectionnée
      const bulle = editBubbles[currentBubbleIdx];
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bulle.x_min, bulle.y_min, bulle.x_max-bulle.x_min, bulle.y_max-bulle.y_min);
      ctx.restore();
    };
    img.src = editCleanedUrl;
  }, [isOpen, editCleanedUrl, editBubbles, currentBubbleIdx, fontsLoaded]);

  // === RENDU ===
  if (!isOpen) return null;

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        width: '95vw',
        height: '90vh',
        maxWidth: 1800,
        maxHeight: 1000,
        minWidth: 1000,
        minHeight: 500,
        display: 'flex',
        flexDirection: 'row',
        gap: 24,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: 0
      }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        
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
              maxWidth: 'calc(95vw - 620px)',
              maxHeight: '85vh',
              width: 'auto',
              height: 'auto',
              borderRadius: 12,
              border: '2px solid #a78bfa',
              background: '#f8fafc',
              boxShadow: '0 4px 24px 0 rgba(124,58,237,0.12)',
              display: 'block',
              margin: '0 auto',
              cursor: 'pointer'
            }}
          />
        </div>
        
        {/* Zone d'édition à droite */}
        <div style={{
          width: 420,
          minWidth: 380,
          maxWidth: 460,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflowY: 'auto',
          background: 'rgba(248, 250, 252, 0.97)',
          borderLeft: '1px solid rgba(124, 58, 237, 0.2)',
          padding: '20px 16px 16px 16px',
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
            style={{ width: '90%', borderRadius: 8, border: '1.5px solid #a78bfa', padding: 10, fontSize: 16, resize: 'vertical', marginBottom: 8 }}
          />
          
          {/* Contrôles de police */}
          <div style={{marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8}}>
            <label style={{color: '#6366f1', fontWeight: 500, minWidth: 80}}>Police :</label>
            <select 
              value={editBubbles[currentBubbleIdx]?.fontFamily || 'Anime Ace'} 
              onChange={e => handleFontFamilyChange(e.target.value)}
              style={{
                flex: 1,
                borderRadius: 6, 
                border: '1.5px solid #a78bfa', 
                padding: 6, 
                fontSize: 14,
                backgroundColor: '#ffffff'
              }}
            >
              {AVAILABLE_FONTS.map(font => (
                <option key={font.name} value={font.name}>
                  {font.displayName}
                </option>
              ))}
            </select>
          </div>
          
          <div style={{marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8}}>
            <label style={{color: '#6366f1', fontWeight: 500}}>Taille police :</label>
            <input 
              type="number" 
              min={8} 
              max={80} 
              value={editBubbles[currentBubbleIdx]?.fontSize || 14} 
              onChange={e => handleFontSizeChange(e.target.value)} 
              style={{
                width: 70, 
                borderRadius: 6, 
                border: '1.5px solid #a78bfa', 
                padding: 4, 
                fontSize: 15
              }} 
            />
          </div>
          
          <div style={{display: 'flex', gap: 12, marginTop: 16}}>
            <button className="btn-outline" style={{flex: 1, padding: '12px 16px', fontSize: 15, fontWeight: 500}} onClick={goToPrevBubble} disabled={currentBubbleIdx === 0}>◀ Précédente</button>
            <button className="btn-outline" style={{flex: 1, padding: '12px 16px', fontSize: 15, fontWeight: 500}} onClick={goToNextBubble} disabled={currentBubbleIdx === editBubbles.length - 1}>Suivante ▶</button>
          </div>
          <div style={{display: 'flex', gap: 12, marginTop: 12}}>
            <button 
              style={{
                flex: 1, 
                padding: '12px 16px', 
                fontSize: 15, 
                fontWeight: 500, 
                borderColor: '#ef4444', 
                color: '#ef4444',
                backgroundColor: 'transparent',
                border: '1.5px solid #ef4444',
                borderRadius: 8,
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#dc2626';
                e.target.style.color = '#ffffff';
                e.target.style.borderColor = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = '#ef4444';
                e.target.style.borderColor = '#ef4444';
              }}
              onClick={onClose}
            >
              Annuler
            </button>
            <button 
              style={{
                flex: 1, 
                padding: '12px 16px', 
                fontSize: 15, 
                fontWeight: 500,
                backgroundColor: '#7c3aed',
                color: '#ffffff',
                border: '1.5px solid #7c3aed',
                borderRadius: 8,
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                transform: 'translateY(0)',
                boxShadow: '0 2px 8px rgba(124, 58, 237, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#6d28d9';
                e.target.style.borderColor = '#6d28d9';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 4px 16px rgba(124, 58, 237, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#7c3aed';
                e.target.style.borderColor = '#7c3aed';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 2px 8px rgba(124, 58, 237, 0.2)';
              }}
              onClick={saveEditModal}
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextEditorModal; 