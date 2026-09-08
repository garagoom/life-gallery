import { Select } from 'antd';
import useCurrencies from '../../hooks/useCurrencies';

export default function CurrencySelect({ value, onChange, disabled, style, allowClear }) {
  const { options, loading } = useCurrencies();
  return (
    <Select
      showSearch
      optionFilterProp="label"
      loading={loading}
      value={value}
      onChange={onChange}
      disabled={disabled}
      allowClear={allowClear}
      options={options}
      style={{ width: '100%', minWidth: 140, ...style }}
      placeholder="选择货币"
    />
  );
}
