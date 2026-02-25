import { useState, useCallback, useMemo } from 'react'
import { COLORS } from './lib/constants'
import { usePixelGrid } from './hooks/usePixelGrid'
import { PixelCanvas } from './components/PixelCanvas'
import { ColorPicker } from './components/ColorPicker'
import { ConfirmModal } from './components/ConfirmModal'
import { exportCanvasPng } from './lib/exportCanvas'

function CameraIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

export default function App() {
  const isAdmin = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('admin') === '1'
  }, [])

  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0])
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const {
    gridRef,
    canvasElRef,
    paintCell,
    clearGrid,
    isConnected,
    isLoading,
    participantCount,
    registerDrawFunctions,
    lockState,
    isEditingEnabled,
    setLockState,
  } = usePixelGrid(isAdmin)

  const handleClearConfirm = useCallback(() => {
    clearGrid()
    setShowClearConfirm(false)
  }, [clearGrid])

  const handleScreenshot = useCallback(() => {
    if (!canvasElRef.current) return
    exportCanvasPng(canvasElRef.current)
  }, [canvasElRef])

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-4 overflow-hidden bg-[#1a1a2e]">
      {/* Admin toolbar */}
      {isAdmin && (
        <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
          <button
            onClick={() => setLockState(lockState === 'open' ? 'paused' : 'open')}
            className="rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-black/70"
          >
            {lockState === 'open' ? '⏸ Pause' : '▶ Start'}
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-black/70"
          >
            🗑 Clear
          </button>
        </div>
      )}

      {/* Paused banner for non-admin */}
      {!isEditingEnabled && !isAdmin && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-yellow-500/90 px-4 py-2 text-sm font-medium text-black">
          ⏸ Canvas is paused
        </div>
      )}

      {/* Connection indicator + participant count */}
      <div className="fixed top-4 right-4 z-10 flex items-center gap-2">
        {participantCount > 0 && (
          <span className="text-xs text-white/50">
            {participantCount} {participantCount === 1 ? 'person' : 'people'}
          </span>
        )}
        <div
          className="h-2 w-2 rounded-full transition-colors duration-500"
          style={{ backgroundColor: isConnected ? '#2a9d8f' : '#666' }}
          title={isConnected ? 'Connected' : 'Disconnected'}
        />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1a1a2e]">
          <div className="h-3 w-3 animate-pulse rounded-full bg-white/60" />
        </div>
      )}

      {/* Canvas */}
      <div
        className="transition-opacity duration-500"
        style={{ opacity: isLoading ? 0 : 1 }}
      >
        <PixelCanvas
          selectedColor={selectedColor}
          gridRef={gridRef}
          paintCell={paintCell}
          registerDrawFunctions={registerDrawFunctions}
          isReadOnly={!isEditingEnabled}
        />
      </div>

      {/* Toolbar: color picker + clear */}
      {!isLoading && (
        <ColorPicker
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
          onClear={isAdmin ? () => setShowClearConfirm(true) : undefined}
        />
      )}

      {!isLoading && (
        <button
          onClick={handleScreenshot}
          className="fixed right-4 bottom-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white/70 backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white focus:outline-none"
          title="Save screenshot"
          aria-label="Save screenshot"
        >
          <CameraIcon />
        </button>
      )}

      {/* Clear confirmation modal */}
      <ConfirmModal
        open={showClearConfirm}
        title="Clear canvas"
        message="This will erase every pixel for all participants. This action cannot be undone."
        confirmLabel="Clear"
        onConfirm={handleClearConfirm}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  )
}
