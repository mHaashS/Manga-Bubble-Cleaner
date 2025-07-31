import React from 'react';

const ImagePreviewModal = ({ isOpen, image, onClose }) => {
  if (!isOpen || !image) return null;

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <img
          className="modal-image"
          src={image.previewUrl || image.result.url}
          alt="Aperçu"
        />
      </div>
    </div>
  );
};

export default ImagePreviewModal; 