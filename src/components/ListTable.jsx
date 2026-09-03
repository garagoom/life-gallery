import { useState } from 'react';
import { Table } from 'antd';

export default function ListTable({ dataSource, ...rest }) {
  const rows = Array.isArray(dataSource) ? dataSource : [];
  const [snapshot, setSnapshot] = useState({ rows, rev: 0 });

  let rev = snapshot.rev;
  let tableRows = snapshot.rows;
  if (snapshot.rows !== rows) {
    rev = snapshot.rev + 1;
    tableRows = rows;
    setSnapshot({ rows, rev });
  }

  const { rowKey = 'id', scroll, ...tableProps } = rest;

  return (
    <Table
      key={rev}
      {...tableProps}
      dataSource={tableRows}
      virtual={false}
      rowKey={typeof rowKey === 'function' ? rowKey : (record) => record?.[rowKey]}
      scroll={scroll?.x ? { x: scroll.x } : undefined}
    />
  );
}
