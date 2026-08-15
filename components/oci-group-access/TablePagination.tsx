"use client";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function TablePagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm">
      <label className="flex items-center gap-2 text-gray-600">
        Rows per page
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded border border-gray-300 bg-white px-2 py-1"
          aria-label="Rows per page"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3 text-gray-600">
        <span className="tabular-nums">
          {totalItems === 0
            ? "0 of 0"
            : `${start + 1}–${Math.min(start + pageSize, totalItems)} of ${totalItems}`}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="rounded border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="rounded border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
