export const avatarIds = ['knight', 'mage', 'archer', 'healer', 'rogue', 'smith'];
const palettes: Record<string, string[]> = {
  knight: ['#715340', '#739ab7', '#d7e6ed'], mage: ['#594965', '#8d7fba', '#d4c9f0'],
  archer: ['#775532', '#6d9164', '#d5e4ab'], healer: ['#b48356', '#e6dfca', '#94bfa8'],
  rogue: ['#605779', '#8589a2', '#ded2be'], smith: ['#8b482d', '#b97f52', '#e1c288'],
};
const sprite = [
  '................', '.....hhhhhh.....', '....hhhhhhhh....', '....hssssssh....',
  '....hskssksh....', '.....ssssss.....', '......ssss......', '....cccccacc....',
  '...scccccccss...', '...scccccccss...', '...scccccccss...', '....cccccacc....',
  '.....pppppp.....', '.....pp..pp.....', '....bbb..bbb....', '................',
];
export function Avatar({ kind = 'knight', size = 44 }: { kind?: string; size?: number }) {
  const p = palettes[kind] || palettes.knight;
  const colors: Record<string, string> = { h: p[0], s: '#f3ccac', k: '#33434b', c: p[1], a: p[2], p: '#535d68', b: '#655340' };
  return <span className={`avatar avatar-${kind}`} style={{ width: size, height: size }}><svg viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
    {sprite.flatMap((row, y) => [...row].map((v, x) => v === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={colors[v]} />))}
    {kind === 'mage' && <path d="M4 3h8v1H3V3h2V2h1V1h3v1h2v1" fill={p[1]} />}
    {kind === 'healer' && <path d="M7 1h2v1h2v1H9v2H7V3H5V2h2" fill="#f4e8b9" />}
    {kind === 'archer' && <path d="M11 1h1v2h-1v2h-1V3h1" fill="#e8d19a" />}
    {kind === 'knight' && <path d="M4 3V2h1V1h6v1h1v2h-2V3H6v1H4" fill={p[2]} />}
  </svg></span>;
}
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    world: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c6 5 6 13 0 18-6-5-6-13 0-18" /></>,
    guild: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 11 3 3 5-6" /></>,
    private: <><path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z" /><path d="M8 10h8M8 14h5" /></>,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    send: <><path d="m3 3 18 9-18 9 4-9-4-9Z" /><path d="M7 12h14" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5" /></>,
    exit: <><path d="M10 3H4v18h6M8 12h13m-5-5 5 5-5 5" /></>,
    sparkle: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /><path d="M20 2v4m-2-2h4" /></>,
    settings: <><path d="m9 3-1 3-3 1 1 4-2 2 2 3 3-1 2 3h3l1-3 4-1-1-4 2-2-2-3-3 1-2-3H9Z" /><circle cx="12" cy="10" r="3" /></>,
    arrow: <path d="m9 5 7 7-7 7" />,
    smile: <><circle cx="12" cy="12" r="9" /><path d="M8 9h.01M16 9h.01M8 14c2 4 6 4 8 0" /></>,
    book: <><path d="M4 3h14v18H4zM8 3v18M11 8h4M11 12h4" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.guild}</svg>;
}
export function Landscape() {
  return <svg className="landscape" viewBox="0 0 900 550" preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges" aria-hidden="true">
    <rect width="900" height="550" fill="#a9cbd1" />
    <path d="M0 45h80V30h90v15h60v20H0Zm390 30h50V15h95v15h60v40H390Zm310 80h70v-20h80v20h50v25H700" fill="#e8ede0" />
    <path d="M0 250h70v-35h45v-30h50v-40h70v35h40v35h50v35h60v60H0Zm350 10h60v-35h40v-40h60v-40h80v40h45v45h45v45h80v50H350Z" fill="#83a9b1" />
    <path d="M0 320h90v-35h90v-25h90v35h120v-35h120v25h80v-45h130v45h80v-20h100v285H0Z" fill="#87a77c" />
    <path d="M0 390h120v-40h120v30h100v-25h150v30h140v-35h150v30h120v170H0Z" fill="#5d8769" />
    <path d="M450 330h40v65h50v50h70v45h80v60H370v-45h60v-45h35v-40h-15Z" fill="#c6bc91" />
    <g transform="translate(185 190)"><path d="M30 80h100v130H30z" fill="#e5d9b9" /><path d="M15 80V65h15V50h15V35h20V20h30v15h20v15h15v15h15v15Z" fill="#a76e5a" /><path d="M15 80h130v12H15M70 133h30v77H70" fill="#665f53" /><path d="M43 110h16v25H43m65-25h16v25h-16" fill="#789daf" /><path d="M40 87h8v120h-8m65-120h8v120h-8M30 155h100v8H30" fill="#aa9674" /></g>
    <g transform="translate(610 245)"><path d="M20 45h90v100H20" fill="#e2d2ad" /><path d="M5 45V30h20V15h20V0h35v15h20v15h20v15Z" fill="#8a7377" /><path d="M20 45h90v8H20m35 43h25v49H55" fill="#675d51" /><path d="M30 65h15v18H30m55-18h15v18H85" fill="#8fb1b8" /></g>
    {[50, 105, 370, 765, 815, 850].map((x, i) => <g key={x} transform={`translate(${x} ${290 + i % 3 * 35})`}><path d="M-5 0H5v115H-5" fill="#74674c" /><path d="M-35 65V45h10V25h12V5h26v20h12v20h10v20Z" fill={i % 2 ? '#42694f' : '#4d7658'} /><path d="M-25 45h12V25H0V12h8v25h10v20h-43" fill="#658962" /></g>)}
    <path d="M0 500h110v-30h100v20h100v60H0m650-20h100v-25h80v-35h70v80H650" fill="#426951" />
    {[60, 140, 325, 570, 740, 810].map((x, i) => <g key={x}><rect x={x} y={460 + i % 3 * 22} width="5" height="10" fill="#d7cf9a" /><rect x={x - 3} y={458 + i % 3 * 22} width="11" height="4" fill="#e6b3a0" /></g>)}
  </svg>;
}
