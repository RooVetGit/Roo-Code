import { parseInlineMarkdown } from "./InlineParser";

const parseTableHeaderCells = (headerRow: string) => {
  return headerRow
    .split("|")
    .slice(1, -1)
    .map(cell => cell.trim().replace(/^:[-]+:$|^:[-]+|[-]+:$/g, '').trim());
};

const parseTableDataRows = (dataRows: string[], maxRows: number = 50) => {
  const rows = [];
  try {
    for (let i = 0; i < dataRows.length; i++) {
      const cells = dataRows[i]
        .split("|")
        .slice(1, -1)
        .map(cell => cell.trim());

      if (cells.length > 0) {
        rows.push(cells);
      }

      if (rows.length >= maxRows) {
        break;
      }
    }
  } catch (_error) {
    return [];
  }
  return rows;
};

export const renderTableHeader = (headerCells: string[], keyPrefix: string) => {
  return (
    <thead className="bg-[--gray-1]">
      <tr>
        {headerCells.map((cell, idx) => (
          <th
            key={`${keyPrefix}-header-${idx}`}
            className="border border-[--gray-3] px-4 py-2 text-left text-sm font-medium"
          >
            {parseInlineMarkdown(cell, idx)}
          </th>
        ))}
      </tr>
    </thead>
  );
};

export const renderTableBody = (rows: string[][], keyPrefix: string) => {
  return (
    <tbody>
      {rows.map((row, rowIdx) => (
        <tr
          key={`${keyPrefix}-row-${rowIdx}`}
          className={rowIdx % 2 === 0 ? "bg-[--gray-2]" : "bg-[--gray-1]"}
        >
          {row.map((cell, cellIdx) => (
            <td
              key={`${keyPrefix}-cell-${rowIdx}-${cellIdx}`}
              className="border border-[--gray-3] px-4 py-2 text-sm"
            >
              {parseInlineMarkdown(cell, cellIdx + rowIdx * 100)}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
};

const isValidTable = (separatorRow: string, headerCells: string[], rows: string[][]) => {
  if (!separatorRow || !separatorRow.includes("|") || !separatorRow.match(/[-:]/)) {
    return false;
  }

  if (headerCells.length === 0 || rows.some(row => row.length === 0)) {
    return false;
  }

  return true;
};

export const parseTable = (tableText: string, keyPrefix: string) => {
  try {
    const lines = tableText.trim().split("\n").filter(line => line.trim() !== '');

  const tableStartIndex = lines.findIndex(line => line.trim().startsWith('|'));
  if (tableStartIndex === -1) {
   return null;
  }

  const tableLines = lines.slice(tableStartIndex);

    if (tableLines.length < 2) {
      return null;
    }

    const headerRow = tableLines[0];
    const separatorRow = tableLines[1];
    const dataRows = tableLines.slice(2).filter(line => {
      return !line.trim().match(/^[\s|:-]+$/);
    });

    const headerCells = parseTableHeaderCells(headerRow);
    const rows = parseTableDataRows(dataRows);

    if (!isValidTable(separatorRow, headerCells, rows)) {
      return null;
    }

    return (
      <div className="my-4 overflow-x-auto">
        <table className="w-full border-collapse rounded-lg border border-[--gray-3]">
          {renderTableHeader(headerCells, keyPrefix)}
          {renderTableBody(rows, keyPrefix)}
        </table>
      </div>
    );
  } catch (_error) {
    return null;
  }
};
