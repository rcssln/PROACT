import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'

/**
 * HeaderFooterModal - A standardized modal component
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {Function} props.onClose - Callback when modal should close
 * @param {string|React.ReactNode} [props.title] - Modal title
 * @param {string|React.ReactNode} [props.subtitle] - Modal subtitle
 * @param {React.ReactNode} props.children - Modal body content
 * @param {React.ReactNode} [props.footer] - Modal footer content (action buttons)
 * @param {string} [props.maxWidth] - CSS max-width (default: 560px)
 * @param {string} [props.className] - Additional classes for modal-content
 * @param {boolean} [props.glass] - Whether to use glassmorphism style (default: true)
 * @param {boolean} [props.showClose] - Whether to show the X close button (default: true)
 * @param {boolean} [props.closeOnClickOutside] - Whether clicking overlay closes modal (default: true)
 * @param {string} [props.bodyPadding] - Custom padding for modal-body
 */
export default function HeaderFooterModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = '560px',
  className = '',
  glass = true,
  showClose = true,
  closeOnClickOutside = true,
  bodyPadding
}) {
  useEffect(() => {
    if (isOpen) {
      const handleEsc = (e) => {
        if (e.key === 'Escape') onClose?.()
      }
      window.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
      return () => {
        window.removeEventListener('keydown', handleEsc)
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div 
      className="modal-overlay" 
      onClick={closeOnClickOutside ? onClose : undefined}
      style={{ cursor: closeOnClickOutside ? 'pointer' : 'default' }}
    >
      <div
        className={`modal-content ${glass ? 'glass-modal' : ''} ${className}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth, cursor: 'default' }}
      >
        {(title || showClose) && (
          <div className="modal-header">
            <div>
              {title && <h2>{title}</h2>}
              {subtitle && <div className="modal-header-subtitle">{subtitle}</div>}
            </div>
            {showClose && (
              <button className="modal-close" onClick={onClose} aria-label="Close">
                <X size={20} />
              </button>
            )}
          </div>
        )}
        <div className="modal-body" style={{ padding: bodyPadding }}>
          {children}
        </div>
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
