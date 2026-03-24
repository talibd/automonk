/**
 * Twitter/X-style quote slide template.
 * Light gray background, profile header, large mixed-weight text, dark pill CTA.
 *
 * @param {object} slide   - { slide_number, quote }
 * @param {object} context - { clientName, clientInitials, logoUrl, title, totalSlides }
 * @param {object} dims    - { width, height }
 * @returns {object} satori layout tree
 */

/**
 * Parses **bold** markdown into segments: [{ text, bold }]
 */
function parseBoldText(text) {
  const segments = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }
  return segments.length ? segments : [{ text, bold: false }];
}

/**
 * Renders text with **bold** markers as a satori flex-wrap container.
 * Each word/space token becomes a separate element with the correct weight.
 */
function renderRichText(text, fontSize, color) {
  const segments = parseBoldText(text);
  const allPlain = segments.length === 1 && !segments[0].bold;

  if (allPlain) {
    return {
      type: 'div',
      props: {
        style: { fontSize, color, fontWeight: 400, lineHeight: 1.45 },
        children: text,
      },
    };
  }

  const children = [];
  for (const seg of segments) {
    // Split on whitespace boundaries, keeping the whitespace tokens
    const tokens = seg.text.split(/(\s+)/);
    for (const token of tokens) {
      if (!token) continue;
      children.push({
        type: 'div',
        props: {
          style: {
            fontWeight: seg.bold ? 700 : 400,
            fontSize,
            color,
            whiteSpace: 'pre',
          },
          children: token,
        },
      });
    }
  }

  return {
    type: 'div',
    props: {
      style: { display: 'flex', flexWrap: 'wrap', lineHeight: 1.45 },
      children,
    },
  };
}

module.exports = function tweetStyleTemplate(slide, context, dims) {
  const quote = slide.quote ?? slide.headline ?? '';
  const clientName = context.clientName || 'AutoMonk';
  const initials = context.clientInitials
    || clientName.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const pad = Math.round(dims.width * 0.065); // ~70px @ 1080
  const fontSize = Math.round(dims.width * 0.05); // ~54px @ 1080
  const avatarSize = Math.round(dims.width * 0.067); // ~72px @ 1080

  const avatarContent = context.logoUrl
    ? {
        type: 'img',
        props: {
          src: context.logoUrl,
          style: { width: '100%', height: '100%', objectFit: 'cover' },
        },
      }
    : {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            backgroundColor: '#1D9BF0',
            fontSize: Math.round(avatarSize * 0.38),
            fontWeight: 700,
            color: '#fff',
          },
          children: initials,
        },
      };

  return {
    type: 'div',
    props: {
      style: {
        width: dims.width,
        height: dims.height,
        backgroundColor: '#E8EAE8',
        display: 'flex',
        flexDirection: 'column',
        padding: `${pad}px`,
        overflow: 'hidden',
      },
      children: [
        // ── Profile row ──────────────────────────────────────────────────────
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: Math.round(dims.width * 0.04),
            },
            children: [
              // Avatar circle
              {
                type: 'div',
                props: {
                  style: {
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                    overflow: 'hidden',
                    flexShrink: 0,
                    display: 'flex',
                  },
                  children: avatarContent,
                },
              },
              // Name + timestamp column
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column', gap: 4 },
                  children: [
                    // Name + verified checkmark
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', alignItems: 'center', gap: 8 },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: Math.round(dims.width * 0.022),
                                fontWeight: 700,
                                color: '#0F1419',
                              },
                              children: clientName,
                            },
                          },
                          // Blue verified badge
                          {
                            type: 'div',
                            props: {
                              style: {
                                width: Math.round(dims.width * 0.022),
                                height: Math.round(dims.width * 0.022),
                                borderRadius: dims.width,
                                backgroundColor: '#1D9BF0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: Math.round(dims.width * 0.013),
                                color: '#fff',
                                fontWeight: 700,
                              },
                              children: '\u2713',
                            },
                          },
                        ],
                      },
                    },
                    // Timestamp
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: Math.round(dims.width * 0.016),
                          color: '#536471',
                        },
                        children: 'Just now',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },

        // ── Quote text ───────────────────────────────────────────────────────
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            },
            children: [renderRichText(quote, fontSize, '#0F1419')],
          },
        },

        // ── "Read caption" CTA button ────────────────────────────────────────
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'center',
              marginTop: Math.round(dims.width * 0.037),
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    backgroundColor: '#0F1419',
                    borderRadius: 100,
                    paddingTop: Math.round(dims.width * 0.018),
                    paddingBottom: Math.round(dims.width * 0.018),
                    paddingLeft: Math.round(dims.width * 0.042),
                    paddingRight: Math.round(dims.width * 0.042),
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: Math.round(dims.width * 0.021),
                    color: '#fff',
                    fontWeight: 600,
                  },
                  children: '\uD83D\uDC47 Read caption',
                },
              },
            ],
          },
        },
      ],
    },
  };
};
