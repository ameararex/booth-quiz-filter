export function ViewToggle({ value, onChange }: { value: 'grid' | 'list'; onChange: (value: 'grid' | 'list') => void }) {
  return <div className="view-buttons" role="group" aria-label="表示形式">
    <button aria-label="画像表示" title="画像表示" aria-pressed={value === 'grid'} onClick={() => onChange('grid')}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" fill="currentColor" /></svg></button>
    <button aria-label="一覧表示" title="一覧表示" aria-pressed={value === 'list'} onClick={() => onChange('list')}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 5h18M3 12h18M3 19h18" stroke="currentColor" strokeWidth="2" /></svg></button>
  </div>;
}
