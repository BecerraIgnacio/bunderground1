import React from 'react';
import {
  AbsoluteFill, Sequence, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing,
} from 'remotion';
import { Audio } from '@remotion/media';
import { loadFont } from '@remotion/google-fonts/Fredoka';

const { fontFamily } = loadFont('normal', { weights: ['500', '600', '700'], subsets: ['latin'] });

// 100 BPM → one beat = 18 frames, one bar = 72 frames
const BAR = 72;
export const TRAILER_FRAMES = 32 * BAR + 36;

const BROWN = '#4a2e1a';
const CREAM = '#fff6e0';
const clip = (name: string) => staticFile(`clips/${name}.mp4`);
const sfx = (name: string) => staticFile(`audio/sfx-${name}.wav`);

// frames where the whole picture gets a camera shake
const IMPACTS = [900, 936, 1080, 1800];

// ------------------------------------------------------------------ building blocks
const Clip: React.FC<{ name: string; rate?: number; start?: number; punch?: boolean; blur?: number; dim?: number; zoom?: [number, number] }> = ({
  name, rate = 1, start = 0, punch = true, blur = 0, dim = 0, zoom,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = punch ? interpolate(frame, [0, 10], [1.07, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }) : 1;
  const z = zoom ? interpolate(frame, [0, durationInFrames], zoom) : 1;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000' }}>
      <OffthreadVideo
        src={clip(name)}
        muted
        playbackRate={rate}
        trimBefore={start}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${p * z})`, filter: blur ? `blur(${blur}px)` : undefined }}
      />
      {dim > 0 && <AbsoluteFill style={{ backgroundColor: `rgba(20,10,30,${dim})` }} />}
    </AbsoluteFill>
  );
};

const Flash: React.FC<{ len?: number; color?: string; peak?: number }> = ({ len = 12, color = '#fff', peak = 0.9 }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 2, len], [peak, peak, 0], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ backgroundColor: color, opacity: o, pointerEvents: 'none' }} />;
};

const FadeIn: React.FC<{ len?: number; color?: string }> = ({ len = 15, color = '#000' }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ backgroundColor: color, opacity: interpolate(frame, [0, len], [1, 0], { extrapolateRight: 'clamp' }) }} />;
};

const textStyle = (size: number): React.CSSProperties => ({
  fontFamily,
  fontWeight: 700,
  fontSize: size,
  color: CREAM,
  WebkitTextStroke: `${Math.round(size / 9)}px ${BROWN}`,
  paintOrder: 'stroke fill',
  textShadow: `0 ${Math.round(size / 14)}px 0 #2b1a0e, 0 ${Math.round(size / 6)}px ${Math.round(size / 3)}px rgba(0,0,0,0.55)`,
  letterSpacing: size > 120 ? 2 : 0.5,
  lineHeight: 1.05,
  textAlign: 'center',
});

