import React from 'react'
import { CheckCircle, Warning, Info, Trash } from '@phosphor-icons/react'
import HeaderFooterModal from './HeaderFooterModal'
import Button from './Button'

/**
 * ConfirmationModal - Specialized modal for alerts, success, and confirmations
 */
export default function ConfirmationModal({
  isOpen,
  onClose,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  type = 'primary', // 'primary', 'danger', 'success', 'warning'
  icon: Icon,
  isLoading = false,
  maxWidth = '400px',
  showCancel = true
}) {
  const getIcon = () => {
    if (Icon) return <Icon size={32} />
    switch (type) {
      case 'success': return <CheckCircle size={32} />
      case 'danger': return <Warning size={32} />
      case 'warning': return <Warning size={32} />
      default: return <Info size={32} />
    }
  }

  return (
    <HeaderFooterModal
      isOpen={isOpen}
      onClose={onClose}
      showClose={false}
      maxWidth={maxWidth}
      bodyPadding="0"
    >
      <div className="modal-confirm">
        <div className={`modal-confirm-icon modal-confirm-icon--${type}`}>
          {getIcon()}
        </div>
        <h2 className="modal-confirm-title">{title}</h2>
        <div className="modal-confirm-text">{message}</div>
        <div className="modal-confirm-footer">
          {showCancel && (
            <Button 
              variant="subtle"
              onClick={onClose} 
              disabled={isLoading}
              style={{ minWidth: '120px' }}
            >
              {cancelText}
            </Button>
          )}
          <Button
            variant="solid"
            color={type === 'primary' ? 'primary' : type}
            onClick={onConfirm}
            isLoading={isLoading}
            style={{ minWidth: '120px', marginLeft: showCancel ? '0.5rem' : '0' }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </HeaderFooterModal>
  )
}
