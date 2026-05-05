import React from 'react';

const Table = ({ config }: { config: any }) => {
  const { data, style } = config;
  const tableVariant = style.variant ?? 'Bordered';
  const tableBorder = tableVariant === 'Clean' ? 'none' : '1px solid #e3e6ec';
  const columns = data.columns || [];
  const rows = data.rows || data.mockValue || [];

  return (
    <div
      style={{
        backgroundColor: style.backgroundColor || '#ffffff',
        borderRadius: `${style.borderRadius || 8}px`,
        border: tableVariant === 'Clean' ? 'none' : `${style.borderWidth || 1}px solid ${style.borderColor || '#e3e6ec'}`,
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '12px 16px', fontWeight: 'bold', borderBottom: tableBorder }}>
        {config.label}
      </div>
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: style.headerBackgroundColor || '#f8f9fb' }}>
            <tr>
              {columns.map((col: any) => (
                <th
                  key={col.fieldKey}
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: '13px',
                    borderRight: tableVariant === 'Bordered' ? '1px solid #e3e6ec' : 'none',
                    borderBottom: tableBorder,
                  }}
                >
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, idx: number) => (
              <tr
                key={idx}
                style={{
                  borderBottom: tableBorder,
                  backgroundColor: tableVariant === 'Zebra' && idx % 2 === 1 ? style.rowAlternateColor || '#f8fafc' : 'transparent',
                }}
              >
                {columns.map((col: any) => (
                  <td
                    key={col.fieldKey}
                    style={{
                      padding: '10px 16px',
                      fontSize: '13px',
                      borderRight: tableVariant === 'Bordered' ? '1px solid #e3e6ec' : 'none',
                      borderBottom: tableBorder,
                    }}
                  >
                    {String(row[col.fieldKey] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Table;
