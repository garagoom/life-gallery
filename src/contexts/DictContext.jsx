import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchAllDicts } from '../api/dict';

const DictContext = createContext(null);

export function DictProvider({ children }) {
  const [dicts, setDicts] = useState({});
  const [loading, setLoading] = useState(true);

  const loadDicts = useCallback(async () => {
    try {
      const res = await fetchAllDicts();
      if (res.code === 200 && res.data) {
        setDicts(res.data);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDicts();
  }, [loadDicts]);

  const getDict = useCallback((type) => dicts[type] || [], [dicts]);

  const getLabel = useCallback((type, value) => {
    const items = dicts[type] || [];
    const item = items.find(i => i.value === String(value));
    return item?.label || String(value);
  }, [dicts]);

  const getColor = useCallback((type, value) => {
    const items = dicts[type] || [];
    const item = items.find(i => i.value === String(value));
    return item?.color || 'default';
  }, [dicts]);

  const getLevel = useCallback((type, value) => {
    const items = dicts[type] || [];
    const item = items.find(i => i.value === String(value));
    return item?.level || 0;
  }, [dicts]);

  return (
    <DictContext.Provider value={{ dicts, loading, getDict, getLabel, getColor, getLevel, reload: loadDicts }}>
      {children}
    </DictContext.Provider>
  );
}

export function useDict() {
  const ctx = useContext(DictContext);
  if (!ctx) throw new Error('useDict must be used within DictProvider');
  return ctx;
}
