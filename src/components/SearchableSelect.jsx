import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Search } from 'lucide-react';

const SearchableSelect = ({
    options = [],
    value,
    onChange,
    placeholder = "Select...",
    className = "",
    disabled = false,
    required = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const [openUp, setOpenUp] = useState(false);
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    const selectedOption = options.find(opt => opt.value === value || opt === value);
    const displayValue = typeof selectedOption === 'object' ? selectedOption.label : selectedOption;

    const filteredOptions = options.filter(option => {
        const label = typeof option === 'object' ? option.label : option;
        return label?.toLowerCase().includes(searchTerm.toLowerCase());
    });

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleScroll = (event) => {
            if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            window.addEventListener("scroll", handleScroll, true);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("scroll", handleScroll, true);
        };
    }, [isOpen]);

    useLayoutEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const dropdownMaxHeight = 260; 
            const spaceBelow = viewportHeight - rect.bottom;
            const spaceAbove = rect.top;

            const shouldOpenUp = spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow;
            setOpenUp(shouldOpenUp);

            setCoords({
                top: (shouldOpenUp ? rect.top : rect.bottom) + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });

            if (inputRef.current) {
                inputRef.current.focus();
            }
        }
    }, [isOpen]);

    const handleToggle = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
            setSearchTerm("");
        }
    };

    const handleSelect = (option) => {
        const val = typeof option === 'object' ? option.value : option;
        onChange({ target: { value: val } });
        setIsOpen(false);
        setSearchTerm("");
    };

    const dropdownMenu = (
        <div
            ref={dropdownRef}
            className={`searchable-select-dropdown portal ${openUp ? 'open-up' : ''}`}
            style={{
                position: 'absolute',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                width: `${coords.width}px`,
            }}
        >
            <div className="searchable-select-options">
                {filteredOptions.length > 0 ? (
                    filteredOptions.map((option, index) => {
                        const label = typeof option === 'object' ? option.label : option;
                        const optValue = typeof option === 'object' ? option.value : option;
                        const isSelected = optValue === value;

                        return (
                            <div
                                key={index}
                                className={`searchable-select-option ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleSelect(option)}
                            >
                                {label}
                            </div>
                        );
                    })
                ) : (
                    <div className="searchable-select-no-results">No results found</div>
                )}
            </div>
        </div>
    );

    return (
        <div className={`searchable-select-container ${className} ${disabled ? 'disabled' : ''}`} ref={containerRef}>
            <div
                className={`searchable-select-display ${isOpen ? 'active' : ''}`}
                onClick={handleToggle}
                tabIndex={disabled || isOpen ? -1 : 0}
            >
                {isOpen ? (
                    <div className="searchable-select-input-container">
                        <Search size={14} className="search-icon-inner" />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Type to search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="searchable-select-inner-input"
                            onClick={(e) => e.stopPropagation()}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                className="searchable-select-clear-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSearchTerm("");
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '4px',
                                    transition: 'color 0.2s ease'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                                onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="searchable-select-value-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                        <span className={!displayValue ? 'placeholder' : ''} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {displayValue || placeholder}
                        </span>
                        {displayValue && !disabled && (
                            <button
                                type="button"
                                className="searchable-select-clear-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange({ target: { value: '' } });
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '4px',
                                    transition: 'color 0.2s ease'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                                onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                )}
                <ChevronDown size={16} className={`chevron ${isOpen ? 'rotated' : ''}`} />
            </div>

            {isOpen && createPortal(dropdownMenu, document.body)}
        </div>
    );
};

export default SearchableSelect;