// words pop in one by one with a springy scale
const PopWords: React.FC<{ text: string; size?: number; delay?: number; stagger?: number; out?: number; style?: React.CSSProperties }> = ({
  text, size = 84, delay = 0, stagger = 4, out, style,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const end = out ?? durationInFrames;
  const fade = interpolate(frame, [end - 8, end], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `0 ${size * 0.28}px`, opacity: fade, ...style }}>
      {text.split(' ').map((w, i) => {
        const s = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 11, stiffness: 180, mass: 0.6 } });
        return (
          <span key={i} style={{ ...textStyle(size), display: 'inline-block', transform: `translateY(${(1 - s) * 40}px) scale(${0.4 + 0.6 * s}) rotate(${(1 - s) * (i % 2 ? 8 : -8)}deg)`, opacity: Math.min(1, s * 2) }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

// giant word that slams onto the screen
const Slam: React.FC<{ text: string; size?: number; sub?: string; subDelay?: number; color?: string; low?: boolean }> = ({ text, size = 170, sub, subDelay = 12, color, low }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 13, stiffness: 260, mass: 0.7 } });
  const scale = interpolate(s, [0, 1], [2.6, 1]);
  const o = interpolate(frame, [0, 3, durationInFrames - 8, durationInFrames], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const drift = interpolate(frame, [0, durationInFrames], [1, 1.06]);
  const ss = spring({ frame: frame - subDelay, fps, config: { damping: 14, stiffness: 160 } });
  return (
    <AbsoluteFill style={{ justifyContent: low ? 'flex-end' : 'center', alignItems: 'center', opacity: o, paddingBottom: low ? 70 : 0 }}>
      <div style={{ transform: `scale(${scale * drift})`, ...textStyle(size), color: color ?? CREAM }}>{text}</div>
      {sub && (
        <div style={{ marginTop: 26, transform: `translateY(${(1 - ss) * 30}px)`, opacity: ss, ...textStyle(46), WebkitTextStroke: `6px ${BROWN}` }}>
          {sub}
        </div>
      )}
    </AbsoluteFill>
  );
};

// cute caption pill for the "They farm." montage
const Caption: React.FC<{ text: string; icon: string }> = ({ text, icon }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = spring({ frame: frame - 3, fps, config: { damping: 10, stiffness: 200, mass: 0.6 } });
  const out = interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-start', padding: '0 0 110px 120px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 22, transform: `translateX(${(1 - s) * -160}px) rotate(${-3 + (1 - s) * -10}deg) scale(${0.6 + 0.4 * s})`,
        opacity: Math.min(1, s * 1.6) * out, transformOrigin: 'left center',
      }}>
        <div style={{ width: 118, height: 118, borderRadius: 40, background: CREAM, border: `8px solid ${BROWN}`, display: 'grid', placeItems: 'center', fontSize: 66, boxShadow: '0 10px 0 #2b1a0e' }}>{icon}</div>
        <div style={textStyle(104)}>{text}</div>
      </div>
    </AbsoluteFill>
  );
};

const Letterbox: React.FC<{ openAt: number }> = ({ openAt }) => {
  const frame = useCurrentFrame();
  const h = interpolate(frame, [openAt - 10, openAt + 8], [132, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: h, background: '#000' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: h, background: '#000' }} />
    </AbsoluteFill>
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(20,8,0,0.42) 100%)' }} />
);

const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: 0.07, mixBlendMode: 'overlay' }}>
      <svg width="100%" height="100%">
        <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 60} /></filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
    </AbsoluteFill>
  );
};

// drifting sparkles / hearts / carrots for the title
const Floaters: React.FC<{ count?: number }> = ({ count = 26 }) => {
  const frame = useCurrentFrame();
  const icons = ['✨', '🥕', '💕', '✨', '🌼', '💎'];
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: count }).map((_, i) => {
        const r1 = Math.sin(i * 91.7) * 0.5 + 0.5, r2 = Math.sin(i * 17.3) * 0.5 + 0.5, r3 = Math.sin(i * 53.1) * 0.5 + 0.5;
        const y = 1150 - ((frame * (1.2 + r2 * 2.2) + r1 * 1300) % 1350);
        const x = r3 * 1920 + Math.sin(frame / 25 + i) * 30;
        return <div key={i} style={{ position: 'absolute', left: x, top: y, fontSize: 26 + r2 * 34, opacity: 0.55 + r1 * 0.4, transform: `rotate(${Math.sin(frame / 20 + i) * 20}deg)` }}>{icons[i % icons.length]}</div>;
      })}
    </AbsoluteFill>
  );
};

// the mascot, drawn in SVG
const BunnyHead: React.FC<{ size?: number; blink?: boolean }> = ({ size = 260, blink }) => (
  <svg width={size} height={size * 1.15} viewBox="0 0 200 230">
    <g stroke={BROWN} strokeWidth="9" strokeLinejoin="round">
      <ellipse cx="68" cy="62" rx="24" ry="58" fill="#fbf4ea" transform="rotate(-12 68 62)" />
      <ellipse cx="132" cy="62" rx="24" ry="58" fill="#fbf4ea" transform="rotate(12 132 62)" />
      <ellipse cx="68" cy="66" rx="10" ry="38" fill="#ffb3c4" stroke="none" transform="rotate(-12 68 66)" />
      <ellipse cx="132" cy="66" rx="10" ry="38" fill="#ffb3c4" stroke="none" transform="rotate(12 132 66)" />
      <ellipse cx="100" cy="150" rx="78" ry="68" fill="#fbf4ea" />
    </g>
    {blink ? (
      <g stroke="#2a1d1a" strokeWidth="7" strokeLinecap="round"><path d="M62 146 q10 7 20 0" fill="none" /><path d="M118 146 q10 7 20 0" fill="none" /></g>
    ) : (
      <g><ellipse cx="72" cy="142" rx="11" ry="14" fill="#2a1d1a" /><ellipse cx="128" cy="142" rx="11" ry="14" fill="#2a1d1a" /><circle cx="76" cy="136" r="4" fill="#fff" /><circle cx="132" cy="136" r="4" fill="#fff" /></g>
    )}
    <ellipse cx="54" cy="170" rx="14" ry="8" fill="#ffc2cf" />
    <ellipse cx="146" cy="170" rx="14" ry="8" fill="#ffc2cf" />
    <path d="M92 160 h16 l-8 9 z" fill="#ff8fa8" stroke={BROWN} strokeWidth="3" strokeLinejoin="round" />
    <path d="M100 169 q-9 12 -18 4 M100 169 q9 12 18 4" fill="none" stroke={BROWN} strokeWidth="4" strokeLinecap="round" />
  </svg>
);

