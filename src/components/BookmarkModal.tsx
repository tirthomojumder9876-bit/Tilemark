import { useState } from 'react';
import type { Bookmark, BookmarkInput } from '../types';
import { validateBookmark, type BookmarkErrors } from '../logic/validation';
import { Modal } from './Modal';

interface BookmarkModalProps {
  sectionId: string;
  bookmark: Bookmark | null;
  onCancel: () => void;
  onSubmit: (sectionId: string, input: BookmarkInput) => Promise<void>;
}

export function BookmarkModal({ sectionId, bookmark, onCancel, onSubmit }: BookmarkModalProps) {
  const [title, setTitle] = useState(bookmark?.title ?? '');
  const [url, setUrl] = useState(bookmark?.url ?? '');
  const [description, setDescription] = useState(bookmark?.description ?? '');
  const [iconUrl, setIconUrl] = useState(bookmark?.iconUrl ?? '');
  const [errors, setErrors] = useState<BookmarkErrors>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = validateBookmark({ title, url, description, iconUrl });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      await onSubmit(sectionId, parsed.value);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal titleId="bookmark-modal-title" onClose={onCancel}>
      <h2 id="bookmark-modal-title">{bookmark ? 'Edit bookmark' : 'New bookmark'}</h2>

      <form onSubmit={handleSubmit} noValidate>
        <label>
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="My favorite site"
          />
          {errors.title && <span className="error">{errors.title}</span>}
        </label>

        <label>
          URL
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="example.com"
            inputMode="url"
          />
          {errors.url && <span className="error">{errors.url}</span>}
        </label>

        <label>
          Description <span className="optional">(optional)</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
          />
          {errors.description && <span className="error">{errors.description}</span>}
        </label>

        <label>
          Icon URL <span className="optional">(optional, defaults to site favicon)</span>
          <input value={iconUrl} onChange={(event) => setIconUrl(event.target.value)} placeholder="https://…" />
        </label>

        <div className="modal__actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
