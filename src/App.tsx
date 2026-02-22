import { useState } from 'react'
import { COLORS } from './lib/constants'
import { usePixelGrid } from './hooks/usePixelGrid'
import { PixelCanvas } from './components/PixelCanvas'
import { ColorPicker } from './components/ColorPicker'

export default function App() {
  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0])
  const {
    gridRef,
    paintCell,
    isConnected,
    isLoading,
    participantCount,
    registerDrawFunctions,
  } = usePixelGrid()

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#1a1a2e]">
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

      {/* Color picker */}
      {!isLoading && (
        <ColorPicker
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
        />
      )}
    </div>
  )
}
