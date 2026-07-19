import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { clientIp } from '@/lib/api/clientIp'
import { ENTITY_TYPES, ENTITY_SPECS, templateCsv, type EntityType } from '@/lib/import/engine'
import {
  createJob, listJobs, getJob, saveJobMapping, validateJob, approveJob, executeJob, rollbackJob,
  listTemplates, saveTemplate, deleteTemplate, listMappings, saveMappingProfile, importAnalytics,
} from '@/lib/import/importData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — Import Center views: ?view=jobs|job&id=|templates|mappings|analytics|specs
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const sp = req.nextUrl.searchParams
  try {
    const view = sp.get('view') ?? 'jobs'
    if (view === 'jobs') return NextResponse.json({ jobs: await listJobs() })
    if (view === 'job') {
      const id = Number(sp.get('id'))
      if (!id) return badRequest('id required')
      return NextResponse.json(await getJob(id))
    }
    if (view === 'templates') return NextResponse.json({ templates: await listTemplates(), specs: ENTITY_SPECS })
    if (view === 'template-csv') {
      const entity = sp.get('entity') as EntityType
      if (!ENTITY_TYPES.includes(entity)) return badRequest('Unknown entity')
      return new NextResponse(templateCsv(entity) + '\n', { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${entity}-template.csv"` } })
    }
    if (view === 'mappings') return NextResponse.json({ mappings: await listMappings(sp.get('entity') ?? undefined) })
    if (view === 'analytics') return NextResponse.json({ analytics: await importAnalytics() })
    return badRequest('Unknown view')
  } catch (e) { return apiError(e, 'Failed to load import data') }
}

const actionSchema = z.object({
  action: z.enum(['map', 'validate', 'approve', 'execute', 'rollback', 'template.save', 'template.delete', 'mapping.save']),
  id: z.number().int().positive().optional(),
  fields: z.record(z.string(), z.string()).optional(),
  resolution: z.enum(['block', 'skip', 'update']).optional(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  name: z.string().max(200).optional(),
  sourceSystem: z.string().max(60).optional(),
  templateFields: z.array(z.string().max(60)).max(60).optional(),
  dryRun: z.boolean().optional(),
})

// POST — multipart/form-data = upload (job.create); JSON = pipeline actions.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const ip = clientIp(req)
  try {
    const ctype = req.headers.get('content-type') ?? ''
    if (ctype.includes('multipart/form-data')) {
      const fd = await req.formData()
      const file = fd.get('file') as File | null
      const entityType = String(fd.get('entityType') ?? '') as EntityType
      const name = String(fd.get('name') ?? '').trim()
      const sourceSystem = String(fd.get('sourceSystem') ?? '').trim() || undefined
      if (!file) return badRequest('No file provided')
      if (!ENTITY_TYPES.includes(entityType)) return badRequest('Unknown entity type')
      if (file.size > 8 * 1024 * 1024) return badRequest('File too large (max 8 MB) — split the import')
      const lower = file.name.toLowerCase()
      if (!lower.endsWith('.csv') && !lower.endsWith('.json') && !lower.endsWith('.txt') && !lower.endsWith('.xlsx')) {
        return badRequest('Unsupported format — upload XLSX, CSV or JSON')
      }
      const sheet = String(fd.get('sheet') ?? '').trim() || undefined
      const content = lower.endsWith('.xlsx') ? Buffer.from(await file.arrayBuffer()) : await file.text()
      const res = await createJob({ entityType, name: name || file.name, sourceSystem, fileName: file.name, content, sheet }, auth.user.id)
      await logAction(auth.user, 'import.job.create', 'import_job', res.id, null, { entityType, fileName: file.name, rows: res.totalRows, sheet: sheet ?? null }, ip)
      return NextResponse.json(res)
    }

    const parsed = await readJson(req, actionSchema)
    if ('error' in parsed) return parsed.error
    const d = parsed.data
    if (d.action === 'map') {
      if (!d.id || !d.fields) return badRequest('id and fields required')
      await saveJobMapping(d.id, d.fields, d.resolution ?? 'skip')
      await logAction(auth.user, 'import.job.map', 'import_job', d.id, null, { resolution: d.resolution ?? 'skip' }, ip)
      return NextResponse.json({ ok: true })
    }
    if (d.action === 'validate') {
      if (!d.id) return badRequest('id required')
      const res = await validateJob(d.id)
      await logAction(auth.user, 'import.job.validate', 'import_job', d.id, null, res, ip)
      return NextResponse.json(res)
    }
    if (d.action === 'approve') {
      if (!d.id) return badRequest('id required')
      await approveJob(d.id, auth.user)
      await logAction(auth.user, 'import.job.approve', 'import_job', d.id, null, null, ip)
      return NextResponse.json({ ok: true })
    }
    if (d.action === 'execute') {
      if (!d.id) return badRequest('id required')
      const res = await executeJob(d.id, auth.user.id, { dryRun: d.dryRun })
      await logAction(auth.user, d.dryRun ? 'import.job.dryrun' : 'import.job.execute', 'import_job', d.id, null, res, ip)
      return NextResponse.json(res)
    }
    if (d.action === 'rollback') {
      // Rollback is destructive recovery — administrator and above only.
      if (!['administrator', 'super_admin'].includes(auth.user.role)) return badRequest('Rollback requires an administrator')
      if (!d.id) return badRequest('id required')
      const res = await rollbackJob(d.id, auth.user.id)
      await logAction(auth.user, 'import.job.rollback', 'import_job', d.id, null, res, ip)
      return NextResponse.json(res)
    }
    if (d.action === 'template.save') {
      if (!d.entityType || !d.name) return badRequest('entityType and name required')
      const r = await saveTemplate({ id: d.id, entityType: d.entityType, name: d.name, fields: d.templateFields ?? ENTITY_SPECS[d.entityType].map(f => f.key) }, auth.user.id)
      await logAction(auth.user, 'import.template.save', 'import_template', r.id, null, { name: d.name }, ip)
      return NextResponse.json(r)
    }
    if (d.action === 'template.delete') {
      if (!d.id) return badRequest('id required')
      await deleteTemplate(d.id)
      await logAction(auth.user, 'import.template.delete', 'import_template', d.id, null, null, ip)
      return NextResponse.json({ ok: true })
    }
    if (d.action === 'mapping.save') {
      if (!d.entityType || !d.name || !d.fields) return badRequest('entityType, name and fields required')
      const r = await saveMappingProfile({ entityType: d.entityType, name: d.name, sourceSystem: d.sourceSystem, mapping: d.fields }, auth.user.id)
      await logAction(auth.user, 'import.mapping.save', 'import_mapping', r.id, null, { name: d.name, sourceSystem: d.sourceSystem ?? null }, ip)
      return NextResponse.json(r)
    }
    return badRequest('Unknown action')
  } catch (e) { return apiError(e, 'Import operation failed') }
}
