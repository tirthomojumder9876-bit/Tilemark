import type { Link } from '../types';
import { hostLabel } from '../logic/url';
import { Modal } from './Modal';

interface OpenAllModalProps {
  links: Link[];
  onClose: () => void;
}

/**
 * Fallback when the browser blocks programmatic tabs: the same URLs as ordinary
 * anchors, so the user can open each one (or middle-click) without a popup.
 */
export function OpenAllModal({ links, onClose }: OpenAllModalProps) {
  return (
    <Modal titleId="open-all-title" onClose={onClose}>
      <h2 id="open-all-title">Open these sites</h2>
      <p className="modal__hint">
        Your browser blocked opening them automatically. Open them from this list, or
        allow popups for this page and try again.
      </p>

      <ul className="link-list">
        {links.map((link) => (
          <li key={link.url}>
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              <span className="link-list__title">{link.title}</span>
              <span className="link-list__host">{hostLabel(link.url)}</span>
            </a>
          </li>
        ))}
      </ul>

      <div className="modal__actions">
        <button type="button" className="primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
