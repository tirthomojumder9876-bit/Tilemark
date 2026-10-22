interface AddTileProps {
  onClick: () => void;
  label?: string;
}

export function AddTile({ onClick, label = 'Add bookmark' }: AddTileProps) {
  return (
    <button type="button" className="tile tile--add" onClick={onClick} aria-label={label}>
      <span aria-hidden="true">+</span>
    </button>
  );
}
