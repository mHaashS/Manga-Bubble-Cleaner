import React from 'react';

const ThemeToggle = ({ darkMode, onToggle }) => {
  return (
    <button 
      className="theme-toggle" 
      onClick={onToggle}
      title={darkMode ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      {darkMode ? "☀️" : "🌙"}
    </button>
  );
};

export default ThemeToggle; 