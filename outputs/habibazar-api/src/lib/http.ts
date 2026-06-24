import { Response } from 'express';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ data });
}

export function created(res: Response, data: unknown): void {
  res.status(201).json({ data });
}

export function noContent(res: Response): void {
  res.status(204).send();
}

export function paginated(
  res: Response,
  data: unknown,
  meta: PaginationMeta,
): void {
  res.status(200).json({ data, meta });
}
