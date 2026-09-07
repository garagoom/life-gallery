const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'images', 'brands');
const UA = 'life-gallery-logo-collector/1.0 (personal photography site)';

const SIMPLE = [
  'apple', 'asus', 'blackmagicdesign', 'dji', 'epson', 'fairphone', 'fujifilm',
  'google', 'honor', 'htc', 'huawei', 'insta360', 'kodak', 'leica', 'lenovo',
  'lg', 'meizu', 'motorola', 'nikon', 'nokia', 'oneplus', 'oppo', 'panasonic',
  'samsung', 'sharp', 'sony', 'toshiba', 'vivo', 'xiaomi',
];

const WIKI = {
  canon: ['Canon_wordmark.svg', 'Canon_logo.svg'],
  gopro: ['GoPro_logo.svg', 'GoPro_logo_light.svg'],
  polaroid: ['Polaroid_Logo_2023.svg', 'Polaroid_wordmark.svg'],
  pentax: ['Pentax_wordmark.svg', 'Pentax_Logo.svg'],
  ricoh: ['Ricoh_logo.svg', 'Ricoh_logo_2012.svg'],
  zeiss: ['ZEISS_logo.svg', 'Carl_Zeiss_logo.svg', 'Carl_Zeiss_AG_logo.svg'],
  realme: ['Realme_logo.svg'],
  casio: ['Casio_logo.svg'],
  arri: ['ARRI_AG_Corporate_Logo.svg', 'ARRI_logo.svg'],
  microsoft: ['Microsoft_logo_(2012).svg', 'Microsoft_logo.svg'],
  zte: ['ZTE_logo.svg', 'ZTE_Logo.svg'],
  tecno: ['TECNO_Mobile_logo.svg', 'Tecno_Mobile_logo.svg', 'TECNO_logo.svg'],
  infinix: ['Infinix_logo.svg', 'Infinix_Mobile_logo.svg'],
  nothing: ['Nothing_(brand)_logo.svg', 'Nothing_Technology_logo.svg', 'Nothing_logo.svg'],
  omsystem: ['OM_SYSTEM_logo.svg', 'OM_System_logo.svg'],
  phaseone: ['Phase_One_logo.svg'],
  mamiya: ['Mamiya_logo.svg'],
  tamron: ['Tamron_logo.svg'],
  minolta: ['Minolta_logo.svg', 'Konica_Minolta_logo.svg'],
  rollei: ['Rollei_logo.svg'],
  yashica: ['Yashica_logo.svg'],
  blackberry: ['BlackBerry_Logo.svg', 'Blackberry_logo.svg'],
  nubia: ['Nubia_logo.svg', 'Nubia_Technology_logo.svg'],
  iqoo: ['IQOO_logo.svg', 'iQOO_logo.svg'],
  poco: ['POCO_logo.svg', 'Poco_logo.svg'],
  redmi: ['Redmi_logo.svg'],
  sigma: ['Sigma_Corporation_logo.svg', 'SIGMA_logo.svg'],
  olympus: ['Olympus_logo.svg', 'Olympus_Corporation_logo.svg'],
  hasselblad: ['Hasselblad_logo.svg'],
  lumix: ['Lumix_logo.svg', 'Panasonic_Lumix_logo.svg'],
  contax: ['Contax_logo.svg'],
  bronica: ['Bronica_logo.svg', 'Zenza_Bronica_logo.svg'],
  lomo: ['Lomography_logo.svg', 'Lomo_logo.svg'],
};

const KEEP_COLOR = new Set([
  'apple', 'google', 'fujifilm', 'leica', 'huawei', 'hasselblad',
]);

const WORDMARKS = [
  'nothing', 'omsystem', 'phaseone', 'mamiya', 'tamron', 'minolta', 'rollei',
  'yashica', 'nubia', 'iqoo', 'poco', 'redmi', 'tecno', 'infinix', 'zte',
  'contax', 'bronica', 'lomo', 'praktica', 'zenit', 'sjcam', 'akaso',
  'doogee', 'oukitel', 'cmf',
];

