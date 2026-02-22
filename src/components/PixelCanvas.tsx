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

/** Bresenham's line: returns every [row, col] between two cells (inclusive). */
function cellsOnLine(r0: number, c0: number, r1: number, c1: number): [number, number][] {
  const cells: [number, number][] = []
  let dr = Math.abs(r1 - r0)
  let dc = Math.abs(c1 - c0)
  const sr = r0 < r1 ? 1 : -1
  const sc = c0 < c1 ? 1 : -1
  let err = dc - dr
  let r = r0
  let c = c0

  while (true) {
    cells.push([r, c])
    if (r === r1 && c === c1) break
    const e2 = 2 * err
    if (e2 > -dr) { err -= dr; c += sc }
    if (e2 < dc) { err += dc; r += sr }
  }
  return cells
}

export function PixelCanvas({ selectedColor, gridRef, paintCell, registerDrawFunctions }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isPointerDown = useRef(false)
  const lastCell = useRef<[number, number] | null>(null)
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
    const prev = lastCell.current

    if (prev && prev[0] === row && prev[1] === col) return

    if (prev) {
      // Interpolate all cells between previous and current position
      const line = cellsOnLine(prev[0], prev[1], row, col)
      // Skip first cell — it was already painted on the previous event
      for (let i = 1; i < line.length; i++) {
        paintCell(line[i][0], line[i][1], selectedColor)
      }
    } else {
      paintCell(row, col, selectedColor)
    }

    lastCell.current = [row, col]
  }, [cellFromEvent, paintCell, selectedColor])

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) e.preventDefault()
    isPointerDown.current = true
    lastCell.current = null
    handlePaint(e)
  }, [handlePaint])

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isPointerDown.current) return
    if ('touches' in e) e.preventDefault()
    handlePaint(e)
  }, [handlePaint])

  const handlePointerUp = useCallback(() => {
    isPointerDown.current = false
    lastCell.current = null
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
