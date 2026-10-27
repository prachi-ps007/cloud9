import { z } from 'zod';

// File / folder names: no slashes, no null bytes, not "." or ".."
export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(255, 'Name is too long')
  .refine((n) => !/[\\/\0]/.test(n) && n !== '.' && n !== '..', 'Name contains invalid characters');

export const idSchema = z.coerce.number().int().positive();

export const nullableId = z.number().int().positive().nullable();

// Reads ?folderId= from a query string. Missing / "root" / "null" => null (root)
export function parseFolderId(value) {
  if (value === undefined || value === null || value === '' || value === 'root' || value === 'null') {
    return null;
  }
  return idSchema.parse(value);
}
