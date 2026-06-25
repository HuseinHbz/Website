'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast } from '@/components/admin/ui'

type Category = { id: number; slug: string; nameEn: string; nameFa: string; color: string; icon: string; sortOrder: number }
type Post = {
  id?: number; slug: string; titleEn: string; titleFa: string; excerptEn: string; excerptFa: string
  contentEn: string; contentFa: string; categoryId: number | null; coverImage: string
  readTimeEn: string; readTimeFa: string; publishedAtEn: string; publishedAtFa: string
  status: 'draft' | 'published' | 'archived'; featured: boolean; views: number
}
const EMPTY_POST: Post = { slug: '', titleEn: '', titleFa: '', excerptEn: '', excerptFa: '', contentEn: '', contentFa: '', categoryId: null, coverImage: '', readTimeEn: '', readTimeFa: '', publishedAtEn: '', publishedAtFa: '', status: 'draft', featured: false, views: 0 }

export function BlogManager() {
  const [posts, setPosts] = useState<Post[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tab, setTab] = useState<'posts' | 'categories'>('posts')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Post>(EMPTY_POST)
  const [catModal, setCatModal] = useState(false)
  const [editCat, setEditCat] = useState<Partial<Category>>({})
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    const r = await fetch('/api/admin/blog')
    const d = await r.json()
    setPosts(d.posts || [])
    setCategories(d.categories || [])
  }
  useEffect(() => { load() }, [])

  async function savePost() {
    setSaving(true)
    const res = await fetch('/api/admin/blog', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false)
    if (res.ok) { toast('Saved'); setModal(false); load() } else toast('Failed', 'error')
  }

  async function delPost(id: number) {
    if (!confirm('Delete this post?')) return
    await fetch('/api/admin/blog', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast('Deleted'); load()
  }

  async function saveCat() {
    setSaving(true)
    const res = await fetch('/api/admin/blog/categories', { method: editCat.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editCat) })
    setSaving(false)
    if (res.ok) { toast('Saved'); setCatModal(false); load() } else toast('Failed', 'error')
  }

  function set<K extends keyof Post>(k: K, v: Post[K]) { setEditing((e) => ({ ...e, [k]: v })) }

  const statusColor: Record<string, string> = { published: 'green', draft: 'yellow', archived: 'slate' }

  const openEditPost = async (post: Post) => {
    // load full content
    const r = await fetch(`/api/admin/blog/${post.id}`)
    const full = await r.json()
    setEditing(full)
    setModal(true)
  }

  return (
    <>
      <ToastContainer />
      <PageHeader
        title="Blog"
        action={
          <div className="flex gap-2">
            <div className="flex rounded-lg bg-[#0c0c14] border border-[#2a2a3e] overflow-hidden">
              <button onClick={() => setTab('posts')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${tab === 'posts' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Posts</button>
              <button onClick={() => setTab('categories')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${tab === 'categories' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Categories</button>
            </div>
            {tab === 'posts' ? (
              <Btn onClick={() => { setEditing(EMPTY_POST); setModal(true) }}>+ New Post</Btn>
            ) : (
              <Btn onClick={() => { setEditCat({ nameEn: '', nameFa: '', slug: '', icon: '', color: '#6366f1', sortOrder: 0 }); setCatModal(true) }}>+ New Category</Btn>
            )}
          </div>
        }
      />

      {tab === 'posts' ? (
        <Card>
          <Table headers={['Title', 'Category', 'Status', 'Views', 'Date', 'Actions']}>
            {posts.map((p) => (
              <TR key={p.id}>
                <TD>
                  <div className="font-medium text-white">{p.titleEn}</div>
                  <div className="text-xs text-slate-500 truncate max-w-48">{p.titleFa}</div>
                </TD>
                <TD className="text-slate-400">{categories.find((c) => c.id === p.categoryId)?.nameEn || '—'}</TD>
                <TD><Badge color={statusColor[p.status]}>{p.status}</Badge></TD>
                <TD className="text-slate-500">{p.views}</TD>
                <TD className="text-xs text-slate-500">{p.publishedAtEn}</TD>
                <TD>
                  <div className="flex gap-2">
                    <Btn size="sm" variant="secondary" onClick={() => openEditPost(p)}>Edit</Btn>
                    <Btn size="sm" variant="danger" onClick={() => delPost(p.id!)}>Del</Btn>
                  </div>
                </TD>
              </TR>
            ))}
          </Table>
        </Card>
      ) : (
        <Card>
          <Table headers={['Category', 'Slug', 'Icon', 'Color', 'Order', 'Actions']}>
            {categories.map((c) => (
              <TR key={c.id}>
                <TD><div className="font-medium text-white">{c.nameEn}</div><div className="text-xs text-slate-500">{c.nameFa}</div></TD>
                <TD className="text-slate-500 font-mono text-xs">{c.slug}</TD>
                <TD>{c.icon}</TD>
                <TD><span className="inline-block w-3 h-3 rounded-full" style={{ background: c.color }} /></TD>
                <TD className="text-slate-500">{c.sortOrder}</TD>
                <TD>
                  <Btn size="sm" variant="secondary" onClick={() => { setEditCat(c); setCatModal(true) }}>Edit</Btn>
                </TD>
              </TR>
            ))}
          </Table>
        </Card>
      )}

      {/* Post Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? 'Edit Post' : 'New Post'} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Slug *" value={editing.slug} onChange={(v) => set('slug', v)} placeholder="mikrotik-ospf-guide" />
            <Select label="Category" value={String(editing.categoryId || '')} onChange={(v) => set('categoryId', v ? Number(v) : null)} options={[{ value: '', label: '— None —' }, ...categories.map((c) => ({ value: String(c.id), label: c.nameEn }))]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Title (EN)" value={editing.titleEn} onChange={(v) => set('titleEn', v)} />
            <Input label="Title (FA)" value={editing.titleFa} onChange={(v) => set('titleFa', v)} />
            <Input label="Excerpt (EN)" value={editing.excerptEn} onChange={(v) => set('excerptEn', v)} multiline rows={2} />
            <Input label="Excerpt (FA)" value={editing.excerptFa} onChange={(v) => set('excerptFa', v)} multiline rows={2} />
            <Input label="Content (EN) — Markdown" value={editing.contentEn} onChange={(v) => set('contentEn', v)} multiline rows={6} />
            <Input label="Content (FA) — Markdown" value={editing.contentFa} onChange={(v) => set('contentFa', v)} multiline rows={6} />
            <Input label="Read Time (EN)" value={editing.readTimeEn} onChange={(v) => set('readTimeEn', v)} placeholder="12 min read" />
            <Input label="Read Time (FA)" value={editing.readTimeFa} onChange={(v) => set('readTimeFa', v)} placeholder="۱۲ دقیقه مطالعه" />
            <Input label="Published Date (EN)" value={editing.publishedAtEn} onChange={(v) => set('publishedAtEn', v)} placeholder="Jan 2025" />
            <Input label="Published Date (FA)" value={editing.publishedAtFa} onChange={(v) => set('publishedAtFa', v)} placeholder="دی ۱۴۰۳" />
          </div>
          <Input label="Cover Image URL" value={editing.coverImage} onChange={(v) => set('coverImage', v)} />
          <div className="grid grid-cols-3 gap-4">
            <Select label="Status" value={editing.status} onChange={(v) => set('status', v as Post['status'])} options={[{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }]} />
            <Select label="Featured" value={editing.featured ? 'true' : 'false'} onChange={(v) => set('featured', v === 'true')} options={[{ value: 'false', label: 'Regular' }, { value: 'true', label: '★ Featured' }]} />
          </div>
          <div className="flex gap-3">
            <Btn onClick={savePost} disabled={saving}>{saving ? 'Saving...' : 'Save Post'}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>

      {/* Category Modal */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title={editCat.id ? 'Edit Category' : 'New Category'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Slug *" value={editCat.slug || ''} onChange={(v) => setEditCat({ ...editCat, slug: v })} />
            <Input label="Icon (emoji)" value={editCat.icon || ''} onChange={(v) => setEditCat({ ...editCat, icon: v })} />
            <Input label="Name (EN)" value={editCat.nameEn || ''} onChange={(v) => setEditCat({ ...editCat, nameEn: v })} />
            <Input label="Name (FA)" value={editCat.nameFa || ''} onChange={(v) => setEditCat({ ...editCat, nameFa: v })} />
            <Input label="Color" type="color" value={editCat.color || '#6366f1'} onChange={(v) => setEditCat({ ...editCat, color: v })} />
            <Input label="Sort Order" type="number" value={String(editCat.sortOrder || 0)} onChange={(v) => setEditCat({ ...editCat, sortOrder: Number(v) })} />
          </div>
          <div className="flex gap-3">
            <Btn onClick={saveCat} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Btn>
            <Btn variant="secondary" onClick={() => setCatModal(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
