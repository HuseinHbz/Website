import { Router } from 'express';
import { authorize } from '../../middleware/authorize';
import dashboardRouter from './dashboard/dashboard.router';
import leadsRouter from './leads/leads.router';
import consultationsRouter from './consultations/consultations.router';
import engagementsRouter from './engagements/engagements.router';
import contentRouter from './content/content.router';
import usersRouter from './users/users.router';
import rolesRouter from './roles/roles.router';
import settingsRouter from './settings/settings.router';
import auditRouter from './audit/audit.router';
import adminAiRouter from './ai/ai.router';

const router = Router();

router.use('/dashboard', dashboardRouter);
router.use('/leads', authorize('lead:read'), leadsRouter);
router.use('/consultations', authorize('consultation:read'), consultationsRouter);
router.use('/engagements', authorize('engagement:read'), engagementsRouter);
router.use('/content', authorize('content:read'), contentRouter);
router.use('/users', authorize('user:read'), usersRouter);
router.use('/roles', authorize('role:read'), rolesRouter);
router.use('/settings', authorize('settings:read'), settingsRouter);
router.use('/audit', authorize('audit:read'), auditRouter);
router.use('/ai', authorize('ai:read'), adminAiRouter);

export default router;
