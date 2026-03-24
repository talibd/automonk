/**
 * Clean Light template.
 * Pure white background, thick orange left border, elegant dark typography.
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
    return { type: 'div', props: { style: { fontSize, color, fontWeight: 400, lineHeight: 1.5 }, children: text } };
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
  return { type: 'div', props: { style: { display: 'flex', flexWrap: 'wrap', lineHeight: 1.5 }, children } };
}

module.exports = function cleanLightTemplate(slide, context, dims) {
  const quote = slide.quote ?? slide.headline ?? '';
  const clientName = context.clientName || 'AutoMonk';
  const initials = context.clientInitials
    || clientName.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const pad = Math.round(dims.width * 0.075);
  const fontSize = Math.round(dims.width * 0.051);
  const borderWidth = Math.round(dims.width * 0.012);
  const slideNum = slide.slide_number ?? '';
  const total = context.totalSlides ?? '';
  const ACCENT = '#F97316'; // orange

  return {
    type: 'div',
    props: {
      style: {
        width: dims.width,
        height: dims.height,
        backgroundColor: '#FFFFFF',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
      },
      children: [
        // Left accent border
        {
          type: 'div',
          props: {
            style: {
              width: borderWidth,
              height: '100%',
              backgroundColor: ACCENT,
              flexShrink: 0,
            },
          },
        },

        // Main content
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: `${pad}px`,
              paddingLeft: Math.round(dims.width * 0.07),
            },
            children: [
              // Top: slide counter
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginBottom: Math.round(dims.width * 0.04),
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: Math.round(dims.width * 0.02),
                          color: ACCENT,
                          fontWeight: 700,
                          letterSpacing: 1,
                        },
                        children: total ? `${slideNum} / ${total}` : `${slideNum}`,
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
                  children: [
                    // Opening quote mark
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: Math.round(dims.width * 0.12),
                          color: ACCENT,
                          lineHeight: 0.8,
                          marginBottom: Math.round(dims.width * 0.02),
                          fontWeight: 700,
                        },
                        children: '\u201C',
                      },
                    },
                    renderRichText(quote, fontSize, '#111827'),
                  ],
                },
              },

              // Bottom: client badge
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderTop: `1px solid #F3F4F6`,
                    paddingTop: Math.round(dims.width * 0.025),
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          width: Math.round(dims.width * 0.046),
                          height: Math.round(dims.width * 0.046),
                          borderRadius: dims.width,
                          backgroundColor: ACCENT,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: Math.round(dims.width * 0.017),
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
                          color: '#374151',
                          fontWeight: 600,
                        },
                        children: clientName,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
};
