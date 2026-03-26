import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Clock, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';

const ModernDateTimePicker = ({
  value,
  onChange,
  type = 'datetime-local', // 'datetime-local', 'date', or 'time'
  placeholder = "Select...",
  label = "",
  className = "",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempDate, setTempDate] = useState(null);
  const [tempTime, setTempTime] = useState(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const [openUp, setOpenUp] = useState(false);
  
  const containerRef = useRef(null);
  const pickerRef = useRef(null);

  // Initialize temp values from value prop
  useEffect(() => {
    if (value) {
      if (type === 'datetime-local') {
        const [d, t] = value.split('T');
        setTempDate(d);
        setTempTime(t?.substring(0, 5) || '00:00');
      } else if (type === 'date') {
        setTempDate(value);
      } else if (type === 'time') {
        setTempTime(value.substring(0, 5));
      }
    } else {
      const now = new Date();
      if (!tempDate) setTempDate(now.toISOString().split('T')[0]);
      if (!tempTime) setTempTime(now.toTimeString().substring(0, 5));
    }
  }, [value, type, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target) &&
          pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const pickerHeight = 400; // Estimated height
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const shouldOpenUp = spaceBelow < 340 && spaceAbove > spaceBelow;
      setOpenUp(shouldOpenUp);
      
      setCoords({
        top: rect.top + (shouldOpenUp ? -4 : rect.height + 4) + window.scrollY,
        left: rect.left + window.scrollX,
        width: Math.max(280, rect.width)
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleScroll = () => {
      if (isOpen) setIsOpen(false);
    };
    
    if (isOpen) {
      window.addEventListener('scroll', handleScroll, true);
    }
    
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const handleOk = () => {
    let newValue = "";
    if (type === 'datetime-local') {
      newValue = `${tempDate}T${tempTime}`;
    } else if (type === 'date') {
      newValue = tempDate;
    } else if (type === 'time') {
      newValue = tempTime;
    }
    onChange({ target: { value: newValue } });
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange({ target: { value: "" } });
    setIsOpen(false);
  };

  const formattedDisplay = () => {
    if (!value) return placeholder;
    try {
      if (type === 'datetime-local') {
        const [d, t] = value.split('T');
        return `${d} ${t || ''}`;
      }
      return value;
    } catch (e) {
      return value;
    }
  };

  const pickerMenu = (
    <div
      ref={pickerRef}
      className={`modern-date-picker-dropdown glass-card ${openUp ? 'open-up' : ''}`}
      style={{
        position: 'absolute',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${coords.width}px`,
        zIndex: 9999
      }}
    >
      <div className="modern-date-picker-header">
        <span className="modern-date-picker-title">
          {type === 'datetime-local' ? 'Select Date & Time' : type === 'date' ? 'Select Date' : 'Select Time'}
        </span>
        <button className="modern-date-picker-close-btn" onClick={() => setIsOpen(false)}>
          <X size={16} />
        </button>
      </div>

      <div className="modern-date-picker-body">
        {(type === 'datetime-local' || type === 'date') && (
          <div className="modern-date-picker-section">
            <label className="modern-date-picker-section-label"><Calendar size={14} /> Date</label>
            <input 
              type="date" 
              value={tempDate || ''} 
              onChange={(e) => setTempDate(e.target.value)}
              className="modern-date-picker-input"
            />
          </div>
        )}

        {(type === 'datetime-local' || type === 'time') && (
          <div className="modern-date-picker-section">
            <label className="modern-date-picker-section-label"><Clock size={14} /> Time</label>
            <input 
              type="time" 
              value={tempTime || ''} 
              onChange={(e) => setTempTime(e.target.value)}
              className="modern-date-picker-input"
            />
          </div>
        )}
      </div>

      <div className="modern-date-picker-footer">
        <button className="modern-date-picker-btn-secondary" onClick={() => setIsOpen(false)}>
          Cancel
        </button>
        <button className="modern-date-picker-btn-primary" onClick={handleOk}>
          <Check size={16} />
          OK
        </button>
      </div>
    </div>
  );

  return (
    <div className={`modern-date-picker-container ${className} ${disabled ? 'disabled' : ''}`} ref={containerRef}>
      {label && <label className="modern-date-picker-label">{label}</label>}
      <div
        className={`modern-date-picker-display ${isOpen ? 'active' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="modern-date-picker-value-container">
          <Calendar size={14} className="calendar-icon" />
          <span className={!value ? 'placeholder' : ''}>
            {formattedDisplay()}
          </span>
          {value && !disabled && (
            <button
              type="button"
              className="modern-date-picker-clear-btn"
              onClick={handleClear}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {isOpen && createPortal(pickerMenu, document.body)}
    </div>
  );
};

export default ModernDateTimePicker;
