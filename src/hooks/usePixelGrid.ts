import { useRef, useEffect, useState, useCallback } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import {
  BROADCAST_CHANNEL,
  BATCH_INTERVAL_MS,
  SNAPSHOT_INTERVAL_MS,
} from '../lib/constants'

type CellUpdate = { row: number; col: number; color: string }

export type DrawCellFn = (row: number, col: number, color: string) => void
export type DrawFullGridFn = (grid: Map<string, string>) => void

export function usePixelGrid() {
  const gridRef = useRef(new Map<string, string>())
  const batchQueue = useRef<CellUpdate[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const drawCellRef = useRef<DrawCellFn | null>(null)
  const drawFullGridRef = useRef<DrawFullGridFn | null>(null)

  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [participantCount, setParticipantCount] = useState(0)

  const registerDrawFunctions = useCallback(
    (drawCell: DrawCellFn, drawFullGrid: DrawFullGridFn) => {
      drawCellRef.current = drawCell
      drawFullGridRef.current = drawFullGrid
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

  const paintCell = useCallback((row: number, col: number, color: string) => {
    const key = `${row}-${col}`
    gridRef.current.set(key, color)
    drawCellRef.current?.(row, col, color)
    batchQueue.current.push({ row, col, color })
  }, [])

  useEffect(() => {
    let batchInterval: ReturnType<typeof setInterval>
    let snapshotInterval: ReturnType<typeof setInterval>
    let mounted = true

    async function init() {
      // Load initial state from DB
      const { data } = await supabase
        .from('pixel_grid')
        .select('state')
        .eq('id', 'main')
        .single()

      if (!mounted) return

      if (data?.state && typeof data.state === 'object') {
        const state = data.state as Record<string, string>
        for (const [key, color] of Object.entries(state)) {
          gridRef.current.set(key, color)
        }
      }

      drawFullGridRef.current?.(gridRef.current)
      setIsLoading(false)

      // Subscribe to broadcast channel
      const channel = supabase.channel(BROADCAST_CHANNEL, {
        config: { presence: { key: crypto.randomUUID() } },
      })

      channel
        .on('broadcast', { event: 'paint' }, ({ payload }) => {
          if (!mounted) return
          const cells = payload.cells as CellUpdate[]
          for (const { row, col, color } of cells) {
            const key = `${row}-${col}`
            gridRef.current.set(key, color)
            drawCellRef.current?.(row, col, color)
          }
        })
        .on('presence', { event: 'sync' }, () => {
          if (!mounted) return
          const state = channel.presenceState()
          setParticipantCount(Object.keys(state).length)
        })
        .subscribe(async (status) => {
          if (!mounted) return
          setIsConnected(status === 'SUBSCRIBED')
          if (status === 'SUBSCRIBED') {
            await channel.track({})
          }
        })

      channelRef.current = channel

      // Outgoing batch flush
      batchInterval = setInterval(() => {
        if (batchQueue.current.length === 0) return
        const cells = batchQueue.current.splice(0)
        channel.send({
          type: 'broadcast',
          event: 'paint',
          payload: { cells },
        })
      }, BATCH_INTERVAL_MS)

      // Periodic DB snapshot
      snapshotInterval = setInterval(saveSnapshot, SNAPSHOT_INTERVAL_MS)
    }

    init()

    const handleBeforeUnload = () => {
      saveSnapshot()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      mounted = false
      window.removeEventListener('beforeunload', handleBeforeUnload)
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
    paintCell,
    isConnected,
    isLoading,
    participantCount,
    registerDrawFunctions,
  }
}
