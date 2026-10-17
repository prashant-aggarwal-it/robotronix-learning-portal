export function DemoHeroVisual({completed=false}:{completed?:boolean}){
 return <div className={"demoHeroVisual "+(completed?"completed":"")} aria-hidden="true">
  <svg viewBox="0 0 520 360" role="img">
   <defs>
    <linearGradient id="demoBg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#eff7ff"/><stop offset=".52" stopColor="#f8f5ff"/><stop offset="1" stopColor="#fff6e9"/></linearGradient>
    <linearGradient id="demoBot" x1="0" x2="1"><stop offset="0" stopColor="#5d79ff"/><stop offset="1" stopColor="#53c9d7"/></linearGradient>
    <linearGradient id="demoDesk" x1="0" x2="1"><stop offset="0" stopColor="#dfe8f7"/><stop offset="1" stopColor="#f6eadc"/></linearGradient>
    <filter id="demoShadow"><feDropShadow dx="0" dy="12" stdDeviation="14" floodOpacity=".12"/></filter>
   </defs>
   <rect width="520" height="360" rx="34" fill="url(#demoBg)"/>
   <circle cx="435" cy="68" r="34" fill="#fff" opacity=".8"/><path d="M423 68h24M435 56v24" stroke="#7d6de8" strokeWidth="5" strokeLinecap="round"/>
   <circle cx="82" cy="76" r="8" fill="#ffb34c"/><circle cx="109" cy="52" r="5" fill="#62cdb1"/><circle cx="468" cy="126" r="6" fill="#5f7ef6"/>
   <path d="M54 128h64l19 19h72" fill="none" stroke="#c8d8f5" strokeWidth="4" strokeLinecap="round"/><circle cx="54" cy="128" r="7" fill="#fff" stroke="#7fa0e8" strokeWidth="3"/>
   <rect x="72" y="258" width="378" height="34" rx="17" fill="url(#demoDesk)"/>
   <g filter="url(#demoShadow)">
    <rect x="112" y="174" width="156" height="93" rx="10" fill="#203454"/>
    <rect x="122" y="184" width="136" height="72" rx="7" fill="#f8fbff"/>
    <path d="M164 217l-18 12 18 12M216 217l18 12-18 12M198 205l-15 48" fill="none" stroke="#5f7ef6" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
   </g>
   <g transform="translate(289 101)" filter="url(#demoShadow)">
    <rect x="0" y="48" width="121" height="95" rx="31" fill="#fff"/>
    <rect x="16" y="59" width="89" height="56" rx="24" fill="#162b4c"/>
    <ellipse cx="42" cy="86" rx="7" ry="10" fill="#58e6dd"/><ellipse cx="79" cy="86" rx="7" ry="10" fill="#58e6dd"/>
    <path d="M47 101q14 10 28 0" fill="none" stroke="#58e6dd" strokeWidth="4" strokeLinecap="round"/>
    <rect x="37" y="135" width="47" height="45" rx="16" fill="url(#demoBot)"/>
    <path d="M60 48V27" stroke="#5f7ef6" strokeWidth="5" strokeLinecap="round"/><circle cx="60" cy="20" r="8" fill="#ffb34c"/>
    <path d="M9 131l-24 23M112 131l24 23" stroke="#8da3d5" strokeWidth="9" strokeLinecap="round"/>
   </g>
   <g transform="translate(195 94)">
    <circle cx="0" cy="35" r="34" fill="#f2b789"/>
    <path d="M-32 31q5-43 37-42 33 2 38 34-17-8-31-24-9 19-44 32z" fill="#32324a"/>
    <path d="M-29 78q27-18 58 0l15 82h-89z" fill="#667df4"/>
    <circle cx="-11" cy="34" r="3" fill="#27324a"/><circle cx="12" cy="34" r="3" fill="#27324a"/>
    <path d="M-8 49q9 7 18 0" fill="none" stroke="#a95d4e" strokeWidth="3" strokeLinecap="round"/>
    <path d="M-35 96l-43 38M35 96l41 36" stroke="#f2b789" strokeWidth="11" strokeLinecap="round"/>
   </g>
   {completed?<g><path d="M71 199l9 15 18 3-13 13 3 18-17-8-16 8 3-18-13-13 18-3z" fill="#ffb43f"/><path d="M432 201l7 12 14 2-10 10 2 14-13-6-13 6 3-14-11-10 15-2z" fill="#63cfad"/></g>:<g><rect x="365" y="36" width="77" height="34" rx="17" fill="#fff" opacity=".9"/><circle cx="384" cy="53" r="6" fill="#5f7ef6"/><path d="M397 47h29M397 57h21" stroke="#8899ba" strokeWidth="4" strokeLinecap="round"/></g>}
  </svg>
 </div>;
}
