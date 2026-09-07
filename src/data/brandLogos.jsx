const logoStyle = { height: 20, width: 'auto' };

const COLOR_PNG = new Set([
  'arri', 'canon', 'casio', 'epson', 'fairphone', 'fujifilm', 'google', 'gopro',
  'htc', 'huawei', 'insta360', 'itel', 'kodak', 'leica', 'lenovo', 'lg', 'lumix',
  'meizu', 'microsoft', 'motorola', 'nikon', 'nokia', 'nubia', 'oneplus', 'oppo',
  'panasonic', 'phaseone', 'poco', 'realme', 'redmi', 'ricoh', 'samsung', 'sharp',
  'sony', 'tamron', 'tecno', 'vivo', 'xiaomi', 'zeiss', 'zte',
]);

const BRANDS = [
  { id: 'om-system', label: 'OM SYSTEM', aliases: ['om digital', 'om system'], file: 'omsystem.svg' },
  { id: 'blackmagic', label: 'Blackmagic', aliases: ['blackmagic'], file: 'blackmagicdesign.svg' },
  { id: 'phaseone', label: 'Phase One', aliases: ['phase one', 'phaseone'], file: 'phaseone.svg' },
  { id: 'insta360', label: 'Insta360', aliases: ['insta360'], file: 'insta360.svg' },
  { id: 'hasselblad', label: 'Hasselblad', aliases: ['hasselblad'], file: 'hasselblad.svg' },
  { id: 'fujifilm', label: 'FUJIFILM', aliases: ['fujifilm', 'fuji photo', 'fuji'], file: 'fujifilm.svg' },
  { id: 'panasonic', label: 'Panasonic', aliases: ['panasonic'], file: 'panasonic.svg' },
  { id: 'lumix', label: 'LUMIX', aliases: ['lumix'], file: 'lumix.svg' },
  { id: 'olympus', label: 'OLYMPUS', aliases: ['olympus'], file: 'olympus.svg' },
  { id: 'pentax', label: 'PENTAX', aliases: ['pentax'], file: 'pentax.svg' },
  { id: 'ricoh', label: 'RICOH', aliases: ['ricoh'], file: 'ricoh.svg' },
  { id: 'nikon', label: 'Nikon', aliases: ['nikon'], file: 'nikon.svg' },
  { id: 'canon', label: 'Canon', aliases: ['canon'], file: 'canon.svg' },
  { id: 'leica', label: 'Leica', aliases: ['leica'], file: 'leica.svg' },
  { id: 'sony', label: 'Sony', aliases: ['sony'], file: 'sony.svg' },
  { id: 'sigma', label: 'SIGMA', aliases: ['sigma'], file: 'sigma.svg' },
  { id: 'kodak', label: 'Kodak', aliases: ['kodak', 'eastman'], file: 'kodak.svg' },
  { id: 'polaroid', label: 'Polaroid', aliases: ['polaroid'], file: 'polaroid.svg' },
  { id: 'gopro', label: 'GoPro', aliases: ['gopro'], file: 'gopro.svg' },
  { id: 'dji', label: 'DJI', aliases: ['dji'], file: 'dji.svg' },
  { id: 'arri', label: 'ARRI', aliases: ['arri'], file: 'arri.svg' },
  { id: 'red', label: 'RED', aliases: ['red digital'], exact: ['red'], file: 'red.svg' },
  { id: 'zeiss', label: 'ZEISS', aliases: ['zeiss'], file: 'zeiss.svg' },
  { id: 'casio', label: 'CASIO', aliases: ['casio'], file: 'casio.svg' },
  { id: 'mamiya', label: 'Mamiya', aliases: ['mamiya'], file: 'mamiya.svg' },
  { id: 'leaf', label: 'Leaf', aliases: ['leaf'], file: 'leaf.svg' },
  { id: 'tamron', label: 'TAMRON', aliases: ['tamron'], file: 'tamron.svg' },
  { id: 'minolta', label: 'Minolta', aliases: ['konica minolta', 'minolta'], file: 'minolta.svg' },
  { id: 'konica', label: 'Konica', aliases: ['konica'], file: 'konica.svg' },
  { id: 'rollei', label: 'Rollei', aliases: ['rolleiflex', 'rollei'], file: 'rollei.svg' },
  { id: 'yashica', label: 'Yashica', aliases: ['yashica'], file: 'yashica.svg' },
  { id: 'contax', label: 'Contax', aliases: ['contax'], file: 'contax.svg' },
  { id: 'bronica', label: 'Bronica', aliases: ['bronica'], file: 'bronica.svg' },
  { id: 'lomo', label: 'LOMO', aliases: ['lomography', 'lomo'], file: 'lomo.svg' },
  { id: 'praktica', label: 'Praktica', aliases: ['praktica'], file: 'praktica.svg' },
  { id: 'zenit', label: 'Zenit', aliases: ['zenit'], file: 'zenit.svg' },
  { id: 'epson', label: 'Epson', aliases: ['seiko epson', 'epson'], file: 'epson.svg' },
  { id: 'toshiba', label: 'Toshiba', aliases: ['toshiba'], file: 'toshiba.svg' },
  { id: 'sjcam', label: 'SJCAM', aliases: ['sjcam'], file: 'sjcam.svg' },
  { id: 'akaso', label: 'AKASO', aliases: ['akaso'], file: 'akaso.svg' },
  { id: 'apple', label: 'Apple', aliases: ['apple'], file: 'apple.svg' },
  { id: 'samsung', label: 'Samsung', aliases: ['samsung'], file: 'samsung.svg' },
  { id: 'huawei', label: 'HUAWEI', aliases: ['huawei'], file: 'huawei.svg' },
  { id: 'xiaomi', label: 'Xiaomi', aliases: ['xiaomi'], file: 'xiaomi.svg' },
  { id: 'redmi', label: 'Redmi', aliases: ['redmi'], file: 'redmi.svg' },
  { id: 'poco', label: 'POCO', aliases: ['poco'], file: 'poco.svg' },
  { id: 'oppo', label: 'OPPO', aliases: ['oppo'], file: 'oppo.svg', models: [/^cph\d+/i, /^p[a-z]{3,4}\d+/i] },
  { id: 'vivo', label: 'vivo', aliases: ['vivo'], file: 'vivo.svg', models: [/^v\d{4}/i] },
  { id: 'honor', label: 'HONOR', aliases: ['honor'], file: 'honor.svg' },
  { id: 'realme', label: 'realme', aliases: ['realme'], file: 'realme.svg' },
  { id: 'oneplus', label: 'OnePlus', aliases: ['oneplus'], file: 'oneplus.svg' },
  { id: 'google', label: 'Google', aliases: ['google'], file: 'google.svg' },
  { id: 'nothing', label: 'Nothing', aliases: ['nothing'], file: 'nothing.svg' },
  { id: 'motorola', label: 'Motorola', aliases: ['motorola'], file: 'motorola.svg' },
  { id: 'lenovo', label: 'Lenovo', aliases: ['lenovo'], file: 'lenovo.svg' },
  { id: 'asus', label: 'ASUS', aliases: ['asus'], file: 'asus.svg' },
  { id: 'zte', label: 'ZTE', aliases: ['zte'], file: 'zte.svg' },
  { id: 'nubia', label: 'nubia', aliases: ['nubia'], file: 'nubia.svg' },
  { id: 'meizu', label: 'Meizu', aliases: ['meizu'], file: 'meizu.svg' },
  { id: 'nokia', label: 'Nokia', aliases: ['nokia', 'hmd global'], file: 'nokia.svg' },
  { id: 'microsoft', label: 'Microsoft', aliases: ['microsoft', 'nokia lumia'], file: 'microsoft.svg' },
  { id: 'htc', label: 'HTC', aliases: ['htc'], file: 'htc.svg' },
  { id: 'lg', label: 'LG', aliases: ['lg electronics'], exact: ['lg'], file: 'lg.svg' },
  { id: 'fairphone', label: 'Fairphone', aliases: ['fairphone'], file: 'fairphone.svg' },
  { id: 'tecno', label: 'TECNO', aliases: ['tecno'], file: 'tecno.svg' },
  { id: 'infinix', label: 'Infinix', aliases: ['infinix'], file: 'infinix.svg' },
  { id: 'itel', label: 'itel', aliases: ['itel'], file: 'itel.svg' },
  { id: 'iqoo', label: 'iQOO', aliases: ['iqoo'], file: 'iqoo.svg' },
  { id: 'blackberry', label: 'BlackBerry', aliases: ['blackberry'], file: 'blackberry.svg' },
  { id: 'sharp', label: 'SHARP', aliases: ['sharp'], file: 'sharp.svg' },
];

