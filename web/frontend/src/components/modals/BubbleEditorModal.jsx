import React, { useState, useEffect, useRef } from 'react';
import { getBubblePolygons, retreatWithPolygons } from '../../services/api';
import { isPointInPolygon } from '../../utils/canvasUtils';
import { base64ToBlob } from '../../utils/fileUtils';

const BubbleEditorModal = ({ isOpen, imageIndex, images, onClose, onSave }) => {
  // === ÉTATS ===
  const [bubblePolygons, setBubblePolygons] = useState([]);
  const [selectedPolygon, setSelectedPolygon] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({x: 0, y: 0});
  const [dragType, setDragType] = useState(null); // 'polygon' ou 'point'
  const [dragPolygonIndex, setDragPolygonIndex] = useState(null);
  const [dragPointIndex, setDragPointIndex] = useState(null);
  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [bubbleEditorCanvas, setBubbleEditorCanvas] = useState(null);
  const [isRetreating, setIsRetreating] = useState(false);
  
  const bubbleCanvasRef = useRef(null);

  // === INITIALISATION ===
  useEffect(() => {
    if (isOpen && imageIndex !== null && images[imageIndex]) {
      const img = images[imageIndex];
      setSelectedPolygon(null);
      setOriginalImageUrl(URL.createObjectURL(img.file));
      
      // Charger l'image originale pour obtenir ses dimensions
      const imgElement = new Image();
      imgElement.onload = () => {
        setBubbleEditorCanvas({
          width: imgElement.width,
          height: imgElement.height
        });
        
        // Initialiser le canvas immédiatement avec la bonne taille
        if (bubbleCanvasRef.current) {
          const canvas = bubbleCanvasRef.current;
          const ctx = canvas.getContext('2d');
          canvas.width = imgElement.width;
          canvas.height = imgElement.height;
          
          // Dessiner l'image immédiatement
          ctx.drawImage(imgElement, 0, 0);
        }
      };
      imgElement.src = URL.createObjectURL(img.file);
      
      // Récupérer les polygones de bulles depuis le backend
      loadBubblePolygons(img.file);
    }
  }, [isOpen, imageIndex, images]);

  // === FONCTIONS ===
  const loadBubblePolygons = async (file) => {
    try {
      const data = await getBubblePolygons(file);
      setBubblePolygons(data.polygons || []);
      
      // Redessiner avec les polygones une fois qu'ils sont chargés
      setTimeout(() => {
        drawBubbleEditor();
      }, 50);
    } catch (error) {
      console.error("Erreur lors du chargement des polygones:", error);
      alert("Erreur lors du chargement des polygones de bulles");
      onClose();
    }
  };

  const drawBubbleEditor = () => {
    if (!bubbleCanvasRef.current || !originalImageUrl) return;
    
    const canvas = bubbleCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Charger l'image originale
    const img = new Image();
    img.onload = () => {
      // S'assurer que le canvas a la bonne taille
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      
      // Dessiner l'image de base
      ctx.drawImage(img, 0, 0);
      
      // Dessiner les polygones
      bubblePolygons.forEach((polygon, index) => {
        const isSelected = selectedPolygon === index;
        
        // Dessiner le polygone
        ctx.beginPath();
        ctx.moveTo(polygon.polygon[0][0], polygon.polygon[0][1]);
        for (let i = 1; i < polygon.polygon.length; i++) {
          ctx.lineTo(polygon.polygon[i][0], polygon.polygon[i][1]);
        }
        ctx.closePath();
        
        // Style du polygone
        ctx.strokeStyle = isSelected ? '#ff6b6b' : '#4ecdc4';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.stroke();
        
        // Remplissage semi-transparent
        ctx.fillStyle = isSelected ? 'rgba(255, 107, 107, 0.2)' : 'rgba(78, 205, 196, 0.1)';
        ctx.fill();
        
        // Dessiner les points de contrôle (plus gros)
        polygon.polygon.forEach((point, pointIndex) => {
          ctx.beginPath();
          ctx.arc(point[0], point[1], isSelected ? 10 : 8, 0, 2 * Math.PI);
          ctx.fillStyle = isSelected ? '#ff6b6b' : '#4ecdc4';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      });
    };
    img.src = originalImageUrl;
  };

  const handleBubbleEditorClick = (event) => {
    if (!bubbleCanvasRef.current) return;
    
    const canvas = bubbleCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    // Vérifier si on clique sur un point de contrôle (zone plus grande)
    let clickedPolygon = null;
    let clickedPoint = null;
    
    for (let i = 0; i < bubblePolygons.length; i++) {
      const polygon = bubblePolygons[i];
      for (let j = 0; j < polygon.polygon.length; j++) {
        const point = polygon.polygon[j];
        const distance = Math.sqrt((x - point[0])**2 + (y - point[1])**2);
        if (distance <= 15) { // Zone de clic plus grande
          clickedPolygon = i;
          clickedPoint = j;
          break;
        }
      }
      if (clickedPolygon !== null) break;
    }
    
    // Si pas de point cliqué, vérifier si on clique dans un polygone
    if (clickedPolygon === null) {
      for (let i = 0; i < bubblePolygons.length; i++) {
        const polygon = bubblePolygons[i];
        if (isPointInPolygon(x, y, polygon.polygon)) {
          clickedPolygon = i;
          break;
        }
      }
    }
    
    setSelectedPolygon(clickedPolygon);
    drawBubbleEditor();
  };

  const handleBubbleEditorMouseDown = (event) => {
    if (!bubbleCanvasRef.current) return;
    
    const canvas = bubbleCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    // Vérifier si on clique sur un point de contrôle
    let clickedPolygon = null;
    let clickedPoint = null;
    
    for (let i = 0; i < bubblePolygons.length; i++) {
      const polygon = bubblePolygons[i];
      for (let j = 0; j < polygon.polygon.length; j++) {
        const point = polygon.polygon[j];
        const distance = Math.sqrt((x - point[0])**2 + (y - point[1])**2);
        if (distance <= 15) {
          clickedPolygon = i;
          clickedPoint = j;
          break;
        }
      }
      if (clickedPolygon !== null) break;
    }
    
    // Si pas de point cliqué, vérifier si on clique dans un polygone
    if (clickedPolygon === null) {
      for (let i = 0; i < bubblePolygons.length; i++) {
        const polygon = bubblePolygons[i];
        if (isPointInPolygon(x, y, polygon.polygon)) {
          clickedPolygon = i;
          break;
        }
      }
    }
    
    if (clickedPolygon !== null) {
      setSelectedPolygon(clickedPolygon);
      setIsDragging(true);
      setDragStart({x, y});
      
      if (clickedPoint !== null) {
        // Drag d'un point de contrôle
        setDragType('point');
        setDragPolygonIndex(clickedPolygon);
        setDragPointIndex(clickedPoint);
      } else {
        // Drag de toute la bulle
        setDragType('polygon');
        setDragPolygonIndex(clickedPolygon);
      }
    }
  };

  const handleBubbleEditorMouseMove = (event) => {
    if (!isDragging || !bubbleCanvasRef.current) return;
    
    const canvas = bubbleCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    const deltaX = x - dragStart.x;
    const deltaY = y - dragStart.y;
    
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      const newPolygons = [...bubblePolygons];
      
      if (dragType === 'point' && dragPolygonIndex !== null && dragPointIndex !== null) {
        // Déplacer un point de contrôle
        newPolygons[dragPolygonIndex].polygon[dragPointIndex][0] += deltaX;
        newPolygons[dragPolygonIndex].polygon[dragPointIndex][1] += deltaY;
      } else if (dragType === 'polygon' && dragPolygonIndex !== null) {
        // Déplacer toute la bulle
        newPolygons[dragPolygonIndex].polygon.forEach(point => {
          point[0] += deltaX;
          point[1] += deltaY;
        });
      }
      
      setBubblePolygons(newPolygons);
      setDragStart({x, y});
      drawBubbleEditor();
    }
  };

  const handleBubbleEditorMouseUp = () => {
    setIsDragging(false);
    setDragType(null);
    setDragPolygonIndex(null);
    setDragPointIndex(null);
  };

  const deleteSelectedBubble = () => {
    if (selectedPolygon !== null) {
      const newPolygons = bubblePolygons.filter((_, index) => index !== selectedPolygon);
      setBubblePolygons(newPolygons);
      setSelectedPolygon(null);
      drawBubbleEditor();
    }
  };

  const addNewBubble = () => {
    if (!bubbleEditorCanvas) return;
    
    // Créer un polygone octogonal (8 sommets) au centre du canvas
    const centerX = bubbleEditorCanvas.width / 2;
    const centerY = bubbleEditorCanvas.height / 2;
    const radius = Math.min(bubbleEditorCanvas.width, bubbleEditorCanvas.height) * 0.15; // 15% de la plus petite dimension
    
    // Générer les 8 points d'un octogone
    const points = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      points.push([x, y]);
    }
    
    // Créer la nouvelle bulle
    const newBubble = {
      polygon: points,
      class: 0, // Bulle par défaut
      confidence: 0.9, // Confiance élevée pour une bulle manuelle
      ocr_text: '', // Texte vide
      translated_text: '', // Texte traduit vide
      x_min: Math.min(...points.map(p => p[0])),
      y_min: Math.min(...points.map(p => p[1])),
      x_max: Math.max(...points.map(p => p[0])),
      y_max: Math.max(...points.map(p => p[1]))
    };
    
    // Ajouter la nouvelle bulle à la liste
    const newPolygons = [...bubblePolygons, newBubble];
    setBubblePolygons(newPolygons);
    
    // Sélectionner automatiquement la nouvelle bulle
    setSelectedPolygon(newPolygons.length - 1);
  };

  const retreatWithPolygonsAction = async () => {
    if (imageIndex === null) return;
    
    setIsRetreating(true);
    
    try {
      const data = await retreatWithPolygons(images[imageIndex].file, bubblePolygons);
      
      // Mettre à jour l'image dans la grille
      const newImages = [...images];
      const finalImageUrl = `data:image/png;base64,${data.image_base64}`;
      const cleanedImageUrl = `data:image/png;base64,${data.cleaned_base64}`;
      
      // Normaliser la structure des bulles pour qu'elles soient compatibles avec l'éditeur de texte
      const normalizedBubbles = (data.bubbles || []).map(bubble => ({
        ...bubble,
        translatedText: bubble.translated_text || bubble.translatedText || '',
        ocrText: bubble.ocr_text || bubble.ocrText || '',
        text: bubble.translated_text || bubble.translatedText || '', // Pour compatibilité
        fontSize: 14 // Forcer la taille de police à 14 par défaut
      }));
      
      newImages[imageIndex].result = { url: finalImageUrl, blob: null };
      newImages[imageIndex].bubbles = normalizedBubbles;
      newImages[imageIndex].previewUrl = finalImageUrl;
      // IMPORTANT: Utiliser l'image nettoyée (sans texte) pour l'éditeur de texte
      newImages[imageIndex].cleanedUrl = cleanedImageUrl;
      
      // Créer le blob pour l'image nettoyée (sans texte) - utilisé par l'éditeur de texte
      newImages[imageIndex].cleanedBlob = base64ToBlob(data.cleaned_base64);
      
      // Créer le blob pour le téléchargement (utiliser l'image finale avec texte)
      newImages[imageIndex].result.blob = base64ToBlob(data.image_base64);
      
      onSave(newImages);
      onClose();
      
    } catch (error) {
      console.error("Erreur lors du retraitement:", error);
      alert("Erreur lors du retraitement de l'image");
    } finally {
      setIsRetreating(false);
    }
  };

  // === EFFET POUR REDESSINER ===
  useEffect(() => {
    if (isOpen && bubblePolygons.length > 0) {
      drawBubbleEditor();
    }
  }, [isOpen, bubblePolygons, selectedPolygon]);

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
        padding: 0,
        position: 'relative'
      }}>
        {/* Overlay de chargement */}
        {isRetreating && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            borderRadius: '12px'
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              padding: '24px 32px',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid #10b981',
                borderTop: '3px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <div style={{
                color: '#1f2937',
                fontSize: '16px',
                fontWeight: '600'
              }}>
                Retraitement en cours...
              </div>
              <div style={{
                color: '#6b7280',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                Veuillez patienter pendant que l'image est retraitée avec les modifications des bulles.
              </div>
            </div>
          </div>
        )}
        
        <button className="modal-close" onClick={onClose}>✕</button>
        
        {/* Zone d'édition à gauche */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 0,
          minHeight: 0,
          height: '100%',
          overflow: 'auto',
          padding: '20px'
        }}>
          <div style={{
            marginBottom: 16,
            color: '#6366f1',
            fontWeight: 600,
            fontSize: 18
          }}>
            Éditeur de bulles - {bubblePolygons.length} bulle{bubblePolygons.length > 1 ? 's' : ''} détectée{bubblePolygons.length > 1 ? 's' : ''}
          </div>
          
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <canvas
              ref={bubbleCanvasRef}
              onClick={handleBubbleEditorClick}
              onMouseDown={handleBubbleEditorMouseDown}
              onMouseMove={handleBubbleEditorMouseMove}
              onMouseUp={handleBubbleEditorMouseUp}
              onMouseLeave={handleBubbleEditorMouseUp}
              style={{
                maxWidth: 'calc(95vw - 420px)',
                maxHeight: '70vh',
                minWidth: '400px',
                minHeight: '300px',
                width: 'auto',
                height: 'auto',
                borderRadius: 12,
                border: '2px solid #a78bfa',
                background: '#f8fafc',
                boxShadow: '0 4px 24px 0 rgba(124,58,237,0.12)',
                display: 'block',
                margin: '0 auto',
                cursor: isDragging ? 'grabbing' : 'pointer'
              }}
            />
            {!originalImageUrl && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                color: '#6b7280'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  border: '2px solid #a78bfa',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span style={{ fontSize: '14px' }}>Chargement de l'image...</span>
              </div>
            )}
          </div>
          
          <div style={{
            marginTop: 16,
            color: '#7c3aed',
            fontSize: 14,
            textAlign: 'center',
            maxWidth: 600
          }}>
            💡 Cliquez sur une bulle pour la sélectionner • Glissez-déposez les bulles entières • Glissez-déposez les points pour les redimensionner • Utilisez les boutons à droite pour modifier
          </div>
          <div style={{
            marginTop: 8,
            color: '#6b7280',
            fontSize: 12,
            textAlign: 'center',
            maxWidth: 600
          }}>
            ⌨️ Raccourcis : <strong>Suppr</strong> pour supprimer • <strong>Ins</strong> pour ajouter
          </div>
        </div>
        
        {/* Zone de contrôle à droite */}
        <div style={{
          width: 380,
          minWidth: 350,
          maxWidth: 420,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflowY: 'auto',
          background: 'rgba(248, 250, 252, 0.97)',
          borderLeft: '1px solid rgba(124, 58, 237, 0.2)',
          padding: '20px 16px 16px 16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            color: '#6366f1',
            fontWeight: 600,
            fontSize: 16,
            marginBottom: 8
          }}>
            Actions
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            <button 
              style={{
                padding: '12px 16px',
                fontSize: 15,
                fontWeight: 500,
                backgroundColor: isRetreating ? '#6b7280' : '#10b981',
                color: '#ffffff',
                border: `1.5px solid ${isRetreating ? '#6b7280' : '#10b981'}`,
                borderRadius: 8,
                transition: 'all 0.3s ease',
                cursor: isRetreating ? 'not-allowed' : 'pointer',
                transform: 'translateY(0)',
                boxShadow: isRetreating ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.2)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (!isRetreating) {
                  e.target.style.backgroundColor = '#059669';
                  e.target.style.borderColor = '#059669';
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isRetreating) {
                  e.target.style.backgroundColor = '#10b981';
                  e.target.style.borderColor = '#10b981';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.2)';
                }
              }}
              onClick={isRetreating ? undefined : retreatWithPolygonsAction}
              disabled={isRetreating}
            >
              {isRetreating ? (
                <>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1
                  }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid #ffffff',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                  </div>
                  <span style={{ opacity: 0.7 }}>⏳ Retraitement en cours...</span>
                </>
              ) : (
                '🔄 Retraiter avec les bulles modifiées'
              )}
            </button>
            
            <button 
              style={{
                padding: '12px 16px',
                fontSize: 15,
                fontWeight: 500,
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                border: '1.5px solid #3b82f6',
                borderRadius: 8,
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                transform: 'translateY(0)',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#2563eb';
                e.target.style.borderColor = '#2563eb';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#3b82f6';
                e.target.style.borderColor = '#3b82f6';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.2)';
              }}
              onClick={addNewBubble}
            >
              ➕ Ajouter une bulle
            </button>
            
            <button 
              style={{
                padding: '12px 16px',
                fontSize: 15,
                fontWeight: 500,
                backgroundColor: selectedPolygon === null ? '#6b7280' : '#ef4444',
                color: '#ffffff',
                border: `1.5px solid ${selectedPolygon === null ? '#6b7280' : '#ef4444'}`,
                borderRadius: 8,
                transition: 'all 0.3s ease',
                cursor: selectedPolygon === null ? 'not-allowed' : 'pointer',
                transform: 'translateY(0)',
                boxShadow: selectedPolygon === null ? 'none' : '0 2px 8px rgba(239, 68, 68, 0.2)'
              }}
              onMouseEnter={(e) => {
                if (selectedPolygon !== null) {
                  e.target.style.backgroundColor = '#dc2626';
                  e.target.style.borderColor = '#dc2626';
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 4px 16px rgba(239, 68, 68, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedPolygon !== null) {
                  e.target.style.backgroundColor = '#ef4444';
                  e.target.style.borderColor = '#ef4444';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.2)';
                }
              }}
              onClick={selectedPolygon === null ? undefined : deleteSelectedBubble}
              disabled={selectedPolygon === null}
            >
              🗑️ Supprimer la bulle sélectionnée
            </button>
          </div>
          
          {selectedPolygon !== null && (
            <div style={{
              marginTop: 20,
              padding: 16,
              backgroundColor: 'rgba(124, 58, 237, 0.05)',
              borderRadius: 8,
              border: '1px solid rgba(124, 58, 237, 0.2)'
            }}>
              <div style={{
                color: '#7c3aed',
                fontWeight: 600,
                fontSize: 14,
                marginBottom: 8
              }}>
                Bulle sélectionnée #{selectedPolygon + 1}
              </div>
              <div style={{
                color: '#6b7280',
                fontSize: 12
              }}>
                Classe: {bubblePolygons[selectedPolygon]?.class === 0 ? 'Bulles' : 
                         bubblePolygons[selectedPolygon]?.class === 1 ? 'Texte flottant' : 'Narration'}
              </div>
              <div style={{
                color: '#6b7280',
                fontSize: 12
              }}>
                Confiance: {(bubblePolygons[selectedPolygon]?.confidence * 100).toFixed(1)}%
              </div>
            </div>
          )}
          
          <div style={{
            marginTop: 'auto',
            display: 'flex',
            gap: 12
          }}>
            <button 
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: 15,
                fontWeight: 500,
                borderColor: '#6b7280',
                color: '#6b7280',
                backgroundColor: 'transparent',
                border: '1.5px solid #6b7280',
                borderRadius: 8,
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#4b5563';
                e.target.style.color = '#ffffff';
                e.target.style.borderColor = '#4b5563';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = '#6b7280';
                e.target.style.borderColor = '#6b7280';
              }}
              onClick={onClose}
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BubbleEditorModal; 