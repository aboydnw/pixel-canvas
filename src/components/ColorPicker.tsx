import { COLORS } from '../lib/constants'

interface Props {
  selectedColor: string
  onSelectColor: (color: string) => void
  onClear: () => void
}

function RefreshIcon() {
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
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M21 21v-5h-5" />
    </svg>
  )
}

export function ColorPicker({ selectedColor, onSelectColor, onClear }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-full bg-black/40 px-5 py-3 backdrop-blur-md">
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

      <div className="mx-1 h-6 w-px bg-white/20" />

      <button
        onClick={onClear}
        className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white/80 focus:outline-none"
        aria-label="Clear canvas"
        title="Clear canvas"
      >
        <RefreshIcon />
      </button>
    </div>
  )
}