function aliasHits(lower, alias) {
  return lower.includes(alias);
}

function exactHits(lower, alias) {
  return lower === alias || lower.startsWith(`${alias} `) || lower.endsWith(` ${alias}`);
}

export function getBrandLogo(make, model) {
  const haystack = [make, model].filter(Boolean).map((v) => String(v).toLowerCase().trim()).join(' ');
  const modelText = String(model || '').trim();
  if (!haystack && !modelText) return null;
  let best = null;
  let bestLen = 0;
  for (const brand of BRANDS) {
    for (const alias of brand.aliases) {
      if (alias.length > bestLen && haystack && aliasHits(haystack, alias)) {
        best = brand;
        bestLen = alias.length;
      }
    }
    for (const alias of brand.exact || []) {
      if (alias.length > bestLen && haystack && exactHits(haystack, alias)) {
        best = brand;
        bestLen = alias.length;
      }
    }
    for (const pattern of brand.models || []) {
      if (modelText && pattern.test(modelText) && bestLen < 6) {
        best = brand;
        bestLen = 6;
      }
    }
  }
  if (!best) return null;
  const file = COLOR_PNG.has(best.id) ? `${best.id}.png` : best.file;
  const isSvg = /\.svg$/i.test(file);
  return (
    <img
      src={`/images/brands/${file}`}
      alt={best.label}
      style={logoStyle}
      data-logo={isSvg ? 'svg' : 'raster'}
    />
  );
}

export { BRANDS };
