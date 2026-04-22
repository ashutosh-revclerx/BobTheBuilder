import type { ComponentConfig } from '../../types/template';

interface TableProps {
  config: ComponentConfig;
}

export default function Table({ config }: TableProps) {
  const { style, data, label } = config;
  const columns = data.columns || [];
  const rows = (Array.isArray(data.mockValue) ? data.mockValue : []) as Record<string, unknown>[];

  return (
    <div
      className="table-component"
      style={{
        backgroundColor: style.backgroundColor,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
        borderColor: style.borderColor,
        borderWidth: style.borderWidth ? `${style.borderWidth}px` : undefined,
        borderStyle: 'solid',
      }}
    >
      <div className="table-component-header">
        <div className="table-component-title" style={{ color: style.textColor }}>
          {label}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.fieldKey}>{col.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((col) => (
                <td key={col.fieldKey} style={{ color: style.textColor ? `${style.textColor}cc` : undefined }}>
                  {String(row[col.fieldKey] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
