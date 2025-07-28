import React, { useState } from "react";
import './App.css';

function App() {
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState([]); // [{file, status, result, error}]
  const [globalError, setGlobalError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImg, setModalImg] = useState(null);

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
          const imageBlob = await res.blob();
          const imageUrl = URL.createObjectURL(imageBlob);
          newImages[i].result = { url: imageUrl, blob: imageBlob };
          newImages[i].status = 'terminée';
          newImages[i].error = null;
        } catch (err) {
          newImages[i].status = 'erreur';
          newImages[i].error = err.message;
          newImages[i].result = null;
        }
        setImages([...newImages]);
      }
    }
    setProcessing(false);
  };

  const handleDownload = (img) => {
    if (!img.result) return;
    const link = document.createElement("a");
    link.href = img.result.url;
    link.download = `image_traitee_${img.file.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  return (
    <div className="app-bg">
      <div className="main-card">
        <h1 className="main-title">Bubble Translate</h1>
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
                          src={img.result.url}
                          alt="Image traitée"
                          onClick={() => openModal(img)}
                        />
                      </div>
                      <div className="image-name-sm">{img.file.name}</div>
                      <button className="btn-outline btn-outline-sm" onClick={() => handleDownload(img)}>
                        ⬇ Télécharger
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
              src={modalImg.result.url}
              alt="Aperçu"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 