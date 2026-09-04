import { Table } from 'antd';
import styles from './ListTable.module.css';

export default function ListTable({ dataSource, rowKey = 'id', scroll, className, ...tableProps }) {
  const rows = Array.isArray(dataSource) ? dataSource : [];

  return (
    <Table
      {...tableProps}
      className={[styles.table, className].filter(Boolean).join(' ')}
      dataSource={rows}
      virtual={false}
      rowKey={typeof rowKey === 'function' ? rowKey : (record) => record?.[rowKey]}
      scroll={scroll}
    />
  );
}
