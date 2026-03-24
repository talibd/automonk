/**
 * Gradient Vivid template.
 * Purple-to-blue gradient background, white text, bold and energetic.
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

module.exports = function gradientVividTemplate(slide, context, dims) {
  const quote = slide.quote ?? slide.headline ?? '';
  const clientName = context.clientName || 'AutoMonk';
  const initials = context.clientInitials
    || clientName.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const pad = Math.round(dims.width * 0.075);
  const fontSize = Math.round(dims.width * 0.051);
  const slideNum = slide.slide_number ?? 1;
  const total = context.totalSlides ?? 5;

  return {
    type: 'div',
    props: {
      style: {
        width: dims.width,
        height: dims.height,
        backgroundImage: 'linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)',
        display: 'flex',
        flexDirection: 'column',
        padding: `${pad}px`,
        overflow: 'hidden',
      },
      children: [
        // Top bar: client name + slide counter
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: Math.round(dims.width * 0.055),
            },
            children: [
              // Client badge
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
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
                          color: 'rgba(255,255,255,0.9)',
                          fontWeight: 600,
                        },
                        children: clientName,
                      },
                    },
                  ],
                },
              },
              // Slide counter pill
              {
                type: 'div',
                props: {
                  style: {
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    borderRadius: 100,
                    paddingTop: Math.round(dims.width * 0.008),
                    paddingBottom: Math.round(dims.width * 0.008),
                    paddingLeft: Math.round(dims.width * 0.018),
                    paddingRight: Math.round(dims.width * 0.018),
                    fontSize: Math.round(dims.width * 0.017),
                    color: '#fff',
                    fontWeight: 600,
                  },
                  children: `${slideNum} of ${total}`,
                },
              },
            ],
          },
        },

        // Quote
        {
          type: 'div',
          props: {
            style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
            children: [renderRichText(quote, fontSize, '#FFFFFF')],
          },
        },

        // Bottom progress dots
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'center',
              gap: 8,
              marginTop: Math.round(dims.width * 0.04),
            },
            children: Array.from({ length: total }, (_, i) => ({
              type: 'div',
              props: {
                style: {
                  width: i + 1 === slideNum
                    ? Math.round(dims.width * 0.038)
                    : Math.round(dims.width * 0.014),
                  height: Math.round(dims.width * 0.014),
                  borderRadius: 100,
                  backgroundColor: i + 1 === slideNum
                    ? '#fff'
                    : 'rgba(255,255,255,0.35)',
                },
              },
            })),
          },
        },
      ],
    },
  };
};
