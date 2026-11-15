"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {loadAuthDeployment} from "@/lib/platform/auth-client";
import type {DeploymentConfig} from "@/lib/platform/deployment";

/**
 * The legacy/default and standalone Academy installations retain the family-first
 * homepage. Explicit multi-product deployments present the SaaS suite homepage.
 * Product capabilities do not grant access; each destination verifies its own roles.
 */
export default function HomePage(){
  const [deployment,setDeployment]=useState<DeploymentConfig|null>(null);
  const [unavailable,setUnavailable]=useState(false);
  useEffect(()=>{
    let active=true;
    void loadAuthDeployment().then(value=>{if(active)setDeployment(value);})
      .catch(()=>{if(active)setUnavailable(true);});
    return ()=>{active=false;};
  },[]);
  if(!deployment){
    return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24}}>
      <div role={unavailable?"alert":"status"} style={{textAlign:"center"}}>
        <img src="/brand/robotronix-horizontal.png" alt="Robotronix" style={{width:190,maxWidth:"100%"}}/>
        <p>{unavailable?"Unable to load application configuration. Please refresh.":"Loading Robotronix…"}</p>
      </div>
    </main>;
  }
  if(deployment.mode!=="combined" || deployment.legacyDefault || deployment.products.length===1){
    return <AcademyHomePage/>;
  }
  return <SuiteHomePage products={deployment.products}/>;
}