const Logo: React.FC<{ size?: number }> = ({ size = 186 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const letters = 'BUNDERGROUND'.split('');
  const hop = spring({ frame: frame - 2, fps, config: { damping: 8, stiffness: 150 } });
  const bob = Math.sin(frame / 9) * 6;
  const blink = frame % 70 > 64;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ transform: `translateY(${(1 - hop) * 300 + bob}px) scale(${0.3 + 0.7 * hop}) rotate(${Math.sin(frame / 14) * 3}deg)`, marginBottom: -34 }}>
        <BunnyHead size={200} blink={blink} />
      </div>
      <div style={{ display: 'flex' }}>
        {letters.map((l, i) => {
          const s = spring({ frame: frame - i * 2, fps, config: { damping: 9, stiffness: 220, mass: 0.6 } });
          const wave = Math.sin((frame - i * 4) / 8) * 5 * Math.min(1, frame / 40);
          return (
            <span key={i} style={{
              ...textStyle(size), display: 'inline-block', color: i % 2 ? '#ffe7b0' : CREAM,
              transform: `translateY(${(1 - s) * -220 + wave}px) scale(${0.2 + 0.8 * s}) rotate(${(1 - s) * (i % 2 ? 25 : -25)}deg)`,
            }}>{l}</span>
          );
        })}
      </div>
    </div>
  );
};

const Glow: React.FC<{ color?: string; strength?: number }> = ({ color = '255,214,120', strength = 0.55 }) => {
  const frame = useCurrentFrame();
  const pulse = 0.85 + Math.sin(frame / 12) * 0.15;
  return <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 46%, rgba(${color},${strength * pulse}) 0%, rgba(${color},0) 55%)` }} />;
};

// rotating light rays behind the logo
const Rays: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: 0.22, mixBlendMode: 'screen' }}>
      <div style={{
        position: 'absolute', left: '50%', top: '46%', width: 2800, height: 2800, marginLeft: -1400, marginTop: -1400,
        background: 'repeating-conic-gradient(from 0deg, rgba(255,236,180,0.9) 0deg 6deg, rgba(255,236,180,0) 6deg 18deg)',
        transform: `rotate(${frame * 0.25}deg)`, maskImage: 'radial-gradient(circle, black 0%, transparent 55%)', WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 55%)',
      }} />
    </AbsoluteFill>
  );
};

const Shake: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  let x = 0, y = 0;
  for (const f of IMPACTS) {
    const d = frame - f;
    if (d < 0 || d > 24) continue;
    const a = 22 * Math.exp(-d / 5);
    x += Math.sin(d * 2.7) * a; y += Math.cos(d * 3.3) * a * 0.7;
  }
  const zoom = x || y ? 1.05 : 1; // hide the edges while shaking
  return <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})` }}>{children}</AbsoluteFill>;
};

const Badge: React.FC<{ icon: string; label: string; delay: number }> = ({ icon, label, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 11, stiffness: 190 } });
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,246,224,0.95)', border: `6px solid ${BROWN}`, borderRadius: 999,
      padding: '12px 30px 12px 18px', boxShadow: '0 8px 0 #2b1a0e', transform: `scale(${s}) translateY(${(1 - s) * 40}px)`, opacity: s,
    }}>
      <span style={{ fontSize: 44 }}>{icon}</span>
      <span style={{ fontFamily, fontWeight: 700, fontSize: 40, color: BROWN }}>{label}</span>
    </div>
  );
};

