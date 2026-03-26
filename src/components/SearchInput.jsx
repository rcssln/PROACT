import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';

const SearchInput = ({ placeholder, value, onChange, suggestions = [], onSuggestionClick, className = '' }) => {
    const [showSuggestions, setShowSuggestions] = useState(false);

    const filteredSuggestions = useMemo(() => {
        if (!value || !suggestions.length) return [];
        const low = value.toLowerCase();
        return suggestions
            .filter(s => s?.toLowerCase().includes(low) && s?.toLowerCase() !== low)
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 5);
    }, [value, suggestions]);

    return (
        <div className={`search-box ${className}`}>
            <Search size={18} className="search-icon" />
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="search-input"
            />
            {value && (
                <button
                    type="button"
                    className="clear-search-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onChange('');
                    }}
                    aria-label="Clear search"
                >
                    <X size={16} />
                </button>
            )}
            {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="search-suggestions">
                    {filteredSuggestions.map((s, idx) => (
                        <div
                            key={idx}
                            className="suggestion-item"
                            onClick={() => {
                                if (onSuggestionClick) {
                                    onSuggestionClick(s);
                                } else {
                                    onChange(s);
                                }
                                setShowSuggestions(false);
                            }}
                        >
                            <Search size={14} />
                            <span>{s}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SearchInput;
