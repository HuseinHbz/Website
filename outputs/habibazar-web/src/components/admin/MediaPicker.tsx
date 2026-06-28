'use client'

import { useState, useEffect, useCallback } from 'react'
import { Modal, Btn, Card } from '@/components/admin/ui'

type MediaFile = {
  id: number; filename: string; originalName: string; mimeType: string
  size: number; url: string; folder: string; alt: string; uploadedAt: string
}

const FOLDERS = ['general', 'projects', 'blog', 'clients', 'logos', 'avatars']

interface MediaPickerProps {
  value: string
  onChange: (url: string) => void
  label?: string
  folder?: string
  placeholder?: string
}

function isImage(mime: string) { return mime.startsWith('image/') }

export function MediaPicker({ value, onChange, label, folder: defaultFolder = 'general', placeholder }: MediaPickerProps) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<MediaFile[]>([])
  const [folder, setFolder] = useState(defaultFolder)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)

  async function load() {
    const r = await fetch(`/api/admin/media?folder=${folder}`)
    const d = await r.json()
    setFiles(Array.isArray(d) ? d : [])
  }

  useEffect(() => { if (open) load() }, [open, folder])

  async function upload(fileList: FileList) {
    setUploading(true)
    for (const file of Array.from(fileList)) {
      const form = new FormData()
      form.append('file', file)
      form.append('folder', folder)
      await fetch('/api/admin/media', { method: 'POST', body: form })
    }
    setUploading(false)
    load()
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files)
  }, [folder])

  function pick(url: string) { onChange(url); setOpen(false) }
  function clear() { onChange('') }

  return (
    <div>
      {label && <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>}
      <div className="flex gap-2 items-center">
        {value ? (
          <div className="flex items-center gap-2 flex-1 px-3 py-2 bg-[#0c0c14] border border-[#2a2a3e] rounded-lg">
            <img src={value} alt="" className="w-8 h-8 object-cover rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <span className="text-xs text-indigo-400 flex-1 truncate">{value}</span>
            <button onClick={clear} className="text-slate-600 hover:text-red-400 text-xs ml-1">✕</button>
          </div>
        ) : (
          <div className="flex-1 px-3 py-2 bg-[#0c0c14] border border-[#2a2a3e] rounded-lg text-xs text-slate-600">
            {placeholder || 'No image selected'}
          </div>
        )}
        <Btn size="sm" variant="secondary" onClick={() => setOpen(true)}>📁 Browse</Btn>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Media Library" size="xl">
        <div className="flex gap-4">
          {/* Folder list */}
          <div className="w-36 flex-shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">Folders</p>
            {FOLDERS.map((f) => (
              <button
                key={f}
                onClick={() => setFolder(f)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs mb-0.5 transition-colors ${folder === f ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-white/5'}`}
              >
                📁 {f}
              </button>
            ))}
          </div>

          <div className="flex-1">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-4 text-center mb-4 transition-colors ${dragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-[#2a2a3e] hover:border-indigo-500/30'}`}
            >
              <p className="text-xs text-slate-500 mb-2">Drag images here or</p>
              <label className="cursor-pointer">
                <span className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                  {uploading ? 'Uploading...' : '+ Upload'}
                </span>
                <input type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden"
                  onChange={(e) => e.target.files && upload(e.target.files)} />
              </label>
            </div>

            {/* Grid */}
            {files.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-sm">No files in /{folder} — upload some above</div>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-72 overflow-y-auto">
                {files.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => pick(f.url)}
                    className="group rounded-lg overflow-hidden border border-[#1e1e2e] hover:border-indigo-500 transition-all text-left"
                  >
                    {isImage(f.mimeType) ? (
                      <img src={f.url} alt={f.alt || f.originalName} className="w-full h-20 object-cover group-hover:opacity-90" />
                    ) : (
                      <div className="w-full h-20 bg-[#111122] flex items-center justify-center text-2xl">
                        {f.mimeType.includes('pdf') ? '📄' : '📎'}
                      </div>
                    )}
                    <div className="p-1.5">
                      <p className="text-[10px] text-slate-400 truncate">{f.originalName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Multi-image picker (for gallery) ─────────────────────────────────────────

interface GalleryPickerProps {
  value: string[]
  onChange: (urls: string[]) => void
  label?: string
  folder?: string
}

export function GalleryPicker({ value, onChange, label, folder: defaultFolder = 'projects' }: GalleryPickerProps) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<MediaFile[]>([])
  const [folder, setFolder] = useState(defaultFolder)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)

  async function load() {
    const r = await fetch(`/api/admin/media?folder=${folder}`)
    const d = await r.json()
    setFiles(Array.isArray(d) ? d : [])
  }

  useEffect(() => { if (open) load() }, [open, folder])

  async function upload(fileList: FileList) {
    setUploading(true)
    for (const file of Array.from(fileList)) {
      const form = new FormData()
      form.append('file', file)
      form.append('folder', folder)
      await fetch('/api/admin/media', { method: 'POST', body: form })
    }
    setUploading(false)
    load()
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files)
  }, [folder])

  function toggle(url: string) {
    if (value.includes(url)) onChange(value.filter((u) => u !== url))
    else onChange([...value, url])
  }

  function remove(url: string) { onChange(value.filter((u) => u !== url)) }

  return (
    <div>
      {label && <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>}

      {/* Current gallery */}
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((url) => (
          <div key={url} className="relative group">
            <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-[#2a2a3e]" />
            <button
              onClick={() => remove(url)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] hidden group-hover:flex items-center justify-center"
            >✕</button>
          </div>
        ))}
        <button
          onClick={() => setOpen(true)}
          className="w-16 h-16 rounded-lg border-2 border-dashed border-[#2a2a3e] hover:border-indigo-500 text-slate-600 hover:text-indigo-400 flex items-center justify-center text-xl transition-colors"
        >+</button>
      </div>
      {value.length === 0 && (
        <p className="text-xs text-slate-600 mb-2">No images yet — click + to add</p>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Pick Gallery Images (click to toggle)" size="xl">
        <div className="flex gap-4">
          <div className="w-36 flex-shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">Folders</p>
            {FOLDERS.map((f) => (
              <button key={f} onClick={() => setFolder(f)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs mb-0.5 transition-colors ${folder === f ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-white/5'}`}>
                📁 {f}
              </button>
            ))}
          </div>
          <div className="flex-1">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-3 text-center mb-3 transition-colors ${dragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-[#2a2a3e]'}`}
            >
              <label className="cursor-pointer text-xs text-slate-500">
                {uploading ? 'Uploading...' : <><span className="text-indigo-400 underline">Upload images</span> or drag here</>}
                <input type="file" multiple accept="image/*" className="hidden"
                  onChange={(e) => e.target.files && upload(e.target.files)} />
              </label>
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-72 overflow-y-auto">
              {files.filter(f => isImage(f.mimeType)).map((f) => (
                <button key={f.id} onClick={() => toggle(f.url)}
                  className={`group rounded-lg overflow-hidden border transition-all ${value.includes(f.url) ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-[#1e1e2e] hover:border-indigo-500/50'}`}
                >
                  <div className="relative">
                    <img src={f.url} alt={f.originalName} className="w-full h-20 object-cover" />
                    {value.includes(f.url) && (
                      <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                        <span className="text-white text-lg">✓</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate p-1">{f.originalName}</p>
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Btn size="sm" onClick={() => setOpen(false)}>Done ({value.length} selected)</Btn>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