const WORDMARK_LABEL = {
  nothing: 'Nothing',
  omsystem: 'OM SYSTEM',
  phaseone: 'Phase One',
  mamiya: 'Mamiya',
  tamron: 'TAMRON',
  minolta: 'MINOLTA',
  rollei: 'ROLLEI',
  yashica: 'YASHICA',
  nubia: 'nubia',
  iqoo: 'iQOO',
  poco: 'POCO',
  redmi: 'Redmi',
  tecno: 'TECNO',
  infinix: 'Infinix',
  zte: 'ZTE',
  contax: 'CONTAX',
  bronica: 'BRONICA',
  lomo: 'LOMO',
  praktica: 'PRAKTICA',
  zenit: 'ZENIT',
  sjcam: 'SJCAM',
  akaso: 'AKASO',
  doogee: 'DOOGEE',
  oukitel: 'OUKITEL',
  cmf: 'CMF',
};

function toCurrentColor(svg) {
  return svg
    .replace(/\sfill="(?!none)[^"]+"/gi, ' fill="currentColor"')
    .replace(/\sstroke="(?!none)[^"]+"/gi, ' stroke="currentColor"')
    .replace(/fill:(?!none)[^;"}]+/gi, 'fill:currentColor')
    .replace(/stroke:(?!none)[^;"}]+/gi, 'stroke:currentColor');
}

function wordmarkSvg(text) {
  const w = Math.max(72, Math.round(text.length * 11.2 + 8));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 20" role="img" aria-label="${text}"><text x="2" y="15" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="13" letter-spacing="0.6" fill="currentColor">${text}</text></svg>\n`;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'image/svg+xml,application/json,text/plain,*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return text;
}

async function fetchSvg(url) {
  const text = await fetchText(url);
  if (!/<svg[\s>]/i.test(text)) throw new Error('not svg');
  return text;
}

async function wikiFileUrl(file) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${file}`)}&prop=imageinfo&iiprop=url&format=json`;
  const json = JSON.parse(await fetchText(api));
  const pages = json?.query?.pages || {};
  const page = Object.values(pages)[0];
  const url = page?.imageinfo?.[0]?.url;
  if (!url) throw new Error(`no url for ${file}`);
  return url;
}

async function save(id, svg, recolor = true) {
  const dest = path.join(OUT_DIR, `${id}.svg`);
  const body = recolor && !KEEP_COLOR.has(id) ? toCurrentColor(svg) : svg;
  fs.writeFileSync(dest, body);
  console.log('saved', id, Buffer.byteLength(body), 'bytes');
}

async function fromSimple(id) {
  const urls = [
    `https://cdn.jsdelivr.net/npm/simple-icons@15/icons/${id}.svg`,
    `https://raw.githubusercontent.com/simple-icons/simple-icons/master/icons/${id}.svg`,
  ];
  for (const url of urls) {
    try {
      const svg = await fetchText(url);
      await save(id, svg);
      return true;
    } catch {
      // try next
    }
  }
  return false;
}

async function fromWiki(id, files) {
  for (const file of files) {
    try {
      const url = await wikiFileUrl(file);
      const svg = await fetchSvg(url);
      await save(id, svg);
      return true;
    } catch (error) {
      console.log('skip', id, file, error.message);
    }
  }
  return false;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const missing = [];

  for (const id of SIMPLE) {
    if (fs.existsSync(path.join(OUT_DIR, `${id}.svg`))) continue;
    const ok = await fromSimple(id);
    if (!ok) missing.push(['simple', id]);
  }

  for (const [id, files] of Object.entries(WIKI)) {
    if (!process.env.WIKI) break;
    const dest = path.join(OUT_DIR, `${id}.svg`);
    if (fs.existsSync(dest)) continue;
    const ok = await fromWiki(id, files);
    if (!ok && !fs.existsSync(dest)) missing.push(['wiki', id]);
  }

  for (const id of WORDMARKS) {
    const dest = path.join(OUT_DIR, `${id}.svg`);
    if (fs.existsSync(dest)) continue;
    fs.writeFileSync(dest, wordmarkSvg(WORDMARK_LABEL[id] || id.toUpperCase()));
    console.log('wordmark', id);
  }

  console.log('missing', missing);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
