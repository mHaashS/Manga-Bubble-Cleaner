// Fonction utilitaire pour word wrap sur le canvas
export function wrapText(ctx, text, x, y, maxWidth, lineHeight, color, font, align = 'center') {
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

// Vérifie si un point est dans un polygone
export const isPointInPolygon = (x, y, polygon) => {
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

// Fonction intelligente pour calculer la taille de police
export const calculateSmartFontSize = (text, bubble) => {
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
  
  return finalSize;
}; 