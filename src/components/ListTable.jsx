import { Table } from 'antd';

export default function ListTable({ dataSource, rowKey = 'id', scroll, ...tableProps }) {
  const rows = Array.isArray(dataSource) ? dataSource : [];

  return (
    <Table
      {...tableProps}
      dataSource={rows}
      virtual={false}
      rowKey={typeof rowKey === 'function' ? rowKey : (record) => record?.[rowKey]}
      scroll={scroll}
    />
  );
}
