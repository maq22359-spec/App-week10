import { MEME_TARGETS } from "./processing";

export default function AlignmentOverlay() {
  return <svg className="meme-alignment-overlay" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Translucent meme template with matching eye and facial feature openings">
    <defs><mask id="meme-template-openings"><rect width="1000" height="1000" fill="white" />{MEME_TARGETS.map((target, index) => <ellipse key={index} cx={target.x * 1000} cy={target.y * 1000} rx={target.rx * 1000} ry={target.ry * 1000} fill="black" />)}</mask></defs>
    <image href="/memes/thinking-template.jpg" width="1000" height="1000" preserveAspectRatio="none" mask="url(#meme-template-openings)" opacity=".57" />
    {MEME_TARGETS.map((target, index) => <g key={index}><ellipse cx={target.x * 1000} cy={target.y * 1000} rx={target.rx * 1000} ry={target.ry * 1000} fill="none" stroke={index < 2 ? "#d9ffac" : "#d9ffac88"} strokeWidth={index < 2 ? 4 : 2} strokeDasharray="11 8" />{index < 2 && <><path d={`M${target.x * 1000 - 12} ${target.y * 1000}h24m-12-12v24`} stroke="#d9ffac" strokeWidth="2" /><text x={target.x * 1000} y={(target.y - target.ry) * 1000 - 16} textAnchor="middle" fill="#efffdb" fontSize="19" stroke="#1c291b" strokeWidth="4" paintOrder="stroke">{target.label}</text></>}</g>)}
  </svg>;
}