// ------------------------------------------------------------------ scenes
const Intro: React.FC = () => (
  <>
    <Sequence durationInFrames={2 * BAR}>
      <Clip name="meadow" punch={false} zoom={[1.02, 1.08]} />
      <FadeIn len={40} />
      <Sequence from={24} durationInFrames={2 * BAR - 24}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 60 }}>
          <PopWords text="Beneath every quiet meadow…" size={92} stagger={6} />
        </AbsoluteFill>
      </Sequence>
    </Sequence>
    <Sequence from={2 * BAR} durationInFrames={2 * BAR}>
      <Clip name="reveal" rate={1.12} punch={false} />
      <Flash len={10} peak={0.5} />
      <Sequence from={40} durationInFrames={2 * BAR - 40}>
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 190 }}>
          <PopWords text="…a secret civilization is thriving." size={88} stagger={5} />
        </AbsoluteFill>
      </Sequence>
    </Sequence>
    <Sequence from={4 * BAR} durationInFrames={BAR}>
      <Clip name="walk" />
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 150 }}>
        <PopWords text="Rabbits are smarter than you think." size={80} stagger={3} delay={4} />
      </AbsoluteFill>
    </Sequence>
  </>
);

const MONTAGE: [string, string, string][] = [
  ['farm', 'They farm.', '🥕'],
  ['kitchen', 'They cook.', '🍲'],
  ['lounge', 'They gossip.', '🫖'],
  ['factory', 'They run factories.', '⚙️'],
  ['nursery', 'They raise families.', '🍼'],
  ['council', 'They hold elections.', '🗳️'],
  ['burrow', 'They nap. A lot.', '💤'],
];

const Montage: React.FC = () => (
  <>
    {MONTAGE.map(([name, text, icon], i) => (
      <Sequence key={name} from={5 * BAR + i * BAR} durationInFrames={BAR}>
        <Clip name={name} start={4} />
        <Caption text={text} icon={icon} />
      </Sequence>
    ))}
  </>
);

const Break: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#140b06' }}>
      <Sequence durationInFrames={36}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <PopWords text="But every warren needs a leader…" size={80} stagger={4} />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={36}>
        <Glow color="255,190,90" strength={0.5} />
        <Slam text="YOU." size={300} />
        <Flash len={14} />
      </Sequence>
    </AbsoluteFill>
  );
};

const FEATURES: [string, number, string, string][] = [
  ['dig', 2, 'DIG DEEP', 'Copper veins, stone and glowing moon crystals'],
  ['build', 2, 'BUILD A WARREN', 'Farms · Kitchens · Lounges · Nurseries · Factories'],
  ['love', 1, 'FALL IN LOVE', 'Friendships, rivalries & tiny new families'],
  ['ui', 1, 'EVERY BUN HAS A STORY', 'Personalities, skills, moods & dreams'],
  ['uisociety', 1, 'A REAL SOCIETY', 'Clans · Chiefs · Elections · Policies'],
  ['clock', 1, 'BUILD A WONDER', 'The legendary Moonstone Clock'],
];

const Features: React.FC = () => {
  let at = 13 * BAR;
  return (
    <>
      {FEATURES.map(([name, bars, title, sub]) => {
        const from = at;
        at += bars * BAR;
        const titleLen = bars === 2 ? 62 : 66;
        return (
          <Sequence key={name} from={from} durationInFrames={bars * BAR}>
            <Clip name={name} start={name === 'love' || name === 'uisociety' ? 0 : 6} rate={bars === 2 ? 1.1 : 1} />
            <Flash len={8} peak={0.55} />
            <Sequence durationInFrames={titleLen}>
              <AbsoluteFill style={{ background: bars === 2 ? 'radial-gradient(ellipse at center, rgba(30,15,5,0.45) 0%, rgba(0,0,0,0) 60%)' : 'linear-gradient(to top, rgba(30,15,5,0.55) 0%, rgba(0,0,0,0) 40%)' }} />
              <Slam text={title} size={bars === 2 ? (title.length > 16 ? 124 : 150) : 104} sub={sub} low={bars === 1} />
            </Sequence>
            {bars === 2 && (
              <Sequence from={titleLen} durationInFrames={bars * BAR - titleLen}>
                <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 90 }}>
                  <div style={{ ...textStyle(52), WebkitTextStroke: `7px ${BROWN}`, opacity: 0.95 }}>{sub}</div>
                </AbsoluteFill>
              </Sequence>
            )}
          </Sequence>
        );
      })}
    </>
  );
};

