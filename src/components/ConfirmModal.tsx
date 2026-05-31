'use client'

import { useEffect, useRef } from 'react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'danger' | 'primary' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  // 打开时自动聚焦确认按钮，支持 ESC 关闭
  useEffect(() => {
    if (isOpen) {
      confirmButtonRef.current?.focus()

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onCancel()
        }
      }
      document.addEventListener('keydown', handleKeyDown)
      // 禁止背景滚动
      document.body.style.overflow = 'hidden'

      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = ''
      }
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const confirmBtnClass =
    confirmVariant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
      : confirmVariant === 'warning'
        ? 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500'
        : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onCancel}
      />

      {/* 对话框 */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 transform transition-all">
        <h3
          id="confirm-modal-title"
          className="text-lg font-semibold text-gray-900 mb-3"
        >
          {title}
        </h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmBtnClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
