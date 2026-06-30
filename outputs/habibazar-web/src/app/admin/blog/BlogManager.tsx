'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'

type Category = { id: number; slug: string; nameEn: string; nameFa: string; color: string; icon: string; sortOrder: number; active: boolean }
type Post = {
  id?: number; slug: string; titleEn: string; titleFa: string; excerptEn: string; excerptFa: string
  contentEn: string; contentFa: string; categoryId: number | null; coverImage: string
  readTimeEn: string; readTimeFa: string; publishedAtEn: string; publishedAtFa: string
  status: 'draft' | 'published' | 'archived'; featured: boolean; views: number
}
const EMPTY_POST: Post = { slug: '', titleEn: '', titleFa: '', excerptEn: '', excerptFa: '', contentEn: '', contentFa: '', categoryId: null, coverImage: '', readTimeEn: '', readTimeFa: '', publishedAtEn: '', publishedAtFa: '', status: 'draft', featured: false, views: 0 }

export function BlogManager() {
  const t = useT()
  const locale = useAdminLocale()
  const isFA = locale === 'fa'
  const [posts, setPosts] = useState<Post[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tab, setTab] = useState<'posts' | 'categories'>('posts')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Post>(EMPTY_POST)
  const [catModal, setCatModal] = useState(false)
  const [editCat, setEditCat] = useState<Partial<Category>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast, ToastContainer } = useToast()

  // ── Filters ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFeatured, setFilterFeatured] = useState('')
  const [catSearch, setCatSearch] = useState('')
  const [filterCatActive, setFilterCatActive] = useState('')

  async function load() {
    const r = await fetch('/api/admin/blog')
    const d = await r.json()
    setPosts(d.posts || [])
    setCategories(d.categories || [])
  }
  useEffect(() => { load() }, [])

  // ── Filtered posts ────────────────────────────────────────────────────────
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (search && !p.titleEn.toLowerCase().includes(search.toLowerCase()) && !p.titleFa.includes(search) && !p.slug.includes(search)) return false
      if (filterCat && String(p.categoryId) !== filterCat) return false
      if (filterStatus && p.status !== filterStatus) return false
      if (filterFeatured === 'yes' && !p.featured) return false
      if (filterFeatured === 'no' && p.featured) return false
      return true
    })
  }, [posts, search, filterCat, filterStatus, filterFeatured])

  // ── Filtered categories ───────────────────────────────────────────────────
  const filteredCats = useMemo(() => {
    return categories.filter((c) => {
      if (catSearch && !c.nameEn.toLowerCase().includes(catSearch.toLowerCase()) && !c.nameFa.includes(catSearch) && !c.slug.includes(catSearch)) return false
      if (filterCatActive === 'active' && !c.active) return false
      if (filterCatActive === 'inactive' && c.active) return false
      return true
    })
  }, [categories, catSearch, filterCatActive])

  async function savePost() {
    setSaving(true)
    const { id, ...body } = editing as Post & { id?: number }
    const method = id ? 'PUT' : 'POST'
    const payload = id ? { id, ...body } : body
    const res = await fetch('/api/admin/blog', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false)
    if (res.ok) { toast(t('saved')); setModal(false); load() } else {
      const err = await res.json().catch(() => ({}))
      toast(err.error || t('failed'), 'error')
    }
  }

  async function delPost(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/blog', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted')); load()
  }

  async function togglePostStatus(p: Post) {
    const next = p.status === 'published' ? 'draft' : 'published'
    await fetch('/api/admin/blog', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, status: next }) })
    toast(t('saved')); load()
  }

  async function saveCat() {
    setSaving(true)
    const method = editCat.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/blog/categories', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editCat) })
    setSaving(false)
    if (res.ok) { toast(t('saved')); setCatModal(false); load() } else toast(t('failed'), 'error')
  }

  async function delCat(id: number) {
    if (!confirm(t('confirmDel'))) return
    const res = await fetch('/api/admin/blog/categories', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (res.ok) { toast(t('deleted')); load() } else {
      const err = await res.json().catch(() => ({}))
      toast(err.error || t('failed'), 'error')
    }
  }

  async function toggleCat(c: Category) {
    await fetch('/api/admin/blog/categories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, active: !c.active }) })
    toast(t('saved')); load()
  }

  async function uploadCoverImage(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', 'blog')
    fd.append('alt', editing.titleEn || 'blog cover')
    const res = await fetch('/api/admin/media', { method: 'POST', body: fd })
    setUploading(false)
    if (res.ok) {
      const data = await res.json()
      set('coverImage', data.url)
      toast(t('saved'))
    } else {
      toast(t('failed'), 'error')
    }
  }

  function set<K extends keyof Post>(k: K, v: Post[K]) { setEditing((e) => ({ ...e, [k]: v })) }

  const statusColor: Record<string, string> = { published: 'green', draft: 'yellow', archived: 'slate' }
  const statusLabel: Record<string, string> = { published: t('published'), draft: t('draft'), archived: t('archived') }

  const openEditPost = async (post: Post) => {
    const r = await fetch(`/api/admin/blog/${post.id}`)
    const full = await r.json()
    setEditing(full)
    setModal(true)
  }

  const hasPostFilters = search || filterCat || filterStatus || filterFeatured

  return (
    <>
      <ToastContainer />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadCoverImage(e.target.files[0]) }} />
      <PageHeader
        title={t('blogTitle')}
        action={
          <div className="flex gap-2">
            <div className="flex rounded-lg bg-[#0c0c14] border border-[#2a2a3e] overflow-hidden">
              <button onClick={() => setTab('posts')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${tab === 'posts' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>{t('blogPosts')}</button>
              <button onClick={() => setTab('categories')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${tab === 'categories' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>{t('blogCats')}</button>
            </div>
            {tab === 'posts' ? (
              <Btn onClick={() => { setEditing(EMPTY_POST); setModal(true) }}>{t('postNew')}</Btn>
            ) : (
              <Btn onClick={() => { setEditCat({ nameEn: '', nameFa: '', slug: '', icon: '', color: '#6366f1', sortOrder: 0, active: true }); setCatModal(true) }}>{t('catNew')}</Btn>
            )}
          </div>
        }
      />

      {tab === 'posts' ? (
        <>
          {/* ── Filter Bar ── */}
          <div className="mb-4 rounded-xl border border-[#2a2a3e] bg-[#0f0f1a] p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-slate-400 mb-1.5">{isFA ? 'جستجو' : 'Search'}</label>
                <div className="relative">
                  <span className={`absolute top-1/2 -translate-y-1/2 text-slate-500 text-sm ${isFA ? 'right-3' : 'left-3'}`}>🔍</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={isFA ? 'عنوان یا slug...' : 'title or slug...'}
                    className={`w-full bg-[#0c0c14] border border-[#2a2a3e] rounded-lg py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 ${isFA ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                  />
                </div>
              </div>
              <div className="w-44">
                <label className="block text-xs text-slate-400 mb-1.5">{isFA ? 'دسته‌بندی' : 'Category'}</label>
                <select
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value)}
                  className="w-full bg-[#0c0c14] border border-[#2a2a3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">{isFA ? 'همه دسته‌ها' : 'All categories'}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.icon || ''} {isFA ? c.nameFa : c.nameEn}</option>
                  ))}
                </select>
              </div>
              <div className="w-36">
                <label className="block text-xs text-slate-400 mb-1.5">{isFA ? 'وضعیت' : 'Status'}</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-[#0c0c14] border border-[#2a2a3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">{isFA ? 'همه' : 'All'}</option>
                  <option value="published">{t('published')}</option>
                  <option value="draft">{t('draft')}</option>
                  <option value="archived">{t('archived')}</option>
                </select>
              </div>
              <div className="w-36">
                <label className="block text-xs text-slate-400 mb-1.5">{isFA ? 'ویژه' : 'Featured'}</label>
                <select
                  value={filterFeatured}
                  onChange={(e) => setFilterFeatured(e.target.value)}
                  className="w-full bg-[#0c0c14] border border-[#2a2a3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">{isFA ? 'همه' : 'All'}</option>
                  <option value="yes">{isFA ? '★ ویژه' : '★ Featured'}</option>
                  <option value="no">{isFA ? 'عادی' : 'Regular'}</option>
                </select>
              </div>
              <div className={`flex items-end gap-2 ${isFA ? 'mr-auto' : 'ml-auto'}`}>
                {hasPostFilters && (
                  <button
                    onClick={() => { setSearch(''); setFilterCat(''); setFilterStatus(''); setFilterFeatured('') }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-400 border border-[#2a2a3e] hover:border-red-500 hover:text-red-400 transition-colors"
                  >
                    ✕ {isFA ? 'پاک کردن' : 'Clear'}
                  </button>
                )}
                <span className="text-xs text-slate-500 py-2 px-1 whitespace-nowrap">
                  {filteredPosts.length} / {posts.length} {isFA ? 'پست' : 'posts'}
                </span>
              </div>
            </div>
          </div>

          <Card>
            <Table headers={[t('title'), t('category'), t('status'), t('views'), t('date'), t('actions')]}>
              {filteredPosts.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <div className="font-medium text-white flex items-center gap-1">
                      {p.featured && <span className="text-yellow-400 text-xs">★</span>}
                      {p.titleEn}
                    </div>
                    <div className="text-xs text-slate-500 truncate max-w-48">{p.titleFa}</div>
                  </TD>
                  <TD>
                    {(() => {
                      const cat = categories.find((c) => c.id === p.categoryId)
                      return cat ? (
                        <span className="flex items-center gap-1 text-sm">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: cat.color }} />
                          <span className="text-slate-300">{cat.nameEn}</span>
                        </span>
                      ) : <span className="text-slate-600">—</span>
                    })()}
                  </TD>
                  <TD><Badge color={statusColor[p.status]}>{statusLabel[p.status] || p.status}</Badge></TD>
                  <TD className="text-slate-500">{p.views}</TD>
                  <TD className="text-xs text-slate-500">{p.publishedAtEn}</TD>
                  <TD>
                    <div className="flex gap-2">
                      <Btn size="sm" variant="secondary" onClick={() => openEditPost(p)}>{t('edit')}</Btn>
                      <Btn size="sm" variant="secondary" onClick={() => togglePostStatus(p)}>
                        {p.status === 'published' ? '⏸' : '▶'}
                      </Btn>
                      <Btn size="sm" variant="danger" onClick={() => delPost(p.id!)}>{t('delete')}</Btn>
                    </div>
                  </TD>
                </TR>
              ))}
              {filteredPosts.length === 0 && (
                <TR><TD colSpan={6} className="text-center text-slate-500 py-8">نتیجه‌ای یافت نشد</TD></TR>
              )}
            </Table>
          </Card>
        </>
      ) : (
        <>
          {/* ── Category Filter Bar ── */}
          <div className="mb-4 rounded-xl border border-[#2a2a3e] bg-[#0f0f1a] p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-slate-400 mb-1.5">{isFA ? 'جستجو' : 'Search'}</label>
                <div className="relative">
                  <span className={`absolute top-1/2 -translate-y-1/2 text-slate-500 text-sm ${isFA ? 'right-3' : 'left-3'}`}>🔍</span>
                  <input
                    value={catSearch}
                    onChange={(e) => setCatSearch(e.target.value)}
                    placeholder={isFA ? 'نام یا slug...' : 'name or slug...'}
                    className={`w-full bg-[#0c0c14] border border-[#2a2a3e] rounded-lg py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 ${isFA ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                  />
                </div>
              </div>
              <div className="w-36">
                <label className="block text-xs text-slate-400 mb-1.5">{isFA ? 'وضعیت' : 'Status'}</label>
                <select
                  value={filterCatActive}
                  onChange={(e) => setFilterCatActive(e.target.value)}
                  className="w-full bg-[#0c0c14] border border-[#2a2a3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">{isFA ? 'همه' : 'All'}</option>
                  <option value="active">{isFA ? 'فعال' : 'Active'}</option>
                  <option value="inactive">{isFA ? 'غیرفعال' : 'Inactive'}</option>
                </select>
              </div>
              <div className={`flex items-end gap-2 ${isFA ? 'mr-auto' : 'ml-auto'}`}>
                {(catSearch || filterCatActive) && (
                  <button
                    onClick={() => { setCatSearch(''); setFilterCatActive('') }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-400 border border-[#2a2a3e] hover:border-red-500 hover:text-red-400 transition-colors"
                  >
                    ✕ {isFA ? 'پاک کردن' : 'Clear'}
                  </button>
                )}
                <span className="text-xs text-slate-500 py-2 px-1 whitespace-nowrap">
                  {filteredCats.length} / {categories.length} {isFA ? 'دسته' : 'cats'}
                </span>
              </div>
            </div>
          </div>

          <Card>
            <Table headers={[t('category'), t('slug'), t('icon'), t('color'), t('sortOrder'), 'پست‌ها', 'وضعیت', t('actions')]}>
              {filteredCats.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <div className="font-medium text-white">{c.nameEn}</div>
                    <div className="text-xs text-slate-500">{c.nameFa}</div>
                  </TD>
                  <TD className="text-slate-500 font-mono text-xs">{c.slug}</TD>
                  <TD>{c.icon}</TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-full" style={{ background: c.color }} />
                      <span className="text-xs text-slate-500 font-mono">{c.color}</span>
                    </span>
                  </TD>
                  <TD className="text-slate-500">{c.sortOrder}</TD>
                  <TD className="text-slate-400 text-sm">{posts.filter((p) => p.categoryId === c.id).length}</TD>
                  <TD>
                    <Badge color={c.active ? 'green' : 'slate'}>{c.active ? 'فعال' : 'غیرفعال'}</Badge>
                  </TD>
                  <TD>
                    <div className="flex gap-2">
                      <Btn size="sm" variant="secondary" onClick={() => { setEditCat(c); setCatModal(true) }}>{t('edit')}</Btn>
                      <Btn size="sm" variant="secondary" onClick={() => toggleCat(c)}>
                        {c.active ? '⏸' : '▶'}
                      </Btn>
                      <Btn size="sm" variant="danger" onClick={() => delCat(c.id)}>
                        {t('delete')}
                      </Btn>
                    </div>
                  </TD>
                </TR>
              ))}
              {filteredCats.length === 0 && (
                <TR><TD colSpan={8} className="text-center text-slate-500 py-8">نتیجه‌ای یافت نشد</TD></TR>
              )}
            </Table>
          </Card>
        </>
      )}

      {/* Post Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('postEdit') : t('postNew')} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={`${t('slug')} *`} value={editing.slug} onChange={(v) => set('slug', v)} placeholder="mikrotik-ospf-guide" />
            <Select label={t('category')} value={String(editing.categoryId || '')} onChange={(v) => set('categoryId', v ? Number(v) : null)} options={[{ value: '', label: '— None —' }, ...categories.map((c) => ({ value: String(c.id), label: `${c.icon || ''} ${c.nameEn}` }))]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('titleEng')} value={editing.titleEn} onChange={(v) => set('titleEn', v)} />
            <Input label={t('titlePer')} value={editing.titleFa} onChange={(v) => set('titleFa', v)} />
            <Input label={t('excerptEn')} value={editing.excerptEn} onChange={(v) => set('excerptEn', v)} multiline rows={2} />
            <Input label={t('excerptFa')} value={editing.excerptFa} onChange={(v) => set('excerptFa', v)} multiline rows={2} />
            <Input label={t('contentEn')} value={editing.contentEn} onChange={(v) => set('contentEn', v)} multiline rows={6} />
            <Input label={t('contentFa')} value={editing.contentFa} onChange={(v) => set('contentFa', v)} multiline rows={6} />
            <Input label={t('readTimeEn')} value={editing.readTimeEn} onChange={(v) => set('readTimeEn', v)} placeholder="12 min read" />
            <Input label={t('readTimeFa')} value={editing.readTimeFa} onChange={(v) => set('readTimeFa', v)} placeholder="۱۲ دقیقه مطالعه" />
            <Input label={t('pubDateEn')} value={editing.publishedAtEn} onChange={(v) => set('publishedAtEn', v)} placeholder="Jan 2025" />
            <Input label={t('pubDateFa')} value={editing.publishedAtFa} onChange={(v) => set('publishedAtFa', v)} placeholder="دی ۱۴۰۳" />
          </div>
          <div className="space-y-2">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input label={t('coverImg')} value={editing.coverImage} onChange={(v) => set('coverImage', v)} />
              </div>
              <Btn variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? t('saving') : `↑ ${t('uploadFiles')}`}
              </Btn>
            </div>
            {editing.coverImage && (
              <img src={editing.coverImage} alt="cover" className="h-24 rounded-lg object-cover border border-[#2a2a3e]" />
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label={t('status')} value={editing.status} onChange={(v) => set('status', v as Post['status'])} options={[{ value: 'draft', label: t('draft') }, { value: 'published', label: t('published') }, { value: 'archived', label: t('archived') }]} />
            <Select label={t('featured')} value={editing.featured ? 'true' : 'false'} onChange={(v) => set('featured', v === 'true')} options={[{ value: 'false', label: t('regular') }, { value: 'true', label: `★ ${t('featured')}` }]} />
          </div>
          <div className="flex gap-3">
            <Btn onClick={savePost} disabled={saving}>{saving ? t('saving') : t('save')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      </Modal>

      {/* Category Modal */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title={editCat.id ? t('catEdit') : t('catNew')} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={`${t('slug')} *`} value={editCat.slug || ''} onChange={(v) => setEditCat({ ...editCat, slug: v })} />
            <Input label={t('icon')} value={editCat.icon || ''} onChange={(v) => setEditCat({ ...editCat, icon: v })} placeholder="📡" />
            <Input label={t('nameEn')} value={editCat.nameEn || ''} onChange={(v) => setEditCat({ ...editCat, nameEn: v })} />
            <Input label={t('nameFa')} value={editCat.nameFa || ''} onChange={(v) => setEditCat({ ...editCat, nameFa: v })} />
            <Input label={t('color')} type="color" value={editCat.color || '#6366f1'} onChange={(v) => setEditCat({ ...editCat, color: v })} />
            <Input label={t('sortOrder')} type="number" value={String(editCat.sortOrder || 0)} onChange={(v) => setEditCat({ ...editCat, sortOrder: Number(v) })} />
          </div>
          <Select
            label="وضعیت"
            value={editCat.active === false ? 'false' : 'true'}
            onChange={(v) => setEditCat({ ...editCat, active: v === 'true' })}
            options={[{ value: 'true', label: 'فعال' }, { value: 'false', label: 'غیرفعال' }]}
          />
          <div className="flex gap-3">
            <Btn onClick={saveCat} disabled={saving}>{saving ? t('saving') : t('save')}</Btn>
            <Btn variant="secondary" onClick={() => setCatModal(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