const Climax: React.FC = () => {
  const frame = useCurrentFrame();
  const white = interpolate(frame, [260, 288], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) });
  return (
    <>
      <Sequence durationInFrames={240}>
        <Clip name="timelapse" punch={false} />
        <Sequence from={14} durationInFrames={110}>
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 150 }}>
            <PopWords text="Start with five rabbits…" size={92} stagger={4} />
          </AbsoluteFill>
        </Sequence>
        <Sequence from={124} durationInFrames={116}>
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 150 }}>
            <PopWords text="…grow a thriving civilization." size={92} stagger={4} />
          </AbsoluteFill>
        </Sequence>
      </Sequence>
      <Sequence from={240} durationInFrames={48}>
        <Clip name="orbit" punch={false} rate={1.6} />
      </Sequence>
      <AbsoluteFill style={{ backgroundColor: '#fff8e8', opacity: white }} />
    </>
  );
};

const Title: React.FC = () => (
  <AbsoluteFill>
    <Clip name="orbit" rate={0.62} start={10} punch={false} blur={5} dim={0.45} zoom={[1.08, 1.0]} />
    <Rays />
    <Glow />
    <Floaters />
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 270 }}>
      <Logo />
    </AbsoluteFill>
    <Sequence from={BAR}>
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 310 }}>
        <PopWords text="Rabbits have a secret civilization." size={66} stagger={3} />
      </AbsoluteFill>
    </Sequence>
    <Sequence from={BAR + 36}>
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 205 }}>
        <PopWords text="You run it." size={82} stagger={5} style={{ filter: 'drop-shadow(0 0 30px rgba(255,200,90,0.6))' }} />
      </AbsoluteFill>
    </Sequence>
    <Sequence from={2 * BAR + 36}>
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 60 }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <Badge icon="⛏️" label="Dig" delay={0} />
          <Badge icon="🏗️" label="Build" delay={4} />
          <Badge icon="💕" label="Love" delay={8} />
          <Badge icon="👑" label="Rule" delay={12} />
        </div>
      </AbsoluteFill>
    </Sequence>
    <Flash len={20} color="#fff8e8" peak={1} />
  </AbsoluteFill>
);

const EndCard: React.FC<{ url: string }> = ({ url }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 6, fps, config: { damping: 12, stiffness: 160 } });
  const btn = 1 + Math.sin(frame / 6) * 0.035;
  const peek = spring({ frame: frame - 142, fps, config: { damping: 7, stiffness: 180 } });
  const fadeOut = interpolate(frame, [236, 252], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <Clip name="night" punch={false} blur={6} dim={0.5} zoom={[1.0, 1.08]} />
      <Glow color="150,170,255" strength={0.35} />
      <Floaters count={16} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 34, paddingBottom: 40 }}>
        <div style={{ transform: `scale(${0.5 + 0.5 * s})`, opacity: s }}><Logo size={120} /></div>
        <Sequence from={24} layout="none">
          <div style={{ transform: `scale(${btn})` }}>
            <PlayButton />
          </div>
        </Sequence>
        <Sequence from={40} layout="none">
          <PopWords text="Free · In your browser · Desktop & mobile" size={44} stagger={3} />
        </Sequence>
        {url && (
          <Sequence from={56} layout="none">
            <div style={{ ...textStyle(54), WebkitTextStroke: `6px ${BROWN}`, color: '#ffe7b0' }}>{url}</div>
          </Sequence>
        )}
      </AbsoluteFill>
      {/* the stinger: a bunny pops up and thumps */}
      <div style={{ position: 'absolute', right: 150, bottom: -60 + (1 - peek) * -260 + 0, transform: `translateY(${(1 - peek) * 260}px) rotate(-8deg)` }}>
        <BunnyHead size={170} blink={frame > 170 && frame < 176} />
      </div>
      <AbsoluteFill style={{ backgroundColor: '#000', opacity: fadeOut }} />
    </AbsoluteFill>
  );
};

