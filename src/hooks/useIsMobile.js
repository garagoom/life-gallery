import { useEffect, useState } from 'react';

export const MOBILE_MAX_WIDTH = 768;

export default function useIsMobile(maxWidth = MOBILE_MAX_WIDTH) {
  const query = `(max-width: ${maxWidth}px)`;
  const [mobile, setMobile] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  ));

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (event) => setMobile(event.matches);
    setMobile(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return mobile;
}
