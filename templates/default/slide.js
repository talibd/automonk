/**
 * Default educational slide template.
 * Matches the design in slide.html.
 *
 * @param {object} slide   - { slide_number, headline, body }
 * @param {object} context - { totalSlides, ... }
 * @param {object} dims    - { width, height }
 * @returns {object} satori layout tree
 */
module.exports = function slideTemplate(slide, context, dims) {
  const slideNum = slide.slide_number ?? '';
  const total = context.totalSlides ?? 10;

  return {
    type: 'div',
    props: {
      style: {
        width: dims.width,
        height: dims.height,
        backgroundColor: '#0D0F14',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '80px',
        position: 'relative',
        overflow: 'hidden',
      },
      children: [
        // Slide number — top right
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 40,
              right: 50,
              fontSize: 28,
              color: '#6366F1',
              fontWeight: 700,
              letterSpacing: 2,
            },
            children: `${slideNum}/${total}`,
          },
        },

        // Accent bar
        {
          type: 'div',
          props: {
            style: {
              width: 80,
              height: 6,
              backgroundColor: '#6366F1',
              borderRadius: 3,
              marginBottom: 40,
            },
          },
        },

        // Headline
        {
          type: 'div',
          props: {
            style: {
              fontSize: 68,
              fontWeight: 800,
              color: '#FFFFFF',
              lineHeight: 1.1,
              letterSpacing: -1,
              marginBottom: 36,
            },
            children: slide.headline ?? '',
          },
        },

        // Body
        {
          type: 'div',
          props: {
            style: {
              fontSize: 36,
              fontWeight: 400,
              color: '#94A3B8',
              lineHeight: 1.5,
            },
            children: slide.body ?? '',
          },
        },

        // Brand dot — bottom right
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: 40,
              right: 50,
              width: 20,
              height: 20,
              backgroundColor: '#6366F1',
              borderRadius: 10,
            },
          },
        },
      ],
    },
  };
};
