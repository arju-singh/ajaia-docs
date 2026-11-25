import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TurndownService from 'turndown';
import { api } from './api.js';
import { parseDbDate } from './format.js';
import useAutosave from './useAutosave.js';
import Toolbar from './Toolbar.jsx';
import ShareDialog from './ShareDialog.jsx';

const STATUS_TEXT = {
  idle: '',
  pending: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'All changes saved',
  error: 'Not saved',
};

export default function DocumentEditor({ id }) {
  const [doc, setDoc] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const contentLoaded = useRef(false);

  const save = useCallback(async (changes) => {
    const { document } = await api.updateDocument(id, changes);
    setDoc((prev) => ({ ...prev, updatedAt: document.updatedAt }));
  }, [id]);
  const autosave = useAutosave(save);

  const canEdit = doc && doc.access !== 'viewer';

  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false })],
    content: '',
    editable: false,
    editorProps: { attributes: { class: 'page-content', 'aria-label': 'Document body' } },
    onUpdate: ({ editor }) => autosave.queue({ content: editor.getHTML() }),
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    api.getDocument(id)
      .then(({ document }) => {
        if (cancelled) return;
        setDoc(document);
        setTitle(document.title);
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => { cancelled = true; };
  }, [id]);

  // Load content once both the editor and the document are ready.
  useEffect(() => {
    if (!editor || !doc || editor.isDestroyed) return;
    if (!contentLoaded.current) {
      editor.commands.setContent(doc.content, { emitUpdate: false });
      contentLoaded.current = true;
    }
    editor.setEditable(doc.access !== 'viewer', false);
  }, [editor, doc?.id, doc?.access]); // eslint-disable-line react-hooks/exhaustive-deps

  function onTitleChange(value) {
    setTitle(value);
    if (!value.trim()) return setTitleError('Title cannot be empty');
    if (value.trim().length > 200) return setTitleError('Keep titles under 200 characters');
    setTitleError('');
    autosave.queue({ title: value.trim() });
  }

  function download(format) {
    const html = editor.getHTML();
    const name = (title.trim() || 'document').replace(/[^\w\- ]+/g, '').trim() || 'document';
    const body = format === 'md'
      ? new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' }).turndown(html)
      : `<!doctype html><meta charset="utf-8"><title>${name}</title>${html}`;
    const blob = new Blob([body], { type: format === 'md' ? 'text/markdown' : 'text/html' });
    const link = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `${name}.${format}`,
    });
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (loadError) {
    return (
      <main className="center">
        <div className="notice">
          <h2>Can't open this document</h2>
          <p className="muted">{loadError}</p>
          <a className="btn" href="#/">Back to documents</a>
        </div>
      </main>
    );
  }
  if (!doc || !editor) return <div className="center muted">Opening document…</div>;

  const isOwner = doc.access === 'owner';

  return (
    <main className="editor-page">
      <div className="editor-header">
        <a className="icon-btn" href="#/" title="All documents" aria-label="Back to all documents">←</a>
        <div className="title-wrap">
          <input
            className={`title-input${titleError ? ' invalid' : ''}`}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={() => autosave.flush()}
            readOnly={!canEdit}
            aria-label="Document title"
            maxLength={250}
          />
          <div className="title-meta small">
            {titleError ? <span className="error">{titleError}</span> : (
              <>
                <span className={`save-status ${autosave.status}`}>
                  {autosave.status === 'error' ? `Not saved: ${autosave.error}` : STATUS_TEXT[autosave.status] ||
                    `Last edited ${parseDbDate(doc.updatedAt).toLocaleString()}`}
                </span>
                {autosave.status === 'error' && <button className="btn-link" onClick={autosave.flush}>Retry</button>}
              </>
            )}
            {!isOwner && <span className="muted"> · Owned by {doc.owner.name}</span>}
          </div>
        </div>

        <div className="header-actions">
          {doc.access === 'viewer' && <span className="badge viewer">View only</span>}
          <details className="menu">
            <summary className="btn">Export</summary>
            <div className="menu-list">
              <button onClick={() => download('md')}>Markdown (.md)</button>
              <button onClick={() => download('html')}>Web page (.html)</button>
            </div>
          </details>
          {isOwner
            ? <button className="btn primary" onClick={() => setShareOpen(true)}>Share</button>
            : <button className="btn" onClick={() => setShareOpen(true)}>People</button>}
        </div>
      </div>

      {canEdit && <Toolbar editor={editor} />}

      <div className="page-scroll">
        <article className="page">
          <EditorContent editor={editor} />
        </article>
      </div>

      {shareOpen && <ShareDialog doc={doc} onClose={() => setShareOpen(false)} />}
    </main>
  );
}
