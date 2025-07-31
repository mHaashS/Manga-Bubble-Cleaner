import React from 'react';

const ProgressBar = ({ current, total, status }) => {
  const progress = total === 0 ? 0 : (current / total) * 100;
  
  return (
    <div className="progress-bar-container">
      <div className="progress-bar-bg">
        <div className="progress-bar-fg" style={{ width: `${progress}%` }}></div>
      </div>
      <div className="progress-bar-label">
        {current} / {total} images traitées
      </div>
    </div>
  );
};

export default ProgressBar; 