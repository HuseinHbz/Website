'use client'

import { useState, useRef, useCallback } from 'react'
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface Props {
  value: string
  onChange: (url: string) => void
  folder?: string
  aspect?: number           // e.g. 1 for square, 16/9 for widescreen
  shape?: 'circle' | 'rect'
  label?: string
  previewClass?: string     // tailwind classes for the preview element
}

function centerAspectCrop(w: number, h: number, aspect: number): Crop {
  return centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, w, h), w, h)
}

export function ImageUploadCrop({
  value,
  onChange,
  folder = 'general',
  aspect = 1,
  shape = 'circle',
  label = 'Upload Image',
  previewClass = 'w-24 h-24 rounded-full',
}: Props) {
  const [srcBlob, setSrcBlob] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const imgRef = useRef<HTMLImageElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,image/tiff,image/svg+xml'

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    // SVG and GIF skip crop (no canvas support needed)
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      uploadFile(file)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setSrcBlob(reader.result as string)
    reader.readAsDataURL(file)
    // reset file input so same file can be re-selected
    e.target.value = ''
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget
    setCrop(centerAspectCrop(w, h, aspect))
  }

  async function getCroppedBlob(): Promise<Blob | null> {
    const img = imgRef.current
    if (!img || !crop || !crop.width || !crop.height) return null

    const scaleX = img.naturalWidth / img.width
    const scaleY = img.naturalHeight / img.height

    const canvas = document.createElement('canvas')
    const pixelRatio = window.devicePixelRatio || 1
    const cropW = crop.unit === '%' ? (crop.width / 100) * img.naturalWidth : crop.width * scaleX
    const cropH = crop.unit === '%' ? (crop.height / 100) * img.naturalHeight : crop.height * scaleY
    const cropX = crop.unit === '%' ? (crop.x / 100) * img.naturalWidth : crop.x * scaleX
    const cropY = crop.unit === '%' ? (crop.y / 100) * img.naturalHeight : crop.y * scaleY

    canvas.width = cropW * pixelRatio
    canvas.height = cropH * pixelRatio

    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

    return new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.92))
  }

  async function uploadFile(file: File) {
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', folder)
      const res = await fetch('/api/admin/media', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const d = await res.json()
      const url: string = d.url?.startsWith('/') ? d.url : `/${d.url}`
      onChange(url)
      setSrcBlob(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function applyCrop() {
    const blob = await getCroppedBlob()
    if (!blob) return
    const file = new File([blob], `cropped-${Date.now()}.jpg`, { type: 'image/jpeg' })
    await uploadFile(file)
  }

  const normalizeUrl = useCallback((u: string) => u?.startsWith('/') ? u : u ? `/${u}` : '', [])

  return (
    <div className="space-y-3">
      {label && <p className="text-xs font-medium text-slate-400">{label}</p>}

      {/* Preview + controls */}
      {!srcBlob && (
        <div className="flex items-start gap-4">
          {/* Preview */}
          <div className="flex-shrink-0">
            {uploading ? (
              <div className={`${previewClass} flex items-center justify-center bg-indigo-500/10 border-2 border-indigo-500/30 animate-pulse`}>
                <span className="text-indigo-400 text-xs font-medium">...</span>
              </div>
            ) : value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={normalizeUrl(value)}
                alt="Preview"
                className={`${previewClass} object-cover border-2 border-indigo-500/40 shadow-lg`}
                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
              />
            ) : (
              <div className={`${previewClass} flex items-center justify-center bg-slate-800 border-2 border-dashed border-slate-600 text-slate-500 text-xs`}>
                No image
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex-1 space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={onFileChange}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/40 disabled:opacity-50 border border-indigo-500/30 text-indigo-300 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              {uploading ? '⏳ Uploading...' : '↑ Upload & Crop'}
            </button>
            <p className="text-3xs text-slate-600">JPG · PNG · WebP · AVIF · GIF · SVG · BMP</p>

            {/* URL input */}
            <div className="space-y-1">
              <label className="text-3xs text-slate-500 uppercase tracking-wider">Or paste URL</label>
              <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder="/uploads/..."
                className="w-full bg-background border border-strong rounded-lg px-3 py-2 text-xs text-text-primary placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                ✕ Remove
              </button>
            )}
          </div>
        </div>
      )}

      {/* Crop modal */}
      {srcBlob && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-surface-2 border border-strong rounded-2xl p-6 max-w-2xl w-full space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-text-primary font-semibold">Crop Image</h3>
              <button onClick={() => setSrcBlob(null)} className="text-slate-400 hover:text-text-primary text-xl leading-none">✕</button>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center bg-background rounded-lg p-2">
              <ReactCrop
                crop={crop}
                onChange={(_, pc) => setCrop(pc)}
                aspect={aspect}
                circularCrop={shape === 'circle'}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={srcBlob}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  style={{ maxHeight: '60vh', maxWidth: '100%' }}
                />
              </ReactCrop>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setSrcBlob(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-text-primary border border-strong rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyCrop}
                disabled={uploading}
                className="px-6 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-text-primary rounded-lg transition-colors"
              >
                {uploading ? 'Uploading...' : 'Crop & Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
