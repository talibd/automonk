/**
 * Quote carousel slide template.
 * Matches the design in carousel-quote.html.
 *
 * @param {object} slide   - { slide_number, quote }
 * @param {object} context - { clientName, clientInitials, logoUrl, title, totalSlides }
 * @param {object} dims    - { width, height }
 * @returns {object} satori layout tree
 */
module.exports = function carouselQuoteTemplate(slide, context, dims) {
  const quote = slide.quote ?? slide.headline ?? '';
  const slideNum = slide.slide_number ?? '';
  const totalSlides = context.totalSlides ?? '';
  const clientName = context.clientName ?? '';
  const initials = context.clientInitials ?? '';
  const title = context.title ?? '';

  // Avatar: logo image if available, otherwise initials text
  const avatarChild = context.logoUrl
    ? {
        type: 'img',
        props: {
          src: context.logoUrl,
          style: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' },
        },
      }
    : {
        type: 'div',
        props: { style: { display: 'flex' }, children: initials },
      };

  return {
    type: 'div',
    props: {
      style: {
        width: dims.width,
        height: dims.height,
        backgroundColor: '#0D0F14',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      },
      children: [
        // Header: avatar + client name + title
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '52px 64px 0',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    width: 76,
                    height: 76,
                    borderRadius: 38,
                    background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 26,
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0,
                    overflow: 'hidden',
                    border: '2px solid rgba(99,102,241,0.35)',
                  },
                  children: avatarChild,
                },
              },
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column', gap: 5 },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: { fontSize: 22, fontWeight: 700, color: '#F1F5F9', letterSpacing: -0.5 },
                        children: clientName,
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: { fontSize: 14, color: '#475569', fontWeight: 400 },
                        children: title,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },

        // Accent bar
        {
          type: 'div',
          props: {
            style: {
              width: 52,
              height: 4,
              background: 'linear-gradient(90deg, #6366F1, #8B5CF6)',
              margin: '40px 64px 0',
              borderRadius: 2,
            },
          },
        },

        // Quote area
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '28px 64px 20px',
            },
            children: [
              // Decorative opening quote mark
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 160,
                    color: '#6366F1',
                    lineHeight: 0.45,
                    marginBottom: 44,
                    opacity: 0.2,
                  },
                  children: '\u201C',
                },
              },
              // Quote text
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 62,
                    fontWeight: 800,
                    color: '#F1F5F9',
                    lineHeight: 1.18,
                    letterSpacing: -2,
                  },
                  children: quote,
                },
              },
            ],
          },
        },

        // Footer: slide counter + brand dots
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 64px 52px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { fontSize: 14, color: '#1E293B', letterSpacing: 3 },
                  children: `${slideNum} / ${totalSlides}`,
                },
              },
              {
                type: 'div',
                props: {
                  style: { display: 'flex', gap: 7, alignItems: 'center' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#6366F1', opacity: 0.35 },
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#6366F1' },
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
