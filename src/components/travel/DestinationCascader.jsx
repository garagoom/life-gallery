import { useEffect, useMemo, useState } from 'react';
import { Cascader } from 'antd';
import { getCities, getCountries, getStates, joinDestination, splitDestination } from '../../api/geo';

function labelsFromOptions(selectedOptions = []) {
  return selectedOptions.map((path) => path.map((item) => item.label));
}

export default function DestinationCascader({ value, onChange, disabled, placeholder = '国家 / 地区 / 城市，可多选' }) {
  const [countries, setCountries] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getCountries().then((rows) => {
      if (!cancelled) setCountries(rows);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const options = useMemo(() => {
    const current = String(value || '').trim();
    if (!current) return countries;
    const known = splitDestination(current).some((path) => countries.some((item) => item.value === path[0] || item.label === path[0]));
    if (known) return countries;
    return [{ label: current, value: current, isLeaf: true }, ...countries];
  }, [countries, value]);

  const cascaderValue = useMemo(() => {
    const current = String(value || '').trim();
    if (!current) return [];
    const paths = splitDestination(current);
    const known = paths.some((path) => countries.some((item) => item.value === path[0] || item.label === path[0]));
    return known ? paths : [[current]];
  }, [value, countries]);

  const loadData = async (selectedOptions) => {
    const target = selectedOptions[selectedOptions.length - 1];
    const country = selectedOptions[0];
    target.loading = true;
    setCountries((prev) => [...prev]);
    try {
      if (selectedOptions.length === 1) {
        const states = await getStates(country.code);
        target.children = states.length ? states : await getCities(country.code);
      } else {
        target.children = await getCities(country.code, target.iso2 || target.value);
      }
      if (!target.children?.length) target.isLeaf = true;
    } finally {
      target.loading = false;
      setCountries((prev) => [...prev]);
    }
  };

  return (
    <Cascader
      multiple
      changeOnSelect
      disabled={disabled}
      options={options}
      loadData={loadData}
      value={cascaderValue}
      placeholder={placeholder}
      showSearch={{
        filter: (input, path) => path.some((item) => String(item.label || '').toLowerCase().includes(input.toLowerCase())),
      }}
      displayRender={(labels) => labels.join(' / ')}
      onChange={(_, selectedOptions) => {
        if (!selectedOptions?.length) {
          onChange?.('');
          return;
        }
        onChange?.(joinDestination(labelsFromOptions(selectedOptions)));
      }}
      style={{ width: '100%', minWidth: 220 }}
      maxTagCount="responsive"
    />
  );
}
