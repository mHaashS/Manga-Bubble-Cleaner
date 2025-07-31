import { saveAs } from 'file-saver';
import JSZip from 'jszip';

// Validation d'un fichier
export const validateFile = (file) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Type de fichier non supporté. Utilisez JPEG, PNG, GIF ou WebP.');
  }
  
  if (file.size > maxSize) {
    throw new Error('Fichier trop volumineux. Taille maximum : 10MB.');
  }
  
  return true;
};

// Création d'un lien de téléchargement
export const createDownloadLink = (url, filename) => {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Création d'un fichier ZIP
export const createZipFile = async (images) => {
  const zip = new JSZip();
  const folder = zip.folder('images');
  
  for (let img of images) {
    if (img.status === 'terminée' && img.result) {
      let url = img.previewUrl || img.result.url;
      let response = await fetch(url);
      let blob = await response.blob();
      let name = img.file.name.replace(/\.[^.]+$/, '');
      folder.file(`${name}.png`, blob);
    }
  }
  
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'images_bubble_cleaner.zip');
};

// Conversion base64 vers blob
export const base64ToBlob = (base64) => {
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    array[i] = bytes.charCodeAt(i);
  }
  return new Blob([array], { type: 'image/png' });
};

// Création d'un blob depuis une URL
export const urlToBlob = async (url) => {
  const response = await fetch(url);
  return await response.blob();
}; 