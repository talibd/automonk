/**
 * Dark Minimal template.
 * Deep dark background, large white quote, accent bar, slide counter.
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
        props: { style: { fontWeight: seg.bold ? 700 : 400, fontSize, color, whiteSpace: 'pre' }, children: token },
      });
    }
  }
  return { type: 'div', props: { style: { display: 'flex', flexWrap: 'wrap', lineHeight: 1.4 }, children } };
}

module.exports = function darkMinimalTemplate(slide, context, dims) {
  const quote = slide.quote ?? slide.headline ?? '';
  const clientName = context.clientName || 'AutoMonk';
  const initials = context.clientInitials
    || clientName.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const pad = Math.round(dims.width * 0.075);
  const fontSize = Math.round(dims.width * 0.052);
  const slideNum = slide.slide_number ?? '';
  const total = context.totalSlides ?? '';

  return {
    type: 'div',
    props: {
      style: {
        width: dims.width,
        height: dims.height,
        backgroundColor: '#0D1117',
        display: 'flex',
        flexDirection: 'column',
        padding: `${pad}px`,
        overflow: 'hidden',
        position: 'relative',
      },
      children: [
        // Slide counter — top right
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: Math.round(dims.width * 0.045),
              right: pad,
              fontSize: Math.round(dims.width * 0.02),
              color: '#6366F1',
              fontWeight: 700,
              letterSpacing: 2,
            },
            children: total ? `${slideNum} / ${total}` : `${slideNum}`,
          },
        },

        // Accent bar
        {
          type: 'div',
          props: {
            style: {
              width: Math.round(dims.width * 0.075),
              height: Math.round(dims.width * 0.006),
              backgroundColor: '#6366F1',
              borderRadius: 3,
              marginBottom: Math.round(dims.width * 0.05),
            },
          },
        },

        // Quote — centered vertically
        {
          type: 'div',
          props: {
            style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
            children: [renderRichText(quote, fontSize, '#FFFFFF')],
          },
        },

        // Bottom row: client name
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center', gap: 12 },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    width: Math.round(dims.width * 0.042),
                    height: Math.round(dims.width * 0.042),
                    borderRadius: dims.width,
                    backgroundColor: '#6366F1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: Math.round(dims.width * 0.016),
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
                    fontSize: Math.round(dims.width * 0.019),
                    color: '#8B949E',
                    fontWeight: 500,
                  },
                  children: clientName,
                },
              },
            ],
          },
        },
      ],
    },
  };
};
