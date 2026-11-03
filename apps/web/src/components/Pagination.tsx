interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
  label?: string;
}

export function Pagination({
  total,
  limit,
  offset,
  onChange,
  label = 'Pagination',
}: PaginationProps) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  const first = offset + 1;
  const last = Math.min(offset + limit, total);
  return (
    <nav className="pagination" aria-label={label}>
      <button
        type="button"
        className="button"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(0, offset - limit))}
      >
        Previous
      </button>
      <span aria-live="polite">
        {first}–{last} of {total} · page {page} of {pages}
      </span>
      <button
        type="button"
        className="button"
        disabled={page >= pages}
        onClick={() => onChange(offset + limit)}
      >
        Next
      </button>
    </nav>
  );
}
