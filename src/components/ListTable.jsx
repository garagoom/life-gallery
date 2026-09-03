import { Table } from 'antd';

function collectSignature(nodes, acc = []) {
  (nodes || []).forEach((row) => {
    acc.push([
      row.id,
      row.updated_at,
      row.status,
      row.review_status,
      row.label,
      row.title,
      row.icon,
      row.menuKey,
      row.visible,
      row.sort_order,
      row.parent_id,
      row.display_name,
      row.role,
      (row.children || []).length,
    ].join(':'));
    if (row.children?.length) collectSignature(row.children, acc);
  });
  return acc;
}

export default function ListTable({ dataSource, ...rest }) {
  const rows = Array.isArray(dataSource) ? dataSource : [];
  return (
    <Table
      {...rest}
      dataSource={rows}
      virtual={false}
      rowKey={rest.rowKey || 'id'}
      key={collectSignature(rows).join('|')}
    />
  );
}
