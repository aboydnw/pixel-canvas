import { useRef, useEffect, useState, useCallback } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import {
  BROADCAST_CHANNEL,
  BATCH_INTERVAL_MS,
  BATCH_MAX_CELLS,
  SNAPSHOT_INTERVAL_MS,
  EVENT_PAINT,
  EVENT_CLEAR,
  EVENT_LOCK,
} from '../lib/constants'

type CellUpdate = { row: number; col: number; color: string }

export type DrawCellFn = (row: number, col: number, color: string) => void
export type DrawFullGridFn = (grid: Map<string, string>) => void

export function usePixelGrid(isAdmin: boolean) {
  const gridRef = useRef(new Map<string, string>())
  const batchQueue = useRef<CellUpdate[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const drawCellRef = useRef<DrawCellFn | null>(null)
  const drawFullGridRef = useRef<DrawFullGridFn | null>(null)
  const canvasElRef = useRef<HTMLCanvasElement | null>(null)

  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [participantCount, setParticipantCount] = useState(0)
  const [lockState, setLockStateLocal] = useState<'open' | 'paused'>('open')

  const isEditingEnabled = lockState === 'open' || isAdmin

  const registerDrawFunctions = useCallback(
    (
      drawCell: DrawCellFn,
      drawFullGrid: DrawFullGridFn,
      canvasEl?: HTMLCanvasElement | null
    ) => {
      drawCellRef.current = drawCell
      drawFullGridRef.current = drawFullGrid
      if (canvasEl !== undefined) {
        canvasElRef.current = canvasEl
      }
    },
    []
  )

  const saveSnapshot = useCallback(async () => {
    const state: Record<string, string> = {}
    gridRef.current.forEach((color, key) => {
      state[key] = color
    })
    await supabase
      .from('pixel_grid')
      .update({ state, updated_at: new Date().toISOString() })
      .eq('id', 'main')
  }, [])

  const setLockState = useCallback(
    async (next: 'open' | 'paused') => {
      await supabase
        .from('pixel_grid')
        .update({ lock_state: next, lock_updated_at: new Date().toISOString() })
        .eq('id', 'main')

      channelRef.current?.send({
        type: 'broadcast',
        event: EVENT_LOCK,
        payload: { lock_state: next },
      })

      setLockStateLocal(next)

      if (next === 'paused') {
        saveSnapshot()
      }
    },
    [saveSnapshot]
  )

  const paintCell = useCallback(
    (row: number, col: number, color: string) => {
      if (!isEditingEnabled) return

      const key = `${row}-${col}`
      gridRef.current.set(key, color)
      drawCellRef.current?.(row, col, color)
      batchQueue.current.push({ row, col, color })
    },
    [isEditingEnabled]
  )

  const clearGrid = useCallback(() => {
    if (!isAdmin) return

    gridRef.current.clear()
    drawFullGridRef.current?.(gridRef.current)
    channelRef.current?.send({
      type: 'broadcast',
      event: EVENT_CLEAR,
      payload: {},
    })
    saveSnapshot()
  }, [saveSnapshot, isAdmin])

  useEffect(() => {
    let batchInterval: ReturnType<typeof setInterval>
    let snapshotInterval: ReturnType<typeof setInterval>
    let mounted = true

    async function init() {
      // Load initial state from DB
      const { data } = await supabase
        .from('pixel_grid')
        .select('state, lock_state')
        .eq('id', 'main')
        .single()

      if (!mounted) return

      if (data?.state && typeof data.state === 'object') {
        const state = data.state as Record<string, string>
        for (const [key, color] of Object.entries(state)) {
          gridRef.current.set(key, color)
        }
      }

      if (data?.lock_state === 'open' || data?.lock_state === 'paused') {
        setLockStateLocal(data.lock_state)
      }

      drawFullGridRef.current?.(gridRef.current)
      setIsLoading(false)

      // Subscribe to broadcast channel
      const channel = supabase.channel(BROADCAST_CHANNEL, {
        config: { presence: { key: crypto.randomUUID() } },
      })

      channel
        .on('broadcast', { event: EVENT_LOCK }, (msg) => {
          if (!mounted) return
          const next = msg.payload.lock_state as 'open' | 'paused'
          setLockStateLocal(next)
          if (next === 'paused') {
            batchQueue.current = []
          }
        })
        .on('broadcast', { event: EVENT_CLEAR }, () => {
          if (!mounted) return
          console.log('[rt] ← received clear')
          gridRef.current.clear()
          drawFullGridRef.current?.(gridRef.current)
        })
        .on('broadcast', { event: EVENT_PAINT }, (msg) => {
          if (!mounted) return
          console.log('[rt] ← received broadcast', msg)
          const cells = msg.payload.cells as CellUpdate[]
          for (const { row, col, color } of cells) {
            const key = `${row}-${col}`
            gridRef.current.set(key, color)
            drawCellRef.current?.(row, col, color)
          }
        })
        .on('presence', { event: 'sync' }, () => {
          if (!mounted) return
          const state = channel.presenceState()
          console.log('[rt] presence sync, count:', Object.keys(state).length)
          setParticipantCount(Object.keys(state).length)
        })
        .subscribe(async (status, err) => {
          if (!mounted) return
          console.log('[rt] subscribe status:', status, err ?? '')
          setIsConnected(status === 'SUBSCRIBED')
          if (status === 'SUBSCRIBED') {
            await channel.track({})
          }
        })

      channelRef.current = channel

      // Outgoing batch flush (capped to avoid Realtime rate limits)
      batchInterval = setInterval(async () => {
        if (batchQueue.current.length === 0) return
        const cells = batchQueue.current.splice(0, BATCH_MAX_CELLS)
        const result = await channel.send({
          type: 'broadcast',
          event: EVENT_PAINT,
          payload: { cells },
        })
        console.log('[rt] → sent batch', cells.length, 'cells, result:', result)
      }, BATCH_INTERVAL_MS)

      // Periodic DB snapshot
      snapshotInterval = setInterval(saveSnapshot, SNAPSHOT_INTERVAL_MS)
    }

    init()

    const handleBeforeUnload = () => {
      saveSnapshot()
    }
    const handleVisibilityChange = () => {
      if (document.hidden) saveSnapshot()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mounted = false
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(batchInterval)
      clearInterval(snapshotInterval)
      saveSnapshot()
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [saveSnapshot])

  return {
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
  }
}
