import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ConsultationKind, ContentStatus } from '@prisma/client';
import { validate } from '../../middleware/validate';
import { publicLimiter } from '../../middleware/rateLimit';
import { ok, created, paginated } from '../../lib/http';
import { paginationSchema } from '../../lib/validators';
import { buildPaginationMeta, buildPrismaSkipTake } from '../../lib/pagination';
import prisma from '../../db/prisma';
import * as leadsService from '../leads/leads.service';
import logger from '../../lib/logger';

const router = Router();

// Simple in-memory cache for public content
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

// POST /contact - Create lead
router.post(
  '/contact',
  publicLimiter,
  validate(leadsService.createLeadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lead = await leadsService.createLead(req.body);
      created(res, {
        id: lead.id,
        message: 'Thank you for reaching out. We will contact you soon.',
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /consultation - Create consultation request
router.post(
  '/consultation',
  publicLimiter,
  validate(leadsService.createConsultationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const consultation = await leadsService.createConsultationRequest(req.body);
      created(res, {
        id: consultation.id,
        message: 'Consultation request received. We will confirm shortly.',
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /consultation/intro-call - Specifically for intro calls
router.post(
  '/consultation/intro-call',
  publicLimiter,
  validate(leadsService.createConsultationSchema.omit({ kind: true })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const consultation = await leadsService.createConsultationRequest({
        ...req.body,
        kind: ConsultationKind.INTRO_CALL,
      });
      created(res, {
        id: consultation.id,
        message: 'Intro call request received. We will confirm shortly.',
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /subscribe
router.post(
  '/subscribe',
  publicLimiter,
  validate(leadsService.createSubscriberSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subscriber = await leadsService.createSubscriber(req.body);
      created(res, { id: subscriber.id, message: 'Subscribed successfully' });
    } catch (err) {
      next(err);
    }
  },
);

// GET /services
router.get(
  '/services',
  validate(paginationSchema.extend({ locale: z.enum(['FA', 'EN']).optional() }), 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20 } = req.query as unknown as { page: number; limit: number };
      const cacheKey = `services:${page}:${limit}`;
      const cached = getCached(cacheKey);
      if (cached) return ok(res, cached);

      const where = { status: ContentStatus.PUBLISHED, deletedAt: null };
      const [total, services] = await Promise.all([
        prisma.service.count({ where }),
        prisma.service.findMany({
          where,
          ...buildPrismaSkipTake(page, limit),
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        }),
      ]);

      const result = { items: services, meta: buildPaginationMeta(total, page, limit) };
      setCache(cacheKey, result);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /services/:slug
router.get(
  '/services/:slug',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = req.params.slug as string;
      const cacheKey = `service:${slug}`;
      const cached = getCached(cacheKey);
      if (cached) return ok(res, cached);

      const service = await prisma.service.findFirst({
        where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null },
      });

      if (!service) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Service not found' } });
        return;
      }

      setCache(cacheKey, service);
      ok(res, service);
    } catch (err) {
      next(err);
    }
  },
);

// GET /case-studies
router.get(
  '/case-studies',
  validate(paginationSchema.extend({ featured: z.coerce.boolean().optional() }), 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20, featured } = req.query as unknown as { page: number; limit: number; featured?: boolean };
      const cacheKey = `case-studies:${page}:${limit}:${featured}`;
      const cached = getCached(cacheKey);
      if (cached) return ok(res, cached);

      const where: Record<string, unknown> = { status: ContentStatus.PUBLISHED, deletedAt: null };
      if (featured !== undefined) where['featured'] = featured;

      const [total, caseStudies] = await Promise.all([
        prisma.caseStudy.count({ where }),
        prisma.caseStudy.findMany({
          where,
          ...buildPrismaSkipTake(page, limit),
          orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
          include: { metrics: true },
        }),
      ]);

      const result = { items: caseStudies, meta: buildPaginationMeta(total, page, limit) };
      setCache(cacheKey, result);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /case-studies/:slug
router.get(
  '/case-studies/:slug',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = req.params.slug as string;
      const cacheKey = `case-study:${slug}`;
      const cached = getCached(cacheKey);
      if (cached) return ok(res, cached);

      const caseStudy = await prisma.caseStudy.findFirst({
        where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null },
        include: { metrics: true },
      });

      if (!caseStudy) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case study not found' } });
        return;
      }

      setCache(cacheKey, caseStudy);
      ok(res, caseStudy);
    } catch (err) {
      next(err);
    }
  },
);

// GET /posts
router.get(
  '/posts',
  validate(paginationSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20 } = req.query as unknown as { page: number; limit: number };
      const cacheKey = `posts:${page}:${limit}`;
      const cached = getCached(cacheKey);
      if (cached) return ok(res, cached);

      const where = { status: ContentStatus.PUBLISHED, deletedAt: null };
      const [total, posts] = await Promise.all([
        prisma.post.count({ where }),
        prisma.post.findMany({
          where,
          ...buildPrismaSkipTake(page, limit),
          orderBy: { publishedAt: 'desc' },
          select: {
            id: true, slug: true, titleFa: true, titleEn: true,
            summaryFa: true, summaryEn: true, coverImage: true,
            publishedAt: true, createdAt: true,
            author: { select: { id: true, name: true } },
          },
        }),
      ]);

      const result = { items: posts, meta: buildPaginationMeta(total, page, limit) };
      setCache(cacheKey, result);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /posts/:slug
router.get(
  '/posts/:slug',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = req.params.slug as string;
      const cacheKey = `post:${slug}`;
      const cached = getCached(cacheKey);
      if (cached) return ok(res, cached);

      const post = await prisma.post.findFirst({
        where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null },
        include: { author: { select: { id: true, name: true } } },
      });

      if (!post) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Post not found' } });
        return;
      }

      setCache(cacheKey, post);
      ok(res, post);
    } catch (err) {
      next(err);
    }
  },
);

// GET /glossary
router.get(
  '/glossary',
  validate(paginationSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 50 } = req.query as unknown as { page: number; limit: number };
      const cacheKey = `glossary:${page}:${limit}`;
      const cached = getCached(cacheKey);
      if (cached) return ok(res, cached);

      const where = { deletedAt: null };
      const [total, terms] = await Promise.all([
        prisma.glossaryTerm.count({ where }),
        prisma.glossaryTerm.findMany({
          where,
          ...buildPrismaSkipTake(page, limit),
          orderBy: { termEn: 'asc' },
        }),
      ]);

      const result = { items: terms, meta: buildPaginationMeta(total, page, limit) };
      setCache(cacheKey, result);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /glossary/:slug
router.get(
  '/glossary/:slug',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = req.params.slug as string;
      const cacheKey = `glossary-term:${slug}`;
      const cached = getCached(cacheKey);
      if (cached) return ok(res, cached);

      const term = await prisma.glossaryTerm.findFirst({
        where: { slug, deletedAt: null },
      });

      if (!term) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Term not found' } });
        return;
      }

      setCache(cacheKey, term);
      ok(res, term);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
