import React from 'react';

/**
 * LoadingSpinner component based on Uiverse.io by Nawsome
 * @param {Object} props
 * @param {string} [props.label] - Optional text to display below the spinner
 * @param {boolean} [props.small] - If true, renders a smaller version of the spinner
 * @param {string} [props.className] - Additional class names for the container
 */
const LoadingSpinner = ({ label, small, className = '' }) => {
  return (
    <div className={`loading-overlay ${className}`}>
      <svg 
        className={`pl ${small ? 'pl--sm' : ''}`} 
        width={small ? "120" : "240"} 
        height={small ? "120" : "240"} 
        viewBox="0 0 240 240"
      >
        <circle 
          className="pl__ring pl__ring--a" 
          cx="120" cy="120" r="105" 
          fill="none" stroke="#000" strokeWidth="20" 
          strokeDasharray="0 660" strokeDashoffset="-330" 
          strokeLinecap="round"
        ></circle>
        <circle 
          className="pl__ring pl__ring--b" 
          cx="120" cy="120" r="35" 
          fill="none" stroke="#000" strokeWidth="20" 
          strokeDasharray="0 220" strokeDashoffset="-110" 
          strokeLinecap="round"
        ></circle>
        <circle 
          className="pl__ring pl__ring--c" 
          cx="85" cy="120" r="70" 
          fill="none" stroke="#000" strokeWidth="20" 
          strokeDasharray="0 440" 
          strokeLinecap="round"
        ></circle>
        <circle 
          className="pl__ring pl__ring--d" 
          cx="155" cy="120" r="70" 
          fill="none" stroke="#000" strokeWidth="20" 
          strokeDasharray="0 440" 
          strokeLinecap="round"
        ></circle>
      </svg>
      {label && <div className="loading-label">{label}</div>}
    </div>
  );
};

export default LoadingSpinner;
