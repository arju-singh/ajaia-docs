import sanitizeHtml from 'sanitize-html';
import { marked } from 'marked';
import mammoth from 'mammoth';
import path from 'node:path';

// Only the tags the editor can actually produce. Anything else gets dropped,
// which also keeps imported files from smuggling in scripts or styles.
const ALLOWED = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'a',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
};

export const MAX_CONTENT_BYTES = 1024 * 1024; // 1 MB of HTML is plenty for this scope
export const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.docx'];

export function cleanHtml(html) {
  return sanitizeHtml(html ?? '', ALLOWED);
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function textToHtml(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export async function fileToHtml(originalName, buffer) {
  const ext = path.extname(originalName).toLowerCase();

  switch (ext) {
    case '.txt':
      return cleanHtml(textToHtml(buffer.toString('utf8')));
    case '.md':
      return cleanHtml(await marked.parse(buffer.toString('utf8')));
    case '.docx': {
      const { value } = await mammoth.convertToHtml({ buffer });
      return cleanHtml(value);
    }
    default:
      throw new Error(`Unsupported file type "${ext || 'none'}". Use ${SUPPORTED_EXTENSIONS.join(', ')}.`);
  }
}

// Prefer the document's own first heading; fall back to the file name.
export function pickTitle(html, filename) {
  const heading = html.match(/<h[12][^>]*>(.*?)<\/h[12]>/i);
  const text = heading && sanitizeHtml(heading[1], { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 200) : titleFromFilename(filename);
}

export function titleFromFilename(name) {
  const base = path.basename(name, path.extname(name)).replace(/[_-]+/g, ' ').trim();
  return base.slice(0, 200) || 'Imported document';
}
