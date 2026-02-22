import { useRef, useEffect, useCallback } from 'react'
import {
  GRID_ROWS,
  GRID_COLS,
  CELL_SIZE_DESKTOP,
  CELL_SIZE_MOBILE,
  DEFAULT_COLOR,
} from '../lib/constants'
import type { DrawCellFn, DrawFullGridFn } from '../hooks/usePixelGrid'

interface Props {
  selectedColor: string
  gridRef: React.RefObject<Map<string, string>>
  paintCell: (row: number, col: number, color: string) => void
  registerDrawFunctions: (drawCell: DrawCellFn, drawFullGrid: DrawFullGridFn) => void
}

function getCellSize() {
  return window.innerWidth < 640 ? CELL_SIZE_MOBILE : CELL_SIZE_DESKTOP
}

export function PixelCanvas({ selectedColor, gridRef, paintCell, registerDrawFunctions }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isPointerDown = useRef(false)
  const lastPaintedCell = useRef<string | null>(null)
  const cellSizeRef = useRef(getCellSize())

  const drawCell: DrawCellFn = useCallback((row: number, col: number, color: string) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cs = cellSizeRef.current
    ctx.fillStyle = color
    ctx.fillRect(col * cs * dpr, row * cs * dpr, cs * dpr, cs * dpr)

    // Grid line
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = dpr
    ctx.strokeRect(col * cs * dpr, row * cs * dpr, cs * dpr, cs * dpr)
  }, [])

  const drawFullGrid: DrawFullGridFn = useCallback((grid: Map<string, string>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cs = cellSizeRef.current

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const key = `${r}-${c}`
        const color = grid.get(key) || DEFAULT_COLOR
        ctx.fillStyle = color
        ctx.fillRect(c * cs * dpr, r * cs * dpr, cs * dpr, cs * dpr)
        ctx.strokeStyle = 'rgba(0,0,0,0.08)'
        ctx.lineWidth = dpr
        ctx.strokeRect(c * cs * dpr, r * cs * dpr, cs * dpr, cs * dpr)
      }
    }
  }, [])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const cs = getCellSize()
    cellSizeRef.current = cs
    const dpr = window.devicePixelRatio || 1

    canvas.width = GRID_COLS * cs * dpr
    canvas.height = GRID_ROWS * cs * dpr
    canvas.style.width = `${GRID_COLS * cs}px`
    canvas.style.height = `${GRID_ROWS * cs}px`

    drawFullGrid(gridRef.current)
  }, [drawFullGrid, gridRef])

  useEffect(() => {
    registerDrawFunctions(drawCell, drawFullGrid)
    resizeCanvas()

    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [registerDrawFunctions, drawCell, drawFullGrid, resizeCanvas])

  const cellFromEvent = useCallback((e: React.MouseEvent | React.TouchEvent): [number, number] | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number

    if ('touches' in e) {
      if (e.touches.length === 0) return null
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const x = clientX - rect.left
    const y = clientY - rect.top
    const cs = cellSizeRef.current

    const col = Math.floor(x / cs)
    const row = Math.floor(y / cs)

    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return null
    return [row, col]
  }, [])

  const handlePaint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const cell = cellFromEvent(e)
    if (!cell) return

    const [row, col] = cell
    const key = `${row}-${col}`

    if (key === lastPaintedCell.current) return
    lastPaintedCell.current = key
    paintCell(row, col, selectedColor)
  }, [cellFromEvent, paintCell, selectedColor])

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) e.preventDefault()
    isPointerDown.current = true
    lastPaintedCell.current = null
    handlePaint(e)
  }, [handlePaint])

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isPointerDown.current) return
    if ('touches' in e) e.preventDefault()
    handlePaint(e)
  }, [handlePaint])

  const handlePointerUp = useCallback(() => {
    isPointerDown.current = false
    lastPaintedCell.current = null
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="block cursor-crosshair rounded-sm"
      style={{ touchAction: 'none' }}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      onTouchCancel={handlePointerUp}
    />
  )
}
