import React from 'react'

/**
 * Standardized Button component with loading state
 * @param {Object} props
 * @param {boolean} [props.isLoading] - If true, shows "LOADING..." and disables the button
 * @param {React.ReactNode} props.children - Button label
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.disabled] - If true, disabled the button
 * @param {Object} [props.style] - Inline styles
 */
const Button = ({ 
  isLoading, 
  children, 
  className = '', 
  disabled, 
  style, 
  type = 'button',
  ...props 
}) => {
  return (
    <button
      type={type}
      className={className}
      disabled={isLoading || disabled}
      style={style}
      {...props}
    >
      {isLoading ? (
        <span className="button-loading-text">
          LOADING...
        </span>
      ) : (
        children
      )}
    </button>
  )
}

export default Button
