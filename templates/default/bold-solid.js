/**
 * Bold Solid template.
 * Deep coral/red solid background, white text, giant slide number watermark.
 *
 * @param {object} slide   - { slide_number, quote }
 * @param {object} context - { clientName, clientInitials, logoUrl, title, totalSlides }
 * @param {object} dims    - { width, height }
 * @returns {object} satori layout tree
 */

function parseBoldText(text) {
  const segments = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    segments.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), bold: false });
  return segments.length ? segments : [{ text, bold: false }];
}

function renderRichText(text, fontSize, color) {
  const segments = parseBoldText(text);
  if (segments.length === 1 && !segments[0].bold) {
    return { type: 'div', props: { style: { fontSize, color, fontWeight: 400, lineHeight: 1.4 }, children: text } };
  }
  const children = [];
  for (const seg of segments) {
    const tokens = seg.text.split(/(\s+)/);
    for (const token of tokens) {
      if (!token) continue;
      children.push({
        type: 'div',
        props: { style: { fontWeight: seg.bold ? 700 : 300, fontSize, color, whiteSpace: 'pre' }, children: token },
      });
    }
  }
  return { type: 'div', props: { style: { display: 'flex', flexWrap: 'wrap', lineHeight: 1.4 }, children } };
}

module.exports = function boldSolidTemplate(slide, context, dims) {
  const quote = slide.quote ?? slide.headline ?? '';
  const clientName = context.clientName || 'AutoMonk';
  const initials = context.clientInitials
    || clientName.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const pad = Math.round(dims.width * 0.075);
  const fontSize = Math.round(dims.width * 0.051);
  const slideNum = slide.slide_number ?? 1;
  const total = context.totalSlides ?? 5;
  const BG = '#DC2626'; // bold red

  return {
    type: 'div',
    props: {
      style: {
        width: dims.width,
        height: dims.height,
        backgroundColor: BG,
        display: 'flex',
        flexDirection: 'column',
        padding: `${pad}px`,
        overflow: 'hidden',
        position: 'relative',
      },
      children: [
        // Giant watermark slide number — bottom right
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: Math.round(dims.width * -0.04),
              right: Math.round(dims.width * 0.03),
              fontSize: Math.round(dims.width * 0.38),
              fontWeight: 800,
              color: 'rgba(255,255,255,0.1)',
              lineHeight: 1,
              userSelect: 'none',
            },
            children: String(slideNum),
          },
        },

        // Top: client name row
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: Math.round(dims.width * 0.055),
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    width: Math.round(dims.width * 0.05),
                    height: Math.round(dims.width * 0.05),
                    borderRadius: dims.width,
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: Math.round(dims.width * 0.018),
                    fontWeight: 700,
                    color: '#fff',
                  },
                  children: initials,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: Math.round(dims.width * 0.02),
                    color: 'rgba(255,255,255,0.85)',
                    fontWeight: 600,
                    letterSpacing: 0.5,
                  },
                  children: clientName,
                },
              },
            ],
          },
        },

        // Quote — centered
        {
          type: 'div',
          props: {
            style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
            children: [renderRichText(quote, fontSize, '#FFFFFF')],
          },
        },

        // Bottom: slide progress bar
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              gap: 6,
              marginTop: Math.round(dims.width * 0.04),
            },
            children: Array.from({ length: total }, (_, i) => ({
              type: 'div',
              props: {
                style: {
                  flex: 1,
                  height: Math.round(dims.width * 0.006),
                  borderRadius: 3,
                  backgroundColor: i + 1 <= slideNum
                    ? '#fff'
                    : 'rgba(255,255,255,0.3)',
                },
              },
            })),
          },
        },
      ],
    },
  };
};
