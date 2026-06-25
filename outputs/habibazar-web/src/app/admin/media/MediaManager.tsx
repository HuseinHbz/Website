'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, Btn, PageHeader, Badge, useToast } from '@/components/admin/ui'

type MediaFile = { id: number; filename: string; originalName: string; mimeType: string; size: number; url: string; folder: string; alt: string; uploadedAt: string }

const FOLDERS = ['general', 'blog', 'projects', 'clients', 'logos', 'avatars']

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(mime: string) { return mime.startsWith('image/') }

export function MediaManager() {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [folder, setFolder] = useState('general')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<MediaFile | null>(null)
  const { toast, ToastContainer } = useToast()

  async function load() {
    const r = await fetch(`/api/admin/media?folder=${folder}`)
    setFiles(await r.json())
  }
  useEffect(() => { load() }, [folder])

  async function upload(fileList: FileList) {
    setUploading(true)
    for (const file of Array.from(fileList)) {
      const form = new FormData()
      form.append('file', file)
      form.append('folder', folder)
      await fetch('/api/admin/media', { method: 'POST', body: form })
    }
    setUploading(false)
    toast(`Uploaded ${fileList.length} file(s)`)
    load()
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files)
  }, [folder])

  async function del(id: number) {
    if (!confirm('Delete this file?')) return
    await fetch('/api/admin/media', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast('Deleted')
    setSelected(null)
    load()
  }

  return (
    <>
      <ToastContainer />
      <PageHeader title="Media Manager" subtitle="Upload and manage images, documents, and files" />

      <div className="flex gap-4 mb-6">
        {/* Folder sidebar */}
        <div className="w-44 flex-shrink-0">
          <Card className="p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">Folders</p>
            {FOLDERS.map((f) => (
              <button
                key={f}
                onClick={() => setFolder(f)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm mb-0.5 transition-colors ${folder === f ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-white/5'}`}
              >
                📁 {f}
              </button>
            ))}
          </Card>
        </div>

        {/* Main area */}
        <div className="flex-1 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-[#2a2a3e] hover:border-indigo-500/50'}`}
          >
            <div className="text-3xl mb-2">▤</div>
            <p className="text-slate-400 text-sm mb-3">Drag & drop files here, or</p>
            <label className="cursor-pointer">
              <span className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                {uploading ? 'Uploading...' : 'Browse Files'}
              </span>
              <input
                type="file"
                multiple
                className="hidden"
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md"
                onChange={(e) => e.target.files && upload(e.target.files)}
              />
            </label>
            <p className="text-slate-600 text-xs mt-2">Images, videos, PDFs, documents</p>
          </div>

          {/* File grid */}
          <Card>
            <div className="p-4 border-b border-[#1e1e2e] flex items-center justify-between">
              <span className="text-sm text-slate-400">{files.length} files in /{folder}</span>
            </div>
            {files.length === 0 ? (
              <div className="text-center py-12 text-slate-600">No files in this folder yet</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 p-4">
                {files.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setSelected(f === selected ? null : f)}
                    className={`group cursor-pointer rounded-lg overflow-hidden border transition-all ${selected?.id === f.id ? 'border-indigo-500' : 'border-[#1e1e2e] hover:border-[#2a2a3e]'}`}
                  >
                    {isImage(f.mimeType) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.url} alt={f.alt || f.originalName} className="w-full h-20 object-cover" />
                    ) : (
                      <div className="w-full h-20 bg-[#111122] flex items-center justify-center text-2xl">
                        {f.mimeType.includes('pdf') ? '📄' : f.mimeType.includes('video') ? '🎬' : '📎'}
                      </div>
                    )}
                    <div className="p-1.5">
                      <p className="text-[10px] text-slate-400 truncate">{f.originalName}</p>
                      <p className="text-[10px] text-slate-600">{formatBytes(f.size)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-60 flex-shrink-0">
            <Card className="p-4 space-y-3">
              <p className="text-xs font-bold text-white truncate">{selected.originalName}</p>
              {isImage(selected.mimeType) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.url} alt={selected.alt || ''} className="w-full rounded-lg" />
              )}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Type</span><Badge>{selected.mimeType.split('/')[1]}</Badge></div>
                <div className="flex justify-between"><span className="text-slate-500">Size</span><span className="text-slate-300">{formatBytes(selected.size)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Folder</span><span className="text-slate-300">{selected.folder}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="text-slate-300">{new Date(selected.uploadedAt).toLocaleDateString()}</span></div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-slate-500 font-medium">URL</p>
                <div className="bg-[#0c0c14] rounded p-2 text-xs text-indigo-400 break-all select-all">{selected.url}</div>
              </div>
              <div className="flex gap-2">
                <Btn size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(selected.url).then(() => toast('Copied!'))}>Copy URL</Btn>
                <Btn size="sm" variant="danger" onClick={() => del(selected.id)}>Delete</Btn>
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
