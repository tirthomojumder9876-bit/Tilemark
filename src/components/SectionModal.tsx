import { useState } from 'react';
import type { Section } from '../types';
import { validateSectionTitle } from '../logic/validation';
import { Modal } from './Modal';

interface SectionModalProps {
  section: Section | null;
  onCancel: () => void;
  onSubmit: (title: string) => Promise<void>;
}

export function SectionModal({ section, onCancel, onSubmit }: SectionModalProps) {
  const [title, setTitle] = useState(section?.title ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const problem = validateSectionTitle(title);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    try {
      await onSubmit(title.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal titleId="section-modal-title" onClose={onCancel}>
      <h2 id="section-modal-title">{section ? 'Rename section' : 'New section'}</h2>

      <form onSubmit={handleSubmit} noValidate>
        <label>
          Section name
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Reading" />
          {error && <span className="error">{error}</span>}
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
