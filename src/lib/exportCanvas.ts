function formatTimestamp(): string {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

export function exportCanvasPng(canvas: HTMLCanvasElement) {
  canvas.toBlob((blob) => {
    if (!blob) return

    const filename = `pixel-canvas-${formatTimestamp()}.png`
    const file = new File([blob], filename, { type: 'image/png' })

    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], title: 'Pixel Canvas' }).catch((err) => {
        if (err.name !== 'AbortError') downloadBlob(blob, filename)
      })
    } else {
      downloadBlob(blob, filename)
    }
  }, 'image/png')
}
