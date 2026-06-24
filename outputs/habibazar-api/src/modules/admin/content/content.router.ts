import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ContentStatus } from '../../../lib/enums';
import { createContentRouter } from '../../content/resource.factory';
import { authorize } from '../../../middleware/authorize';
import { auditLog } from '../../../middleware/audit';
import { ok } from '../../../lib/http';
import prisma from '../../../db/prisma';
import { NotFoundError } from '../../../lib/errors';

const router = Router();

// ── Service schemas ──────────────────────────────────────────────────────────
const serviceCreateSchema = z.object({
  slug: z.string().min(1).max(255),
  titleFa: z.string().min(1).max(255),
  titleEn: z.string().min(1).max(255),
  descriptionFa: z.string().min(1),
  descriptionEn: z.string().min(1),
  icon: z.string().max(255).optional(),
  status: z.nativeEnum(ContentStatus).default(ContentStatus.DRAFT),
  sortOrder: z.number().int().default(0),
});
const serviceUpdateSchema = serviceCreateSchema.partial();

// ── CaseStudy schemas ────────────────────────────────────────────────────────
const caseStudyCreateSchema = z.object({
  slug: z.string().min(1).max(255),
  titleFa: z.string().min(1).max(255),
  titleEn: z.string().min(1).max(255),
  summaryFa: z.string().min(1),
  summaryEn: z.string().min(1),
  bodyFa: z.string().min(1),
  bodyEn: z.string().min(1),
  coverImage: z.string().url().optional(),
  clientName: z.string().max(255).optional(),
  industry: z.string().max(255).optional(),
  status: z.nativeEnum(ContentStatus).default(ContentStatus.DRAFT),
  featured: z.boolean().default(false),
  publishedAt: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
});
const caseStudyUpdateSchema = caseStudyCreateSchema.partial();

// ── Post schemas ─────────────────────────────────────────────────────────────
const postCreateSchema = z.object({
  slug: z.string().min(1).max(255),
  titleFa: z.string().min(1).max(255),
  titleEn: z.string().min(1).max(255),
  summaryFa: z.string().min(1),
  summaryEn: z.string().min(1),
  bodyFa: z.string().min(1),
  bodyEn: z.string().min(1),
  coverImage: z.string().url().optional(),
  authorId: z.string().uuid().optional(),
  status: z.nativeEnum(ContentStatus).default(ContentStatus.DRAFT),
  publishedAt: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
});
const postUpdateSchema = postCreateSchema.partial();

// ── Page schemas ─────────────────────────────────────────────────────────────
const pageCreateSchema = z.object({
  slug: z.string().min(1).max(255),
  titleFa: z.string().min(1).max(255),
  titleEn: z.string().min(1).max(255),
  bodyFa: z.string().min(1),
  bodyEn: z.string().min(1),
  status: z.nativeEnum(ContentStatus).default(ContentStatus.DRAFT),
});
const pageUpdateSchema = pageCreateSchema.partial();

// ── Glossary schemas ─────────────────────────────────────────────────────────
const glossaryCreateSchema = z.object({
  slug: z.string().min(1).max(255),
  termFa: z.string().min(1).max(255),
  termEn: z.string().min(1).max(255),
  definitionFa: z.string().min(1),
  definitionEn: z.string().min(1),
});
const glossaryUpdateSchema = glossaryCreateSchema.partial();

// ── Category schemas ─────────────────────────────────────────────────────────
const categoryCreateSchema = z.object({
  slug: z.string().min(1).max(255),
  nameFa: z.string().min(1).max(255),
  nameEn: z.string().min(1).max(255),
  parentId: z.string().uuid().optional(),
});
const categoryUpdateSchema = categoryCreateSchema.partial();

// ── Tag schemas ───────────────────────────────────────────────────────────────
const tagCreateSchema = z.object({
  slug: z.string().min(1).max(255),
  nameFa: z.string().min(1).max(255),
  nameEn: z.string().min(1).max(255),
});
const tagUpdateSchema = tagCreateSchema.partial();