function SuiteHomePage({products}:{products:readonly string[]}){
  const options=[
    {id:"portal",name:"Academy",description:"Bring classes, curriculum, learners and family progress into one clear view.",symbol:"✦",tag:"LEARNING OPERATIONS",color:"#6958d9",features:["Learner journeys","Classes & progress"]},
    {id:"crm",name:"Connect CRM",description:"Turn conversations into stronger relationships, from first enquiry to admission.",symbol:"◎",tag:"GROWTH & RELATIONSHIPS",color:"#138f9b",features:["Enquiries & admissions","Connected conversations"]},
    {id:"tasks",name:"My Tasks",description:"Bring focus to the work that moves your education business forward.",symbol:"✓",tag:"TEAM PRODUCTIVITY",color:"#c0783b",features:["Daily priorities","Team coordination"]}
  ].filter(item=>products.includes(item.id));
  return <main className="suitePremium">
    <style>{`
      .suitePremium{min-height:100vh;overflow:hidden;position:relative;color:#172444;background:radial-gradient(ellipse 700px 470px at 89% 12%,rgba(145,212,237,.33),transparent 74%),radial-gradient(ellipse 750px 530px at 8% 21%,rgba(179,161,245,.25),transparent 72%),linear-gradient(155deg,#fcfdff 0%,#f4f6ff 54%,#f8fbfd 100%)}
      .suitePremium *{box-sizing:border-box}
      .suiteShell{max-width:1250px;margin:auto;padding-left:clamp(22px,4vw,56px);padding-right:clamp(22px,4vw,56px)}
      .suiteHeader{display:flex;justify-content:space-between;align-items:center;gap:24px;padding-top:25px;padding-bottom:24px;flex-wrap:wrap}
      .suiteLogo{display:flex;align-items:center;gap:14px;text-decoration:none;color:#263657}
      .suiteLogo img{width:clamp(205px,20vw,265px);height:auto;display:block}
      .suiteLogo small{font-size:11px;letter-spacing:.13em;font-weight:800;color:#6b7290;border-left:1px solid #cfd6e8;padding-left:14px}
      .suiteNav{display:flex;align-items:center;flex-wrap:wrap;gap:26px}
      .suiteNav a{font-size:14px;font-weight:700;text-decoration:none;color:#344467}
      .suiteNav a:last-child,.suitePrimary{background:linear-gradient(110deg,#5e45d4,#258de5);color:white!important;border-radius:12px;padding:14px 22px;box-shadow:0 9px 26px rgba(65,75,194,.19);text-decoration:none;font-weight:750;display:inline-flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s}
      .suiteNav a:last-child:hover,.suitePrimary:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(65,75,194,.26)}
      .suiteHero{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(0,.98fr);align-items:center;gap:clamp(35px,5vw,72px);padding-top:clamp(70px,8vw,118px);padding-bottom:clamp(70px,9vw,120px)}
      .suiteEyebrow{display:inline-flex;align-items:center;gap:9px;border:1px solid #d6dafa;background:#fffafcbb;padding:9px 14px;border-radius:30px;font-size:11px;font-weight:850;letter-spacing:.13em;color:#5846b6}
      .suiteEyebrow:before{content:"";width:8px;height:8px;border-radius:50%;background:#57b7d6;box-shadow:0 0 0 4px #57b7d628}
      .suiteHero h1{font-size:clamp(43px,4.8vw,69px);letter-spacing:-.055em;line-height:1.08;margin:26px 0 23px;font-weight:800;max-width:650px}
      .suiteHero h1 span{color:#6351cd}
      .suiteLead{font-size:clamp(16px,1.55vw,19px);line-height:1.8;color:#61708b;max-width:530px;margin:0 0 31px}
      .suiteActions{display:flex;flex-wrap:wrap;align-items:center;gap:13px}
      .suiteSecondary{border:1px solid #d4d9e8;padding:13px 21px;border-radius:12px;background:#ffffffbd;text-decoration:none;color:#314369;font-weight:750}
      .suiteProof{margin-top:31px;display:flex;align-items:center;gap:9px;color:#697892;font-size:13px}
      .suiteProof strong{color:#35446f}
      .suiteVisual{position:relative;padding:20px 10px 25px;isolation:isolate}
      .suiteVisual:before{content:"";position:absolute;inset:4% -4%;z-index:-1;background:radial-gradient(ellipse at center,rgba(100,97,220,.25),transparent 67%);filter:blur(28px)}
      .suitePreview{border-radius:23px;border:1px solid #e1e5f5;box-shadow:0 30px 80px rgba(29,46,91,.15),0 3px 12px rgba(29,46,91,.06);background:#fff;overflow:hidden;transform:rotate(-1.5deg)}
      .suitePreviewTop{display:flex;align-items:center;justify-content:space-between;padding:19px 22px;background:#f8f9ff;border-bottom:1px solid #e9ecf6}
      .suiteDots{display:flex;gap:6px}.suiteDots i{width:8px;height:8px;border-radius:100%;background:#d4d9ed}.suiteDots i:first-child{background:#8a7bf0}.suiteDots i:nth-child(2){background:#85c9df}
      .suitePreviewTop span{font-size:11px;font-weight:750;letter-spacing:.09em;color:#64708c}
      .suitePreviewBody{display:grid;grid-template-columns:75px 1fr;min-height:360px}
      .suitePreviewRail{background:#24234e;padding:23px 20px;display:flex;align-items:center;flex-direction:column;gap:19px}
      .suitePreviewRail i{width:27px;height:27px;border-radius:9px;background:#ffffff25;border:1px solid #ffffff29}
      .suitePreviewRail i:first-child{background:linear-gradient(140deg,#846efa,#45b7d1)}
      .suitePreviewMain{padding:26px 25px}
      .suitePreviewLabel{color:#817b9d;font-size:11px;font-weight:800;letter-spacing:.12em}
      .suitePreviewMain h3{margin:8px 0 22px;font-size:23px;letter-spacing:-.04em}
      .suiteMiniGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .suiteMini{background:#f5f6fc;border:1px solid #e9eaf7;border-radius:13px;padding:14px 11px;min-height:104px}
      .suiteMini b{display:block;font-size:20px;margin-bottom:8px}.suiteMini span{font-size:11px;color:#6d7894;line-height:1.45}
      .suitePreviewFlow{margin-top:18px;padding:16px;border:1px solid #e9ecf7;border-radius:14px;background:#fff}
      .suitePreviewFlow p{font-size:12px;color:#54607d;font-weight:800;margin:0 0 13px}
      .suiteFlowLine{height:9px;border-radius:20px;background:#edf0f7;overflow:hidden;margin-bottom:11px}.suiteFlowLine i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#7968df,#6ac6d5);width:73%}
      .suiteFlowLine:nth-of-type(2) i{width:49%;background:linear-gradient(90deg,#69b8d1,#b0d7e3)}
      .suiteFlowLine:nth-of-type(3) i{width:86%;background:linear-gradient(90deg,#ac9af0,#d8cffa)}
      .suiteFloat{position:absolute;z-index:2;right:-4%;bottom:-8px;padding:14px 19px;background:#fff;box-shadow:0 16px 38px #283c7e22;border:1px solid #e4e8f3;border-radius:14px;font-size:12px;color:#586784;transform:rotate(3deg)}
      .suiteFloat strong{display:block;font-size:14px;color:#27365d;margin-bottom:3px}
      .suiteProducts{padding-top:30px;padding-bottom:90px}
      .suiteSectionIntro{text-align:center;margin:auto auto 35px;max-width:680px}
      .suiteSectionIntro .suiteEyebrow{font-size:10px}
      .suiteSectionIntro h2{font-size:clamp(31px,3.3vw,46px);letter-spacing:-.045em;margin:18px 0 13px}
      .suiteSectionIntro p{color:#697790;line-height:1.7;margin:0}
      .suiteCards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:19px}
      .suiteCard{padding:29px;border-radius:22px;background:#ffffffdf;border:1px solid #e0e6f3;box-shadow:0 14px 40px rgba(38,51,111,.05);transition:transform .2s,box-shadow .2s}
      .suiteCard:hover{transform:translateY(-5px);box-shadow:0 20px 48px rgba(38,51,111,.1)}
      .suiteCardIcon{width:54px;height:54px;display:grid;place-items:center;font-size:27px;border-radius:16px;margin-bottom:26px}
      .suiteTag{font-size:10px;font-weight:850;letter-spacing:.13em;color:#7d849b}
      .suiteCard h3{font-size:25px;letter-spacing:-.035em;margin:9px 0 11px}
      .suiteCard p{line-height:1.65;color:#697790;font-size:14px;min-height:70px}
      .suiteFeatures{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
      .suiteFeatures span{border:1px solid #e4e8f3;border-radius:8px;background:#f8f9fd;padding:8px 10px;color:#596582;font-weight:650;font-size:11px}
      .suitePromise{text-align:center;padding:24px 0 72px;color:#6b7893;font-size:13px}
      .suiteFooter{border-top:1px solid #e3e7f1;padding:26px 0;color:#64728e;font-size:13px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:15px}
      .suiteFooter a{color:inherit;text-decoration:none}
      @media(max-width:900px){.suiteHero{grid-template-columns:1fr;padding-top:55px}.suiteVisual{max-width:600px;width:100%;margin:0 auto}.suiteHeroCopy{text-align:center}.suiteHero h1,.suiteLead{margin-left:auto;margin-right:auto}.suiteActions,.suiteProof{justify-content:center}.suiteCards{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:590px){.suiteLogo img{width:200px}.suiteLogo small{display:none}.suiteNav{gap:15px}.suiteNav a{font-size:12px}.suiteHero h1{font-size:42px}.suiteCards{grid-template-columns:1fr}.suitePreviewBody{grid-template-columns:50px 1fr}.suitePreviewRail{padding:20px 12px}.suitePreviewMain{padding:18px 13px}.suiteMini{padding:10px 7px}.suiteMini b{font-size:16px}.suiteMini span{font-size:9px}.suiteFloat{right:0}.suiteProducts{padding-bottom:45px}}
      @media(prefers-reduced-motion:reduce){.suiteCard,.suitePrimary,.suiteNav a:last-child{transition:none}.suiteCard:hover,.suitePrimary:hover,.suiteNav a:last-child:hover{transform:none}}
    `}</style>
    <header className="suiteShell suiteHeader">
      <Link className="suiteLogo" href="/" aria-label="Robotronix Education Suite home"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/><small>EDUCATION SUITE</small></Link>
      <nav className="suiteNav" aria-label="Main navigation"><a href="#products">Platform</a><Link href="/login">Sign in</Link><Link href="/signup">Get started <span aria-hidden="true"> ↗</span></Link></nav>
    </header>
    <section className="suiteShell suiteHero">
      <div className="suiteHeroCopy">
        <span className="suiteEyebrow">ONE CONNECTED EDUCATION WORKSPACE</span>
        <h1>Everything your academy needs. <span>Beautifully connected.</span></h1>
        <p className="suiteLead">From learning and admissions to everyday teamwork, manage your education business in one thoughtfully designed workspace.</p>
        <div className="suiteActions"><Link className="suitePrimary" href="/signup">Get started <span aria-hidden="true"> &nbsp;↗</span></Link><Link className="suiteSecondary" href="/login">Sign in to your workspace</Link></div>
        <div className="suiteProof"><span aria-hidden="true">✧</span><strong>One sign-in</strong><span>·</span> Secure organizations <span>·</span> Flexible products</div>
      </div>
      <div className="suiteVisual" aria-label="Illustrative preview of a unified education workspace">
        <div className="suitePreview"><div className="suitePreviewTop"><div className="suiteDots"><i/><i/><i/></div><span>EDUCATION SUITE / WORKSPACE</span></div>
          <div className="suitePreviewBody"><div className="suitePreviewRail"><i/><i/><i/><i/></div><div className="suitePreviewMain">
            <span className="suitePreviewLabel">WORKSPACE PREVIEW</span><h3>Your academy, in sync.</h3>
            <div className="suiteMiniGrid"><div className="suiteMini"><b style={{color:"#6455c6"}}>✦</b><span>Academy<br/>Learning & progress</span></div><div className="suiteMini"><b style={{color:"#138f9b"}}>◎</b><span>Connect CRM<br/>Enquiries & growth</span></div><div className="suiteMini"><b style={{color:"#c0783b"}}>✓</b><span>My Tasks<br/>Focus & teamwork</span></div></div>
            <div className="suitePreviewFlow"><p>Connected workflows</p><div className="suiteFlowLine"><i/></div><div className="suiteFlowLine"><i/></div><div className="suiteFlowLine"><i/></div></div>
          </div></div>
        </div><div className="suiteFloat"><strong>✦ Designed to work together</strong>One account · Your selected tools</div>
      </div>
    </section>
    <section className="suiteShell suiteProducts" id="products" aria-labelledby="suite-products-heading">
      <div className="suiteSectionIntro"><span className="suiteEyebrow">BUILT AROUND YOUR BUSINESS</span><h2 id="suite-products-heading">One platform. Your way of working.</h2><p>Start with the tools you need. Keep the clarity of one workspace while each application stays focused on its purpose.</p></div>
      <div className="suiteCards">{options.map(item=><article className="suiteCard" key={item.id}>
        <div className="suiteCardIcon" style={{background:item.color+"12",color:item.color}} aria-hidden="true">{item.symbol}</div>
        <span className="suiteTag">{item.tag}</span><h3>{item.name}</h3><p>{item.description}</p>
        <div className="suiteFeatures">{item.features.map(feature=><span key={feature}>{feature}</span>)}</div>
      </article>)}</div>
    </section>
    <div className="suiteShell suitePromise">One secure sign-in &nbsp; • &nbsp; Organization-based access &nbsp; • &nbsp; Products that grow with you</div>
    <footer className="suiteShell suiteFooter"><span>© Robotronix Education Suite</span><div><Link href="/privacy">Privacy</Link> &nbsp; · &nbsp; <Link href="/terms">Terms</Link> &nbsp; · &nbsp; <Link href="/support">Support</Link></div></footer>
  </main>;
}

