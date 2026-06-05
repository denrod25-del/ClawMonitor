// renderer/palette.js
export const PALETTES = {
  'classic-synthwave': {
    cpu:'#22d3ee', ram:'#34d399', gpu:'#f472b6', net:'#a78bfa',
    disk:'#fb923c', warn:'#fbbf24', up:'#34d399', down:'#475569',
    border:'#7c3aed', glow:'rgba(124,58,237,0.55)'
  },
  'tron-ice':  { cpu:'#22d3ee', ram:'#67e8f9', gpu:'#38bdf8', net:'#7dd3fc', disk:'#0ea5e9', warn:'#fbbf24', up:'#22d3ee', down:'#475569', border:'#0ea5e9', glow:'rgba(14,165,233,0.55)' },
  'toxic':     { cpu:'#a3e635', ram:'#34d399', gpu:'#22d3ee', net:'#84cc16', disk:'#eab308', warn:'#f59e0b', up:'#a3e635', down:'#475569', border:'#65a30d', glow:'rgba(101,163,13,0.55)' }
}
export function palette(name) { return PALETTES[name] || PALETTES['classic-synthwave'] }
