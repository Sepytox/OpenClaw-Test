# Audio Files — Vrooooom SoundCheck

## Source
Royalty-free motorcycle engine sounds.
Sources: soundbible.com (public domain audio library)

## File Structure
{bike-id}-{variant}.mp3

### Bikes
- zx6r     → Kawasaki Ninja ZX-6R (600cc Supersport)
- z900     → Kawasaki Z900 (naked)
- zx10r    → Kawasaki Ninja ZX-10R (1000cc Superbike)
- z650rs   → Kawasaki Z650RS (retro/classic)
- versys650 → Kawasaki Versys 650 (adventure)
- h2r      → Kawasaki Ninja H2R (supercharged)

### Variants
- stock    → OEM / stock exhaust sound
- racing   → Racing exhaust (Akrapovic/Arrow style)
- custom   → Custom exhaust (Yoshimura/SC-Project style)

## Fallback
If an MP3 fails to load (404, CORS, or other error), 
the soundcheck.js automatically falls back to Web Audio API synthesis.

## License
Audio files are royalty-free for non-commercial use.