// ── Technology schemas ────────────────────────────────────────────────────────
const techCreateSchema = z.object({
  slug: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  logo: z.string().url().optional(),
});
const techUpdateSchema = techCreateSchema.partial();

// ── Certification schemas ────────────────────────────────────────────────────
const certCreateSchema = z.object({
  name: z.string().min(1).max(255),
  issuer: z.string().min(1).max(255),
  issuedAt: z.string().datetime().transform(v => new Date(v)),
  expiresAt: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  credentialUrl: z.string().url().optional(),
  verified: z.boolean().default(false),
});
const certUpdateSchema = certCreateSchema.partial();

// ── Testimonial schemas ──────────────────────────────────────────────────────
const testimonialCreateSchema = z.object({
  clientName: z.string().min(1).max(255),
  clientTitle: z.string().max(255).optional(),
  clientCompany: z.string().max(255).optional(),
  clientPhoto: z.string().url().optional(),
  bodyFa: z.string().min(1),
  bodyEn: z.string().min(1),
  consentGiven: z.boolean().default(false),
});
const testimonialUpdateSchema = testimonialCreateSchema.partial();

// ── Mount routers ─────────────────────────────────────────────────────────────
router.use('/services', createContentRouter('service', serviceCreateSchema, serviceUpdateSchema, {
  searchFields: ['slug', 'titleFa', 'titleEn'],
}));

router.use('/case-studies', createContentRouter('caseStudy', caseStudyCreateSchema, caseStudyUpdateSchema, {
  searchFields: ['slug', 'titleFa', 'titleEn'],
  includeRelations: { metrics: true },
}));

router.use('/posts', createContentRouter('post', postCreateSchema, postUpdateSchema, {
  searchFields: ['slug', 'titleFa', 'titleEn'],
  includeRelations: { author: { select: { id: true, name: true, email: true } } },
}));

router.use('/pages', createContentRouter('page', pageCreateSchema, pageUpdateSchema, {
  searchFields: ['slug', 'titleFa', 'titleEn'],
}));

router.use('/glossary', createContentRouter('glossaryTerm', glossaryCreateSchema, glossaryUpdateSchema, {
  searchFields: ['slug', 'termFa', 'termEn'],
}));

router.use('/categories', createContentRouter('category', categoryCreateSchema, categoryUpdateSchema, {
  softDelete: false,
  searchFields: ['slug', 'nameFa', 'nameEn'],
  includeRelations: { parent: true, children: true },
}));

router.use('/tags', createContentRouter('tag', tagCreateSchema, tagUpdateSchema, {
  softDelete: false,
  searchFields: ['slug', 'nameFa', 'nameEn'],
}));

router.use('/technologies', createContentRouter('technology', techCreateSchema, techUpdateSchema, {
  softDelete: false,
  searchFields: ['slug', 'name'],
}));

router.use('/certifications', createContentRouter('certification', certCreateSchema, certUpdateSchema, {
  softDelete: false,
}));

// Special testimonial approve endpoint
const testimonialRouter = createContentRouter('testimonial', testimonialCreateSchema, testimonialUpdateSchema, {
  softDelete: false,
});

testimonialRouter.patch(
  '/:id/approve',
  authorize('testimonial:approve'),
  auditLog('approve', 'testimonial'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const testimonial = await prisma.testimonial.findFirst({ where: { id: req.params['id'] } });
      if (!testimonial) throw new NotFoundError('Testimonial');

      const updated = await prisma.testimonial.update({
        where: { id: req.params['id'] },
        data: { approved: true },
      });
      ok(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

router.use('/testimonials', testimonialRouter);

// Media assets router
router.get('/media', authorize('content:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assets = await prisma.mediaAsset.findMany({
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    ok(res, assets);
  } catch (err) {
    next(err);
  }
});

router.delete(
  '/media/:id',
  authorize('content:delete'),
  auditLog('delete', 'media'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const asset = await prisma.mediaAsset.findFirst({ where: { id: req.params['id'] } });
      if (!asset) throw new NotFoundError('MediaAsset');
      await prisma.mediaAsset.delete({ where: { id: req.params['id'] } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
