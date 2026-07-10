import type { ReactNode } from "react";

type TableProps = {
  headers: string[];
  children: ReactNode;
  emptyMessage: string;
  columnCount: number;
  className?: string;
};

export function Table({ headers, children, emptyMessage, columnCount, className = "" }: TableProps) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];

  return (
    <div className="overflow-x-auto">
      <table className={`data-table min-w-[720px] ${className}`}>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={`${header}-${index}`}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows
          ) : (
            <tr>
              <td colSpan={columnCount} className="p-4">
                <div className="empty-state">{emptyMessage}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
