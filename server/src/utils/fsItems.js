import db from '../db.js';
import { AppError } from './errors.js';

export function requireFolder(userId, folderId) {
  const folder = db
    .prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?')
    .get(folderId, userId);
  if (!folder) throw new AppError(404, 'Folder not found');
  return folder;
}

export function requireFile(userId, fileId) {
  const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(fileId, userId);
  if (!file) throw new AppError(404, 'File not found');
  return file;
}

export function folderNameTaken(userId, parentId, name, ignoreId = null) {
  const row = db
    .prepare(
      `SELECT id FROM folders
       WHERE user_id = ? AND parent_id IS ? AND name = ? COLLATE NOCASE AND id IS NOT ?`
    )
    .get(userId, parentId, name, ignoreId);
  return !!row;
}

export function fileNameTaken(userId, folderId, name, ignoreId = null) {
  const row = db
    .prepare(
      `SELECT id FROM files
       WHERE user_id = ? AND folder_id IS ? AND name = ? COLLATE NOCASE AND id IS NOT ? AND deleted_at IS NULL`
    )
    .get(userId, folderId, name, ignoreId);
  return !!row;
}

// "photo.jpg" -> "photo (1).jpg" when the name is already used in that folder
export function uniqueFileName(userId, folderId, name) {
  if (!fileNameTaken(userId, folderId, name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let n = 1;
  while (fileNameTaken(userId, folderId, `${base} (${n})${ext}`)) n++;
  return `${base} (${n})${ext}`;
}

export function getBreadcrumbs(userId, folderId) {
  const crumbs = [];
  let current = folderId;
  while (current) {
    const f = db
      .prepare('SELECT id, name, parent_id FROM folders WHERE id = ? AND user_id = ?')
      .get(current, userId);
    if (!f) break;
    crumbs.unshift({ id: f.id, name: f.name });
    current = f.parent_id;
  }
  return crumbs;
}

export const mapFolder = (f) => ({
  id: f.id,
  name: f.name,
  parentId: f.parent_id,
  createdAt: f.created_at,
  updatedAt: f.updated_at,
});

export const mapFile = (f) => ({
  id: f.id,
  name: f.name,
  folderId: f.folder_id,
  mimeType: f.mime_type,
  size: f.size,
  createdAt: f.created_at,
  updatedAt: f.updated_at,
  deletedAt: f.deleted_at ?? null,
});
