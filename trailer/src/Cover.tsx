import React from 'react';
import { AbsoluteFill, Img, staticFile, useVideoConfig } from 'remotion';
import { BROWN, textStyle, Logo, BunnyHead, Glow } from './Trailer';

// Key art for store pages / social previews. Render as stills at frame COVER_FRAME (animations settled).
export const COVER_FRAME = 90;
export type CoverVariant = 'wide' | 'og' | 'header' | 'tall';

// Every variant is laid out on a design canvas and scaled to the composition size.
const DESIGN_W: Record<CoverVariant, number> = { wide: 1920, og: 1920, header: 1920, tall: 1200 };

const Tag: React.FC<{ size: number; children: React.ReactNode }> = ({ size, children }) => (
  <div style={{ ...textStyle(size), WebkitTextStroke: `${Math.round(size / 8)}px ${BROWN}` }}>{children}</div>
);

const Pill: React.FC<{ size: number; children: React.ReactNode }> = ({ size, children }) => (
  <div style={{
    fontFamily: textStyle(size).fontFamily, fontWeight: 700, fontSize: size, color: BROWN, background: 'linear-gradient(#b4ec96, #7fcf62)',
    border: `${Math.round(size / 6)}px solid ${BROWN}`, borderRadius: 999, padding: `${size * 0.22}px ${size * 0.8}px`,
    boxShadow: `0 ${size / 5}px 0 #2b1a0e`, whiteSpace: 'nowrap',
  }}>{children}</div>
);

export const Cover: React.FC<{ variant: CoverVariant }> = ({ variant }) => {
  const { width, height } = useVideoConfig();
  const dw = DESIGN_W[variant];
  const scale = width / dw;
  const dh = height / scale;
  const tall = variant === 'tall';
  const bg = staticFile(tall ? 'cover/cover-tall.png' : 'cover/cover-wide.png');

  return (
    <AbsoluteFill style={{ backgroundColor: '#a9dcff', overflow: 'hidden' }}>
      <Img src={bg} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: tall ? '50% 30%' : '50% 60%', filter: 'saturate(1.12) contrast(1.03)' }} />
      {/* soft light from the sky, darker at the bottom for the tagline */}
      <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(255,246,224,0.35) 0%, rgba(255,246,224,0) 32%, rgba(0,0,0,0) 62%, rgba(40,20,8,0.6) 100%)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(30,12,0,0.35) 100%)' }} />

      <div style={{ position: 'absolute', left: 0, top: 0, width: dw, height: dh, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <div style={{ position: 'absolute', inset: 0 }}><Glow color="255,236,190" strength={0.45} /></div>

        {variant === 'header' ? (
          // Steam-style header: logo only, big and centered
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 40 }}>
            <Logo size={200} />
          </div>
        ) : tall ? (
          <>
            <div style={{ position: 'absolute', top: 60, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
              <Logo size={128} />
            </div>
            <div style={{ position: 'absolute', bottom: 150, left: 40, right: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <Tag size={58}>Rabbits have a secret</Tag>
              <Tag size={58}>civilization.</Tag>
              <Tag size={78}>You run it.</Tag>
            </div>
            <div style={{ position: 'absolute', bottom: 46, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
              <Pill size={44}>▶ Play free in your browser</Pill>
            </div>
          </>
        ) : (
          <>
            <div style={{ position: 'absolute', top: variant === 'og' ? 26 : 46, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
              <Logo size={variant === 'og' ? 176 : 190} />
            </div>
            <div style={{ position: 'absolute', bottom: variant === 'og' ? 56 : 80, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
              <Tag size={62}>Rabbits have a secret civilization. <span style={{ color: '#ffe7b0' }}>You run it.</span></Tag>
              <Pill size={40}>▶ Play free in your browser</Pill>
            </div>
          </>
        )}

        {/* mascots peeking in from the bottom corners */}
        {variant !== 'header' && (
          <>
            <div style={{ position: 'absolute', left: tall ? -30 : 40, bottom: tall ? -70 : -60, transform: 'rotate(10deg)' }}>
              <BunnyHead size={tall ? 200 : 230} fur="#e7c9a0" />
            </div>
            <div style={{ position: 'absolute', right: tall ? -30 : 50, bottom: tall ? -80 : -70, transform: 'rotate(-12deg)' }}>
              <BunnyHead size={tall ? 190 : 250} />
            </div>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
