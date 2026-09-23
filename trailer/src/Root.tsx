import React from 'react';
import { Composition } from 'remotion';
import { Trailer, TRAILER_FRAMES } from './Trailer';
import { Cover, COVER_FRAME, CoverVariant } from './Cover';

// cover stills: [id, variant, width, height]
const COVERS: [string, CoverVariant, number, number][] = [
  ['CoverWide', 'wide', 1920, 1080],   // key art / YouTube thumbnail (render with --scale=2 for 4K)
  ['CoverOG', 'og', 1200, 630],        // link preview (Open Graph / Twitter)
  ['CoverHeader', 'header', 920, 430], // Steam-style header capsule (2x of 460x215)
  ['CoverTall', 'tall', 600, 900],     // vertical library capsule (render with --scale=2)
];

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Trailer"
      component={Trailer}
      durationInFrames={TRAILER_FRAMES}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ url: '' }}
    />
    {COVERS.map(([id, variant, width, height]) => (
      <Composition key={id} id={id} component={Cover} durationInFrames={COVER_FRAME + 1} fps={30} width={width} height={height} defaultProps={{ variant }} />
    ))}
  </>
);
