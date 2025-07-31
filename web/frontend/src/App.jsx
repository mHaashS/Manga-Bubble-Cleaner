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
  
  // Nouveaux états pour l'éditeur de bulles
  const [bubbleEditorOpen, setBubbleEditorOpen] = useState(false);
  const [bubbleEditorIdx, setBubbleEditorIdx] = useState(null);
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
  
  const canvasRef = useRef(null);
  const bubbleCanvasRef = useRef(null);

  // Appliquer le mode dark/light au body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // Redessiner le canvas quand les polygones changent
  useEffect(() => {
    if (bubbleEditorOpen && bubblePolygons.length > 0) {
      drawBubbleEditor();
    }
  }, [bubblePolygons, selectedPolygon, bubbleEditorOpen]);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    const allFiles = [...files];
    const allImages = [...images];
    selected.forEach(file => {
      // Vérification plus robuste : nom, taille et dernière modification
      const alreadyExists = allFiles.some(f => 
        f.name === file.name && 
        f.size === file.size && 
        f.lastModified === file.lastModified
      );
      if (!alreadyExists) {
        allFiles.push(file);
        allImages.push({ file, status: 'en attente', result: null, error: null });
      }
    });
    setFiles(allFiles);
    setImages(allImages);
    setGlobalError("");
    // Réinitialiser l'input pour permettre la sélection du même fichier
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = Array.from(e.dataTransfer.files);
      const allFiles = [...files];
      const allImages = [...images];
      selected.forEach(file => {
        // Vérification plus robuste : nom, taille et dernière modification
        const alreadyExists = allFiles.some(f => 
          f.name === file.name && 
          f.size === file.size && 
          f.lastModified === file.lastModified
        );
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
    
    // S'assurer que toutes les bulles ont une taille de police valide (14 par défaut)
    const normalizedBubbles = bubbles.map(bubble => ({
      ...bubble,
      fontSize: bubble.fontSize || 14
    }));
    
    setEditBubbles(normalizedBubbles);
    
    // Utiliser la bonne image : cleanedUrl si disponible, sinon result.url
    const imageToUse = img.cleanedUrl || img.result.url;
    setEditImageUrl(imageToUse);
    setEditCleanedUrl(img.cleanedUrl || null);
    setEditImageSize({width: img.width, height: img.height});
    setEditModalOpen(true);
    setInitialAdjustmentDone(false);
    
    // Ajuster automatiquement toutes les tailles de police à la première ouverture
    setTimeout(() => {
      if (!initialAdjustmentDone) {
        normalizedBubbles.forEach((_, index) => autoAdjustFontSize(index));
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
        
        // Vérifier que nous avons bien l'image nettoyée avec les bulles modifiées
        if (!cleanedBlob) {
          console.error("Aucun blob d'image nettoyée disponible");
          console.log("État de l'image:", {
            hasCleanedBlob: !!newImages[editIdx].cleanedBlob,
            hasCleanedUrl: !!newImages[editIdx].cleanedUrl,
            hasResultUrl: !!newImages[editIdx].result?.url
          });
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
    // Gérer les cas où text est undefined, null ou pas une string
    if (!text || typeof text !== 'string') {
      text = '';
    }
    
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
          const fontSize = bulle.fontSize || 14;
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
          const fontSize = bulle.fontSize || 14;
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

  // Redessiner l'éditeur de bulles quand les polygones changent
  useEffect(() => {
    if (bubbleEditorOpen && bubblePolygons.length > 0) {
      drawBubbleEditor();
    }
  }, [bubbleEditorOpen, bubblePolygons, selectedPolygon]);



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

  // === FONCTIONS POUR L'ÉDITEUR DE BULLES ===
  
  // Ouvre l'éditeur de bulles
  const openBubbleEditor = async (img, idx) => {
    setBubbleEditorIdx(idx);
    setBubbleEditorOpen(true);
    setSelectedPolygon(null);
    setOriginalImageUrl(URL.createObjectURL(img.file));
    
    try {
      // Charger l'image originale en premier pour obtenir ses dimensions
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
      const formData = new FormData();
      formData.append("file", img.file);
      
      const response = await fetch("http://localhost:8000/get-bubble-polygons", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      setBubblePolygons(data.polygons || []);
      
      // Redessiner avec les polygones une fois qu'ils sont chargés
      setTimeout(() => {
        drawBubbleEditor();
      }, 50);
      
    } catch (error) {
      console.error("Erreur lors du chargement des polygones:", error);
      alert("Erreur lors du chargement des polygones de bulles");
      setBubbleEditorOpen(false);
    }
  };

  // Ferme l'éditeur de bulles
  const closeBubbleEditor = () => {
    setBubbleEditorOpen(false);
    setBubbleEditorIdx(null);
    setBubblePolygons([]);
    setSelectedPolygon(null);
    setOriginalImageUrl(null);
    setBubbleEditorCanvas(null);
  };

  // Dessine l'éditeur de bulles
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

  // Gère le clic sur le canvas de l'éditeur
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

  // Vérifie si un point est dans un polygone
  const isPointInPolygon = (x, y, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  };

  // Gère le début du drag sur le canvas
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

  // Gère le mouvement de la souris pendant le drag
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

  // Gère la fin du drag
  const handleBubbleEditorMouseUp = () => {
    setIsDragging(false);
    setDragType(null);
    setDragPolygonIndex(null);
    setDragPointIndex(null);
  };

  // Supprime une bulle sélectionnée
  const deleteSelectedBubble = () => {
    if (selectedPolygon !== null) {
      const newPolygons = bubblePolygons.filter((_, index) => index !== selectedPolygon);
      setBubblePolygons(newPolygons);
      setSelectedPolygon(null);
      drawBubbleEditor();
    }
  };

  // Ajoute une nouvelle bulle
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

  // Retraite l'image avec les polygones modifiés
  const retreatWithPolygons = async () => {
    if (bubbleEditorIdx === null) return;
    
    setIsRetreating(true);
    
    try {
      const formData = new FormData();
      formData.append("file", images[bubbleEditorIdx].file);
      formData.append("polygons", JSON.stringify(bubblePolygons));
      
      const response = await fetch("http://localhost:8000/retreat-with-polygons", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
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
      
      newImages[bubbleEditorIdx].result = { url: finalImageUrl, blob: null };
      newImages[bubbleEditorIdx].bubbles = normalizedBubbles;
      newImages[bubbleEditorIdx].previewUrl = finalImageUrl;
      // IMPORTANT: Utiliser l'image nettoyée (sans texte) pour l'éditeur de texte
      newImages[bubbleEditorIdx].cleanedUrl = cleanedImageUrl;
      
      // Créer le blob pour l'image nettoyée (sans texte) - utilisé par l'éditeur de texte
      const cleanedBytes = atob(data.cleaned_base64);
      const cleanedArray = new Uint8Array(cleanedBytes.length);
      for (let j = 0; j < cleanedBytes.length; j++) {
        cleanedArray[j] = cleanedBytes.charCodeAt(j);
      }
      newImages[bubbleEditorIdx].cleanedBlob = new Blob([cleanedArray], { type: 'image/png' });
      
      // Créer le blob pour le téléchargement (utiliser l'image finale avec texte)
      const finalBytes = atob(data.image_base64);
      const finalArray = new Uint8Array(finalBytes.length);
      for (let j = 0; j < finalBytes.length; j++) {
        finalArray[j] = finalBytes.charCodeAt(j);
      }
      newImages[bubbleEditorIdx].result.blob = new Blob([finalArray], { type: 'image/png' });
      
      setImages(newImages);
      closeBubbleEditor();
      
    } catch (error) {
      console.error("Erreur lors du retraitement:", error);
      alert("Erreur lors du retraitement de l'image");
    } finally {
      setIsRetreating(false);
    }
  };

  // Fonction intelligente pour calculer la taille de police
  const calculateSmartFontSize = (text, bubble) => {
    if (!text || !text.trim()) return 14;
    
    const bubbleWidth = bubble.x_max - bubble.x_min;
    const bubbleHeight = bubble.y_max - bubble.y_min;
    
    // Calculer la longueur du texte
    const textLength = text.length;
    
    // Base de calcul selon la longueur du texte
    let baseSize = 14; // Taille de base réduite pour plus de sécurité
    
    if (textLength <= 10) {
      baseSize = 18; // Texte court = police plus grande
    } else if (textLength <= 20) {
      baseSize = 16; // Texte moyen
    } else if (textLength <= 30) {
      baseSize = 14; // Texte long
    } else if (textLength <= 50) {
      baseSize = 12; // Très long texte
    } else {
      baseSize = 10; // Texte très long
    }
    
    // Calculer le facteur basé sur les dimensions de la bulle
    // Plus la bulle est grande, plus on peut utiliser une grande police
    const minDimension = Math.min(bubbleWidth, bubbleHeight);
    
    // Facteur basé sur la plus petite dimension avec une marge de sécurité
    let dimensionFactor = (minDimension * 0.7) / 50; // 70% de la dimension pour laisser une marge
    
    // Ajuster selon le ratio largeur/hauteur
    const ratio = bubbleWidth / bubbleHeight;
    if (ratio > 2) {
      // Bulle très large, réduire un peu
      dimensionFactor *= 0.7;
    } else if (ratio < 0.5) {
      // Bulle très haute, réduire un peu
      dimensionFactor *= 0.7;
    }
    
    let finalSize = Math.round(baseSize * dimensionFactor);
    
    // Limites de sécurité plus strictes
    finalSize = Math.max(8, Math.min(24, finalSize));
    
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
                           className="btn-outline btn-outline-sm btn-edit" 
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
                   maxWidth: 'calc(95vw - 620px)',
                   maxHeight: '85vh',
                   width: 'auto',
                   height: 'auto',
                   borderRadius: 12,
                   border: '2px solid #a78bfa',
                   background: darkMode ? '#fff' : '#f8fafc',
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
                                 background: darkMode ? 'rgba(24, 28, 42, 0.97)' : 'rgba(248, 250, 252, 0.97)',
                borderLeft: darkMode ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(124, 58, 237, 0.2)',
                padding: '20px 16px 16px 16px',
                boxSizing: 'border-box'
              }}>
              <div style={{marginBottom: 8, color: darkMode ? '#a78bfa' : '#6366f1', fontWeight: 600}}>
                Bulle {currentBubbleIdx + 1} / {editBubbles.length}
              </div>
              <div style={{marginBottom: 12, color: darkMode ? '#c4b5fd' : '#7c3aed', fontSize: 13, fontStyle: 'italic'}}>
                💡 Cliquez sur une bulle dans l'image pour la sélectionner
              </div>
              <div style={{marginBottom: 8, color: darkMode ? '#d1d5db' : '#888', fontSize: 14}}>
                <b>Texte original :</b><br/>{editBubbles[currentBubbleIdx]?.ocrText || <i>(vide)</i>}
              </div>
              <div style={{marginBottom: 8, color: darkMode ? '#a78bfa' : '#7c3aed', fontWeight: 500, fontSize: 15}}>
                <b>Texte traduit :</b>
              </div>
              <textarea
                className="edit-textarea"
                value={editBubbles[currentBubbleIdx]?.translatedText || ""}
                onChange={e => handleBubbleTextChange(e.target.value)}
                rows={6}
                style={{ width: '90%', borderRadius: 8, border: '1.5px solid #a78bfa', padding: 10, fontSize: 16, resize: 'vertical', marginBottom: 8 }}
              />
              <div style={{marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8}}>
                <label style={{color: darkMode ? '#a78bfa' : '#6366f1', fontWeight: 500}}>Taille police :</label>
                <input type="number" min={8} max={80} value={editBubbles[currentBubbleIdx]?.fontSize || 14} onChange={e => handleFontSizeChange(e.target.value)} style={{width: 70, borderRadius: 6, border: '1.5px solid #a78bfa', padding: 4, fontSize: 15}} />
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
                     onClick={closeEditModal}
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
      )}

      {/* Modale d'édition de bulles */}
      {bubbleEditorOpen && (
        <div className="modal-bg" onClick={closeBubbleEditor}>
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
                  backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                  padding: '24px 32px',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px',
                  border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`
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
                    color: darkMode ? '#f9fafb' : '#1f2937',
                    fontSize: '16px',
                    fontWeight: '600'
                  }}>
                    Retraitement en cours...
                  </div>
                  <div style={{
                    color: darkMode ? '#9ca3af' : '#6b7280',
                    fontSize: '14px',
                    textAlign: 'center'
                  }}>
                    Veuillez patienter pendant que l'image est retraitée avec les modifications des bulles.
                  </div>
                </div>
              </div>
            )}
            <button className="modal-close" onClick={closeBubbleEditor}>✕</button>
            
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
                color: darkMode ? '#a78bfa' : '#6366f1',
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
                    background: darkMode ? '#fff' : '#f8fafc',
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
                    color: darkMode ? '#9ca3af' : '#6b7280'
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
                color: darkMode ? '#c4b5fd' : '#7c3aed',
                fontSize: 14,
                textAlign: 'center',
                maxWidth: 600
              }}>
                💡 Cliquez sur une bulle pour la sélectionner • Glissez-déposez les bulles entières • Glissez-déposez les points pour les redimensionner • Utilisez les boutons à droite pour modifier
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
              background: darkMode ? 'rgba(24, 28, 42, 0.97)' : 'rgba(248, 250, 252, 0.97)',
              borderLeft: darkMode ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(124, 58, 237, 0.2)',
              padding: '20px 16px 16px 16px',
              boxSizing: 'border-box'
            }}>
              <div style={{
                color: darkMode ? '#a78bfa' : '#6366f1',
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
                  onClick={isRetreating ? undefined : retreatWithPolygons}
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
                  onClick={deleteSelectedBubble}
                  disabled={selectedPolygon === null}
                >
                  🗑️ Supprimer la bulle sélectionnée
                </button>
              </div>
              
              {selectedPolygon !== null && (
                <div style={{
                  marginTop: 20,
                  padding: 16,
                  backgroundColor: darkMode ? 'rgba(124, 58, 237, 0.1)' : 'rgba(124, 58, 237, 0.05)',
                  borderRadius: 8,
                  border: `1px solid ${darkMode ? 'rgba(124, 58, 237, 0.3)' : 'rgba(124, 58, 237, 0.2)'}`
                }}>
                  <div style={{
                    color: darkMode ? '#a78bfa' : '#7c3aed',
                    fontWeight: 600,
                    fontSize: 14,
                    marginBottom: 8
                  }}>
                    Bulle sélectionnée #{selectedPolygon + 1}
                  </div>
                  <div style={{
                    color: darkMode ? '#d1d5db' : '#6b7280',
                    fontSize: 12
                  }}>
                    Classe: {bubblePolygons[selectedPolygon]?.class === 0 ? 'Bulles' : 
                             bubblePolygons[selectedPolygon]?.class === 1 ? 'Texte flottant' : 'Narration'}
                  </div>
                  <div style={{
                    color: darkMode ? '#d1d5db' : '#6b7280',
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
                  onClick={closeBubbleEditor}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 