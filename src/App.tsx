import { useState, useCallback } from 'react'
import { COLORS } from './lib/constants'
import { usePixelGrid } from './hooks/usePixelGrid'
import { PixelCanvas } from './components/PixelCanvas'
import { ColorPicker } from './components/ColorPicker'
import { ConfirmModal } from './components/ConfirmModal'

export default function App() {
  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0])
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const {
    gridRef,
    paintCell,
    clearGrid,
    isConnected,
    isLoading,
    participantCount,
    registerDrawFunctions,
  } = usePixelGrid()

  const handleClearConfirm = useCallback(() => {
    clearGrid()
    setShowClearConfirm(false)
  }, [clearGrid])

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-4 overflow-hidden bg-[#1a1a2e]">
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
        />
      </div>

      {/* Toolbar: color picker + clear */}
      {!isLoading && (
        <ColorPicker
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
          onClear={() => setShowClearConfirm(true)}
        />
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