function AcademyHomePage(){
  return (
    <main className="portalLanding portalLandingV14 portalLandingFinal simplifiedLanding parentFirstLanding finalHomeV3">
      <header className="landingNav">
        <img src="/brand/robotronix-horizontal.png" alt="Robotronix"/>
        <span className="landingProduct">Learning Portal</span>
      </header>

      <section className="landingHero globalLandingHero finalLandingHero parentHero finalHeroV3">
        <div className="landingCopy finalHeroCopyV3">
          <h1 className="finalHeroTitleV3">
            <span>See the learning.</span>
            <em>Feel the progress.</em>
          </h1>

          <p className="finalHeroLeadV3">
            Stay on top of classes, projects, mentor feedback and learning progress —
            all in one clear place.
          </p>

          <div className="landingHeroActions finalHeroActionsV3">
            <Link className="button heroPrimary" href="/onboarding">Start family onboarding</Link>
            <Link className="button heroSecondary" href="/login">Existing user? Sign in</Link>
          </div>
        </div>

        <div className="landingStemVisual premiumStemStage finalHeroVisualV3">
          <div className="stemGlow glowOne"/>
          <div className="stemGlow glowTwo"/>
          <div className="stemPhotoFrame">
            <img
              src="/experience/online-robotics-ai-hero.png"
              alt="Young learners building a robotics project with an online mentor"
            />
          </div>
        </div>
      </section>

      <section className="learningMomentStrip simpleBenefitStrip finalBenefitGridV2" aria-label="What families can follow">
        <article>
          <div className="momentIcon">⚙</div>
          <div>
            <span>PROJECTS & PROGRESS</span>
            <b>See what is being built and learned.</b>
            <p>Follow completed projects, milestones and how learning is moving forward.</p>
          </div>
        </article>

        <article>
          <div className="momentIcon">◷</div>
          <div>
            <span>CLASSES & SCHEDULE</span>
            <b>Know what is coming next.</b>
            <p>Keep upcoming sessions, timings and learning continuity in one place.</p>
          </div>
        </article>

        <article>
          <div className="momentIcon">↗</div>
          <div>
            <span>MENTOR FEEDBACK</span>
            <b>Understand progress and next steps.</b>
            <p>See observations, strengths and recommended next steps from the mentor.</p>
          </div>
        </article>
      </section>

      <footer className="landingFooter">
        Robotronix™ Learning Portal · <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Use</Link> · <Link href="/support">Support</Link> · <Link href="/zoom-guide">Zoom Guide</Link>
      </footer>
    </main>
  );
}
