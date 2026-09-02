const logoStyle = { height: 20, width: 'auto' };

const svgText = (text, opts = {}) => (
  <svg viewBox={`0 0 ${text.length * 12 + 4} 20`} style={logoStyle}>
    <text
      x="0"
      y="15"
      fontFamily={opts.font || "'Helvetica Neue', Helvetica, Arial, sans-serif"}
      fontWeight={opts.weight || '500'}
      fontSize={opts.size || '15'}
      letterSpacing={opts.spacing || '0.5'}
      fill="currentColor"
    >{text}</text>
  </svg>
);

const brandLogos = {
  Canon: (
    <svg viewBox="0 0 80 20" fill="currentColor" style={logoStyle}>
      <text x="0" y="15" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="16" letterSpacing="1">Canon</text>
    </svg>
  ),
  Nikon: (
    <img src="/images/brands/nikon.png" alt="Nikon" style={logoStyle} />
  ),
  Sony: (
    <img src="/images/brands/sony.png" alt="Sony" style={logoStyle} />
  ),
  FUJIFILM: (
    <img src="/images/brands/fujifilm.svg" alt="FUJIFILM" style={logoStyle} />
  ),
  Fujifilm: (
    <img src="/images/brands/fujifilm.svg" alt="FUJIFILM" style={logoStyle} />
  ),
  'LEICA': (
    <img src="/images/brands/leica.svg" alt="Leica" style={logoStyle} />
  ),
  Leica: (
    <img src="/images/brands/leica.svg" alt="Leica" style={logoStyle} />
  ),
  Hasselblad: (
    <img src="/images/brands/hasselblad.svg" alt="Hasselblad" style={logoStyle} />
  ),
  Panasonic: (
    <img src="/images/brands/panasonic.svg" alt="Panasonic" style={logoStyle} />
  ),
  OLYMPUS: (
    <img src="/images/brands/olympus.svg" alt="OLYMPUS" style={logoStyle} />
  ),
  Olympus: (
    <img src="/images/brands/olympus.svg" alt="OLYMPUS" style={logoStyle} />
  ),
  SIGMA: (
    <img src="/images/brands/sigma.svg" alt="SIGMA" style={logoStyle} />
  ),
  Sigma: (
    <img src="/images/brands/sigma.svg" alt="SIGMA" style={logoStyle} />
  ),
  Apple: (
    <img src="/images/brands/apple.svg" alt="Apple" style={logoStyle} />
  ),
  Samsung: (
    <img src="/images/brands/samsung.svg" alt="Samsung" style={logoStyle} />
  ),
  Huawei: (
    <img src="/images/brands/huawei.svg" alt="Huawei" style={logoStyle} />
  ),
  HUAWEI: (
    <img src="/images/brands/huawei.svg" alt="HUAWEI" style={logoStyle} />
  ),
  Xiaomi: (
    <img src="/images/brands/xiaomi.svg" alt="Xiaomi" style={logoStyle} />
  ),
  Google: (
    <img src="/images/brands/google.svg" alt="Google" style={logoStyle} />
  ),
  vivo: svgText('vivo', { weight: '400', spacing: '1' }),
  OPPO: svgText('OPPO', { weight: '600', spacing: '2' }),
  HONOR: svgText('HONOR', { weight: '600', spacing: '2' }),
  Honor: svgText('HONOR', { weight: '600', spacing: '2' }),
  OnePlus: svgText('OnePlus', { weight: '500', spacing: '0.5' }),
  Realme: svgText('realme', { weight: '400', spacing: '1' }),
  Nothing: svgText('Nothing', { weight: '500', spacing: '0.5' }),
  ZTE: svgText('ZTE', { weight: '700', spacing: '3' }),
  Motorola: svgText('motorola', { weight: '400', spacing: '1' }),
  LENOVO: svgText('lenovo', { weight: '600', spacing: '2' }),
};

export function getBrandLogo(make) {
  if (!make) return null;
  const lower = make.toLowerCase();
  for (const [key, value] of Object.entries(brandLogos)) {
    if (lower.includes(key.toLowerCase())) return value;
  }
  return null;
}
