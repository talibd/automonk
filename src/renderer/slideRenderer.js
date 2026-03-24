// Renders slide layouts with satori + resvg. No browser or Puppeteer involved.
const { default: satori } = require('satori');
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs/promises');
const path = require('path');
const logger = require('../utils/logger');

// Slide dimensions per platform
const DIMENSIONS = {
  instagram: { width: 1080, height: 1080 },
  facebook:  { width: 1080, height: 1080 },
  linkedin:  { width: 1200, height: 628 },
  twitter:   { width: 1200, height: 675 },
  threads:   { width: 1080, height: 1080 },
  youtube:   { width: 1080, height: 1080 },
};

// Font cache — lives for the process lifetime
const fontCache = new Map();

async function loadLocalFont(fontPath) {
  if (fontCache.has(fontPath)) return fontCache.get(fontPath);
  const data = await fs.readFile(fontPath);
  fontCache.set(fontPath, data);
  return data;
}

/**
 * Fetch fonts from Google Fonts.
 * Uses a pre-WOFF2 user-agent so Google serves WOFF format, which satori supports.
 * Results are cached in memory for the process lifetime.
 *
 * @param {string}   family  - Google Fonts family name (e.g. 'Inter')
 * @param {number[]} weights - font weights to load (e.g. [400, 700])
 */
async function fetchGoogleFonts(family, weights) {
  const cacheKey = `gf:${family}:${weights.join(',')}`;
  if (fontCache.has(cacheKey)) return fontCache.get(cacheKey);

  logger.info('Fetching fonts from Google Fonts', { family, weights });

  // Firefox 27 predates WOFF2 support → Google Fonts returns WOFF, which satori supports
  const familyParam = encodeURIComponent(`${family}:wght@${weights.join(';')}`);
  const cssUrl = `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`;

  const cssRes = await fetch(cssUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; rv:27.0) Gecko/20100101 Firefox/27.0' },
  });
  if (!cssRes.ok) throw new Error(`Google Fonts CSS request failed: ${cssRes.status}`);

  const css = await cssRes.text();

  // Parse each @font-face block for url + font-weight
  const faceRegex = /@font-face\s*\{([^}]+)\}/g;
  const fonts = [];
  let m;
  while ((m = faceRegex.exec(css)) !== null) {
    const block = m[1];
    const urlMatch   = /url\(([^)]+)\)/.exec(block);
    const weightMatch = /font-weight:\s*(\d+)/.exec(block);
    if (!urlMatch || !weightMatch) continue;

    const weight = parseInt(weightMatch[1], 10);
    if (!weights.includes(weight)) continue;

    const fontUrl = urlMatch[1].replace(/['"]/g, '');
    const fontRes = await fetch(fontUrl);
    if (!fontRes.ok) throw new Error(`Font file download failed (${weight}): ${fontRes.status}`);

    const data = Buffer.from(await fontRes.arrayBuffer());
    fonts.push({ name: family, weight, style: 'normal', data });
  }

  if (fonts.length === 0) throw new Error(`No fonts loaded from Google Fonts for "${family}"`);

  fontCache.set(cacheKey, fonts);
  logger.info('Google Fonts loaded', { family, loaded: fonts.map(f => f.weight) });
  return fonts;
}

async function getFonts() {
  // 1. Custom overrides — drop TTF/OTF files in assets/fonts/ to bypass Google Fonts
  const customFontsDir = path.resolve(__dirname, '../../assets/fonts');
  const customFiles = [
    { name: 'Inter', weight: 400, style: 'normal', file: 'Inter-Regular.ttf' },
    { name: 'Inter', weight: 700, style: 'normal', file: 'Inter-Bold.ttf' },
  ];
  const custom = [];
  for (const f of customFiles) {
    try {
      const data = await loadLocalFont(path.join(customFontsDir, f.file));
      custom.push({ name: f.name, weight: f.weight, style: f.style, data });
    } catch { /* not present */ }
  }
  if (custom.length > 0) return custom;

  // 2. Fetch Inter from Google Fonts (WOFF format)
  return fetchGoogleFonts('Inter', [400, 700]);
}

/**
 * Renders carousel slides to PNG buffers using satori + resvg (no browser needed).
 *
 * @param {object}   params
 * @param {object[]} params.slides        - array of { slide_number, headline?, body?, quote? }
 * @param {string}   params.platform
 * @param {string}   params.templatePath  - path to a JS template module (exports a function)
 * @param {number}   params.clientId
 * @param {object}   [params.context]     - extra vars: clientName, clientInitials, avatarContent, title, totalSlides
 * @returns {Promise<Buffer[]>}
 */
async function renderSlides({ slides, platform, templatePath, clientId, context = {} }) {
  const dims = DIMENSIONS[platform] || DIMENSIONS.instagram;
  const fonts = await getFonts();
  const buildLayout = await loadTemplate(templatePath, platform);

  logger.info('Rendering slides', { clientId, platform, slideCount: slides.length });

  const pngBuffers = [];

  for (const slide of slides) {
    const layout = buildLayout(slide, context, dims);

    const svg = await satori(layout, {
      width: dims.width,
      height: dims.height,
      fonts,
    });

    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: dims.width },
    });
    pngBuffers.push(resvg.render().asPng());
  }

  logger.info('Rendering complete', { clientId, platform, rendered: pngBuffers.length });
  return pngBuffers;
}

// Safe base directory
const SAFE_TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

/**
 * Load a JS template module that exports (slide, context, dims) => satori layout object.
 * Falls back to platform default, then generic default.
 */
async function loadTemplate(templatePath, platform) {
  const candidates = [];

  if (templatePath) {
    const resolved = path.resolve(templatePath);
    if (!resolved.startsWith(SAFE_TEMPLATES_DIR)) {
      throw new Error(`Template path is outside the allowed directory: ${templatePath}`);
    }
    candidates.push(resolved);
  }

  candidates.push(
    path.join(SAFE_TEMPLATES_DIR, platform, 'slide.js'),
    path.join(SAFE_TEMPLATES_DIR, 'default', 'slide.js'),
  );

  for (const candidate of candidates) {
    // Normalise legacy .html paths stored in DB to their .js counterpart
    const jsCandidate = candidate.endsWith('.html') ? candidate.slice(0, -5) + '.js' : candidate;
    try {
      await fs.access(jsCandidate);
      return require(jsCandidate);
    } catch {
      // try next
    }
  }

  throw new Error(`No template found for platform: ${platform}`);
}

module.exports = { renderSlides };
