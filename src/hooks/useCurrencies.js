import { useEffect, useState } from 'react';
import { FALLBACK_CURRENCIES, getCurrencies } from '../api/fx';

export default function useCurrencies() {
  const [options, setOptions] = useState(FALLBACK_CURRENCIES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCurrencies().then((rows) => {
      if (!cancelled) setOptions(rows);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { options, loading };
}
