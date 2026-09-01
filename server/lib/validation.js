'use strict';

const { z } = require('zod');
const { PERSONAL_STATUSES, QUALITIES, MEDIA_TYPES } = require('./normalize');

/** Personal rating: 0..10 in 0.25 steps (server-side truth). */
const ratingSchema = z
  .number()
  .min(0)
  .max(10)
  .refine((v) => Math.abs(v * 4 - Math.round(v * 4)) < 1e-9, {
    message: 'التقييم يجب أن يكون بمضاعفات 0.25',
  });

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ يجب أن تكون YYYY-MM-DD');

const sanitizeText = (max) =>
  z
    .string()
    .max(max)
    .transform((s) =>
      s
        // strip control chars & any HTML-ish markup from user text
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/<\/?[^>]*>/g, '')
        .trim()
    );

const entryPatchSchema = z.object({
  status: z.enum(PERSONAL_STATUSES).optional(),
  rating: ratingSchema.nullable().optional(),
  quality: z.union([z.enum(QUALITIES), z.literal(''), z.null()]).optional(),
  isFavorite: z.boolean().optional(),
  notes: sanitizeText(5000).optional(),
  dateStarted: dateSchema.nullable().optional(),
  dateFinished: dateSchema.nullable().optional(),
  lastWatchedAt: z.string().max(40).nullable().optional(),
  rewatchCount: z.number().int().min(0).max(9999).optional(),
  currentSeason: z.number().int().min(0).max(999).optional(),
  currentEpisode: z.number().int().min(0).max(99999).optional(),
  tagIds: z.array(z.number().int().positive()).max(50).optional(),
});

const addToLibrarySchema = entryPatchSchema.extend({
  internalId: z.number().int().positive().optional(),
  source: z.enum(['tmdb', 'jikan', 'tvmaze', 'offline']).optional(),
  sourceType: z.string().max(20).optional(),
  sourceId: z.union([z.string().max(64), z.number()]).optional(),
});

const searchQuerySchema = z.object({
  q: z.string().min(1).max(120),
  type: z.enum(['all', ...MEDIA_TYPES]).optional().default('all'),
});

const profileSchema = z.object({
  displayName: sanitizeText(60).optional(),
  bio: sanitizeText(600).optional(),
  avatarUrl: z.string().url().max(500).or(z.literal('')).optional(),
});

const tagSchema = z.object({
  name: sanitizeText(40).refine((v) => v.length > 0, 'اسم الوسم مطلوب'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

const episodeStatusSchema = z.object({
  status: z.enum(['watched', 'watching', 'not_watched']),
});

function validate(schema, data) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const err = new Error(issue?.message || 'بيانات غير صالحة');
    err.status = 400;
    err.details = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw err;
  }
  return parsed.data;
}

module.exports = {
  validate,
  ratingSchema,
  entryPatchSchema,
  addToLibrarySchema,
  searchQuerySchema,
  profileSchema,
  tagSchema,
  episodeStatusSchema,
};