const PlayButton: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 10, stiffness: 200 } });
  return (
    <div style={{
      transform: `scale(${s})`, background: 'linear-gradient(#9be07c, #6cc05a)', border: `9px solid ${BROWN}`, borderRadius: 999,
      padding: '18px 70px', boxShadow: '0 14px 0 #2b1a0e, 0 30px 60px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 22,
    }}>
      <span style={{ fontSize: 60, color: BROWN }}>▶</span>
      <span style={{ fontFamily, fontWeight: 700, fontSize: 74, color: BROWN, letterSpacing: 2 }}>PLAY NOW</span>
    </div>
  );
};

// ------------------------------------------------------------------ sound design
const S: React.FC<{ at: number; name: string; volume?: number }> = ({ at, name, volume = 1 }) => (
  <Sequence from={at} durationInFrames={150}>
    <Audio src={sfx(name)} volume={volume} />
  </Sequence>
);

const SoundDesign: React.FC = () => (
  <>
    <S at={138} name="whoosh" volume={0.5} />
    <S at={282} name="whoosh" volume={0.45} />
    {MONTAGE.map((_, i) => <S key={i} at={5 * BAR + i * BAR + 3} name={i === 6 ? 'boing' : 'pop'} volume={0.55} />)}
    <S at={5 * BAR + 30} name="dig" volume={0.25} />
    <S at={862} name="scratch" volume={0.7} />
    <S at={900} name="impact" volume={0.9} />
    <S at={930} name="whoosh" volume={0.5} />
    <S at={936} name="thump" volume={0.8} />
    <S at={960} name="dig" volume={0.45} />
    <S at={1000} name="dig" volume={0.4} />
    <S at={1034} name="sparkle" volume={0.4} />
    <S at={1074} name="whoosh" volume={0.45} />
    <S at={1080} name="thump" volume={0.8} />
    <S at={1170} name="build" volume={0.6} />
    <S at={1224} name="thump" volume={0.7} />
    <S at={1232} name="love" volume={0.7} />
    <S at={1296} name="thump" volume={0.7} />
    <S at={1320} name="click" volume={0.6} />
    <S at={1345} name="click" volume={0.6} />
    <S at={1368} name="thump" volume={0.7} />
    <S at={1440} name="thump" volume={0.7} />
    <S at={1452} name="sparkle" volume={0.55} />
    <S at={1506} name="whoosh" volume={0.55} />
    <S at={1704} name="riser" volume={0.55} />
    <S at={1800} name="impact" volume={1} />
    <S at={1806} name="sparkle" volume={0.6} />
    <S at={1872} name="pop" volume={0.4} />
    <S at={1908} name="pop" volume={0.5} />
    {[0, 4, 8, 12].map(d => <S key={d} at={1980 + d} name="pop" volume={0.35} />)}
    <S at={2088} name="whoosh" volume={0.45} />
    <S at={2112} name="pop" volume={0.5} />
    <S at={2230} name="boop" volume={0.8} />
    <S at={2246} name="thump" volume={0.6} />
  </>
);

// ------------------------------------------------------------------ the trailer
export const Trailer: React.FC<{ url?: string }> = ({ url = '' }) => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: '#000', fontFamily }}>
      <Shake>
        <Sequence durationInFrames={5 * BAR}><Intro /></Sequence>
        <Montage />
        <Sequence from={12 * BAR} durationInFrames={BAR}><Break /></Sequence>
        <Features />
        <Sequence from={21 * BAR} durationInFrames={4 * BAR}><Climax /></Sequence>
        <Sequence from={25 * BAR} durationInFrames={4 * BAR}><Title /></Sequence>
        <Sequence from={29 * BAR} durationInFrames={durationInFrames - 29 * BAR}><EndCard url={url} /></Sequence>
      </Shake>
      <Letterbox openAt={4 * BAR} />
      <Vignette />
      <Grain />
      <Audio
        src={staticFile('audio/music.wav')}
        volume={f => interpolate(f, [0, 6, durationInFrames - 30, durationInFrames], [0, 0.9, 0.9, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
      />
      <SoundDesign />
    </AbsoluteFill>
  );
};
