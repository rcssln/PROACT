import React from 'react'
import '../styles/components/Button.css'

/**
 * Standardized Button component with variants and loading state
 * @param {Object} props
 * @param {'solid'|'outline'|'subtle'|'ghost'} [props.variant] - Button variant (default: 'solid')
 * @param {'primary'|'success'|'danger'|'warning'|'neutral'|'secondary'} [props.color] - Button color theme (default: 'primary')
 * @param {'sm'|'md'|'lg'} [props.size] - Button size (default: 'md')
 * @param {boolean} [props.isLoading] - If true, shows loading animation and disables the button
 * @param {React.ReactNode} [props.leftIcon] - Icon to show on the left
 * @param {React.ReactNode} [props.rightIcon] - Icon to show on the right
 * @param {React.ReactNode} props.children - Button label
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.disabled] - If true, disables the button
 * @param {React.ElementType} [props.as] - Component to render as (default: 'button')
 */
const Button = ({ 
  variant = 'solid',
  color = 'primary',
  size = 'md',
  isLoading, 
  icon,
  leftIcon,
  rightIcon,
  children, 
  className = '', 
  disabled, 
  style, 
  type = 'button',
  as: Component = 'button',
  ...props 
}) => {
  const finalLeftIcon = leftIcon || icon
  const variantClass = `btn-${variant}`
  const colorClass = `btn-${color}`
  const sizeClass = size !== 'md' ? `btn-${size}` : ''
  
  const isIconOnly = !children && (finalLeftIcon || rightIcon)
  const combinedClasses = `btn ${variantClass} ${colorClass} ${sizeClass} ${isIconOnly ? 'btn-icon-only' : ''} ${className}`.trim()

  return (
    <Component
      type={Component === 'button' ? type : undefined}
      className={combinedClasses}
      disabled={isLoading || disabled}
      style={style}
      {...props}
    >
      {isLoading ? (
        <span className="button-loading-text">
          <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="31.4 31.4" strokeLinecap="round" opacity="0.25" />
            <path d="M12 2C6.47715 2 2 6.47715 2 12C2 13.4367 2.30239 14.8028 2.8463 16.0391" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
          {children && <span>Processing...</span>}
        </span>
      ) : (
        <>
          {finalLeftIcon && finalLeftIcon}
          {children}
          {rightIcon && rightIcon}
        </>
      )}
    </Component>
  )
}

export default Button
