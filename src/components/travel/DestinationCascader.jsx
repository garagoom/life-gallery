import { useMemo, useRef, useState } from 'react';
import { Select } from 'antd';
import { joinDestination, searchPlaces, splitDestination } from '../../api/geo';

export default function DestinationCascader({ value, onChange, disabled, placeholder = '搜索中文地名，如大阪、巴黎，可多选' }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const seqRef = useRef(0);

  const selected = useMemo(
    () => splitDestination(value).map((path) => path.join(' / ')),
    [value],
  );

  const handleSearch = (raw) => {
    const query = String(raw || '').trim();
    window.clearTimeout(timerRef.current);
    if (!query) {
      setOptions([]);
      setLoading(false);
      return;
    }
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    timerRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await searchPlaces(query);
        if (seqRef.current !== seq) return;
        setOptions(rows.map((row) => ({
          label: row.label,
          value: row.value,
        })));
      } catch {
        if (seqRef.current !== seq) return;
        setOptions([]);
      } finally {
        if (seqRef.current === seq) setLoading(false);
      }
    }, 280);
  };

  return (
    <Select
      mode="tags"
      allowClear
      showSearch
      labelInValue={false}
      disabled={disabled}
      loading={loading}
      value={selected}
      options={options}
      placeholder={placeholder}
      filterOption={false}
      notFoundContent={loading ? '搜索中…' : '输入中文地名搜索'}
      tokenSeparators={[',', '，']}
      onSearch={handleSearch}
      onChange={(values) => {
        const paths = (values || [])
          .map((item) => String(item || '').trim())
          .filter(Boolean)
          .map((item) => item.split(/\s*\/\s*/).map((part) => part.trim()).filter(Boolean));
        onChange?.(joinDestination(paths));
      }}
      style={{ width: '100%', minWidth: 220 }}
      maxTagCount="responsive"
    />
  );
}
