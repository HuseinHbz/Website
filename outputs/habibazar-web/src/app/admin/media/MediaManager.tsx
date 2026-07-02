'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, Btn, PageHeader, Badge, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type MediaFile = { id: number; filename: string; originalName: string; mimeType: string; size: number; url: string; folder: string; alt: string; uploadedAt: string }

const FOLDERS = ['general', 'blog', 'projects', 'clients', 'logos', 'avatars', 'profile', 'certifications']

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(mime: string) { return mime.startsWith('image/') }
function fileIcon(mime: string) {
  if (mime.includes('pdf')) return '📄'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  if (mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('csv')) return '📊'
  if (mime.includes('powerpoint') || mime.includes('presentation')) return '📋'
  if (mime.includes('video')) return '🎬'
  if (mime.includes('audio')) return '🎵'
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar')) return '🗜️'
  if (mime.includes('text') || mime.includes('markdown')) return '📃'
  return '📎'
}
function fileColor(mime: string) {
  if (mime.includes('pdf')) return '#ef4444'
  if (mime.includes('word') || mime.includes('document')) return '#3b82f6'
  if (mime.includes('excel') || mime.includes('spreadsheet')) return '#22c55e'
  if (mime.includes('powerpoint') || mime.includes('presentation')) return '#f97316'
  if (mime.includes('video')) return '#a855f7'
  if (mime.includes('audio')) return '#06b6d4'
  return '#64748b'
}

export function MediaManager() {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [folder, setFolder] = useState('general')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<MediaFile | null>(null)
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set())
  const { toast, ToastContainer } = useToast()

  async function load() {
    const r = await fetch(`/api/admin/media?folder=${folder}`)
    setFiles(await r.json())
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: reload on folder change only
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- upload is stable
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
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-disabled mb-2">Folders</p>
            {FOLDERS.map((f) => (
              <button
                key={f}
                onClick={() => setFolder(f)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm mb-0.5 transition-colors ${folder === f ? 'bg-brand/20 text-brand' : 'text-text-secondary hover:bg-white/5'}`}
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
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragging ? 'border-brand bg-brand/10' : 'border-border hover:border-brand/50'}`}
          >
            <div className="text-3xl mb-2">▤</div>
            <p className="text-text-secondary text-sm mb-3">Drag & drop files here, or</p>
            <label className="cursor-pointer">
              <span className="bg-brand hover:bg-brand text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                {uploading ? 'Uploading...' : 'Browse Files'}
              </span>
              <input
                type="file"
                multiple
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.ppt,.pptx,.txt,.md,.csv,.zip,.rar,.7z"
                onChange={(e) => e.target.files && upload(e.target.files)}
              />
            </label>
            <p className="text-text-disabled text-xs mt-2">Images (PNG/JPG/WebP/SVG) · Video · Audio · PDF · Word · Excel · PowerPoint · ZIP</p>
          </div>

          {/* File grid */}
          <Card>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="text-sm text-text-secondary">{files.length} files in /{folder}</span>
            </div>
            {files.length === 0 ? (
              <div className="text-center py-12 text-text-disabled">No files in this folder yet</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 p-4">
                {files.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setSelected(f === selected ? null : f)}
                    className={`group cursor-pointer rounded-lg overflow-hidden border transition-all ${selected?.id === f.id ? 'border-brand' : 'border-border hover:border-border'}`}
                  >
                    {isImage(f.mimeType) && !imgErrors.has(f.id) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.url.startsWith('/') ? f.url : `/${f.url}`} alt={f.alt || f.originalName} className="w-full h-20 object-cover bg-surface"
                        onError={() => setImgErrors(prev => new Set(prev).add(f.id))} />
                    ) : null}
                    {(!isImage(f.mimeType) || imgErrors.has(f.id)) && (
                      <div className="w-full h-20 flex flex-col items-center justify-center gap-1"
                        style={{ background:`linear-gradient(135deg, #0c0c1e, #111128)`, borderBottom:`2px solid ${fileColor(f.mimeType)}33` }}>
                        <span className="text-2xl">{fileIcon(f.mimeType)}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: fileColor(f.mimeType) }}>
                          {f.mimeType.split('/')[1]?.split('.').pop()?.slice(0,8) || 'FILE'}
                        </span>
                      </div>
                    )}
                    <div className="p-1.5">
                      <p className="text-[10px] text-text-secondary truncate">{f.originalName}</p>
                      <p className="text-[10px] text-text-disabled">{formatBytes(f.size)}</p>
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
                <img src={selected.url.startsWith('/') ? selected.url : `/${selected.url}`} alt={selected.alt || ''} className="w-full rounded-lg bg-background" />
              )}
              {selected.mimeType.includes('pdf') && (
                <iframe src={selected.url} className="w-full rounded-lg border border-border" style={{ height: 200 }} title={selected.originalName} />
              )}
              {selected.mimeType.includes('video') && (
                <video src={selected.url} controls className="w-full rounded-lg" />
              )}
              {selected.mimeType.includes('audio') && (
                <audio src={selected.url} controls className="w-full" />
              )}
              {!isImage(selected.mimeType) && !selected.mimeType.includes('pdf') && !selected.mimeType.includes('video') && !selected.mimeType.includes('audio') && (
                <div className="flex flex-col items-center justify-center gap-2 py-6 rounded-lg border border-border"
                  style={{ background:`linear-gradient(135deg, #0c0c1e, #111128)` }}>
                  <span className="text-4xl">{fileIcon(selected.mimeType)}</span>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: fileColor(selected.mimeType) }}>
                    {selected.mimeType.split('/')[1]?.split('.').pop()?.toUpperCase() || 'FILE'}
                  </span>
                  <a href={selected.url} target="_blank" rel="noreferrer"
                    className="text-xs text-brand hover:text-brand underline mt-1">
                    Open file ↗
                  </a>
                </div>
              )}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-text-tertiary">Type</span><Badge>{selected.mimeType.split('/')[1]}</Badge></div>
                <div className="flex justify-between"><span className="text-text-tertiary">Size</span><span className="text-text-primary">{formatBytes(selected.size)}</span></div>
                <div className="flex justify-between"><span className="text-text-tertiary">Folder</span><span className="text-text-primary">{selected.folder}</span></div>
                <div className="flex justify-between"><span className="text-text-tertiary">Date</span><span className="text-text-primary">{new Date(selected.uploadedAt).toLocaleDateString()}</span></div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-text-tertiary font-medium">URL</p>
                <div className="bg-background rounded p-2 text-xs text-brand break-all select-all">{selected.url}</div>
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
