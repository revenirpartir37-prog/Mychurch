'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { RotateCcw, Check, PenTool } from 'lucide-react'

interface SignaturePadProps {
  value?: string | null
  onChange: (dataUrl: string | null) => void
}

export function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set background & stroke style
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1e293b' // Dark slate stroke
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (value && value.startsWith('data:image')) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        setHasDrawn(true)
      }
      img.src = value
    }
  }, [value])

  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function startDrawing(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    setIsDrawing(true)
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasDrawn(true)
  }

  function stopDrawing() {
    if (!isDrawing) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas && hasDrawn) {
      onChange(canvas.toDataURL('image/png'))
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1 font-medium text-foreground">
          <PenTool className="h-3.5 w-3.5 text-primary" />
          Signature Électronique
        </span>
        {hasDrawn && (
          <span className="text-emerald-600 font-semibold flex items-center gap-1">
            <Check className="h-3 w-3" /> Apposée
          </span>
        )}
      </div>

      <div className="relative border-2 border-dashed border-border rounded-xl bg-white overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef}
          width={400}
          height={140}
          className="w-full h-36 touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground/40 text-xs italic">
            Dessinez votre signature ici
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearCanvas}
          className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
        >
          <RotateCcw className="h-3 w-3" /> Effacer
        </Button>
      </div>
    </div>
  )
}
