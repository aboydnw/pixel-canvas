import { COLORS } from '../lib/constants'

interface Props {
  selectedColor: string
  onSelectColor: (color: string) => void
}

export function ColorPicker({ selectedColor, onSelectColor }: Props) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:bottom-auto sm:top-6 z-10">
      <div className="flex gap-3 rounded-full bg-black/40 px-5 py-3 backdrop-blur-md">
        {COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onSelectColor(color)}
            className="h-8 w-8 rounded-full transition-transform hover:scale-110 focus:outline-none"
            style={{
              backgroundColor: color,
              boxShadow:
                selectedColor === color
                  ? `0 0 0 3px white, 0 0 12px ${color}80`
                  : '0 1px 3px rgba(0,0,0,0.3)',
              transform: selectedColor === color ? 'scale(1.15)' : undefined,
            }}
            aria-label={`Select color ${color}`}
          />
        ))}
      </div>
    </div>
  )
}
