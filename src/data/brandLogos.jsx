const brandLogos = {
  Canon: (
    <svg viewBox="0 0 80 20" fill="currentColor" style={{ height: 14 }}>
      <text x="0" y="15" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="16" letterSpacing="1">Canon</text>
    </svg>
  ),
  Nikon: (
    <img src="/images/brands/nikon.png" alt="Nikon" style={{ height: 16, width: 'auto', filter: 'currentColor' }} />
  ),
  Sony: (
    <img src="/images/brands/sony.svg" alt="Sony" style={{ height: 14, width: 'auto' }} />
  ),
  FUJIFILM: (
    <img src="/images/brands/fujifilm.svg" alt="FUJIFILM" style={{ height: 14, width: 'auto' }} />
  ),
  Fujifilm: (
    <img src="/images/brands/fujifilm.svg" alt="FUJIFILM" style={{ height: 14, width: 'auto' }} />
  ),
  'LEICA': (
    <img src="/images/brands/leica.svg" alt="Leica" style={{ height: 16, width: 'auto' }} />
  ),
  Leica: (
    <img src="/images/brands/leica.svg" alt="Leica" style={{ height: 16, width: 'auto' }} />
  ),
  Hasselblad: (
    <img src="/images/brands/hasselblad.svg" alt="Hasselblad" style={{ height: 14, width: 'auto' }} />
  ),
  Panasonic: (
    <img src="/images/brands/panasonic.svg" alt="Panasonic" style={{ height: 14, width: 'auto' }} />
  ),
  OLYMPUS: (
    <img src="/images/brands/olympus.svg" alt="OLYMPUS" style={{ height: 16, width: 'auto' }} />
  ),
  Olympus: (
    <img src="/images/brands/olympus.svg" alt="OLYMPUS" style={{ height: 16, width: 'auto' }} />
  ),
  SIGMA: (
    <img src="/images/brands/sigma.svg" alt="SIGMA" style={{ height: 16, width: 'auto' }} />
  ),
  Sigma: (
    <img src="/images/brands/sigma.svg" alt="SIGMA" style={{ height: 16, width: 'auto' }} />
  ),
  Apple: (
    <img src="/images/brands/apple.svg" alt="Apple" style={{ height: 16, width: 'auto' }} />
  ),
  Samsung: (
    <img src="/images/brands/samsung.svg" alt="Samsung" style={{ height: 14, width: 'auto' }} />
  ),
  Huawei: (
    <img src="/images/brands/huawei.svg" alt="Huawei" style={{ height: 14, width: 'auto' }} />
  ),
  HUAWEI: (
    <img src="/images/brands/huawei.svg" alt="HUAWEI" style={{ height: 14, width: 'auto' }} />
  ),
  Xiaomi: (
    <img src="/images/brands/xiaomi.svg" alt="Xiaomi" style={{ height: 14, width: 'auto' }} />
  ),
  Google: (
    <img src="/images/brands/google.svg" alt="Google" style={{ height: 14, width: 'auto' }} />
  ),
};

export function getBrandLogo(make) {
  if (!make) return null;
  const lower = make.toLowerCase();
  for (const [key, value] of Object.entries(brandLogos)) {
    if (lower.includes(key.toLowerCase())) return value;
  }
  return null;
}
