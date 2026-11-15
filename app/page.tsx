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
  {id:"crm",number:"01",name:"Connect CRM",category:"ATTRACT & CONVERT",description:"Capture enquiries from your channels, organize conversations, schedule demos and guide prospective families through admissions.",symbol:"C",accent:"#14b8a6",features:"Enquiries · Follow-ups · Admissions"},
  {id:"portal",number:"02",name:"Academy",category:"TEACH & ENGAGE",description:"Manage learners, courses, trainers and classes in one place—while keeping families informed about schedules and progress.",symbol:"A",accent:"#6d3cc9",features:"Learning · Scheduling · Progress"},
  {id:"tasks",number:"03",name:"My Tasks",category:"PLAN & DELIVER",description:"Turn priorities into action with a clear daily plan, personal tasks, delegated work and team accountability.",symbol:"T",accent:"#e83d8c",features:"My Day · Assignments · Teamwork"}
 ].filter(x=>products.includes(x.id));
 return <main className="rxLanding">
 <style>{`
 .rxLanding{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#182541;min-height:100vh;background:#fbf9fe;overflow:hidden}
 .rxLanding *{box-sizing:border-box}
 .rxWrap{width:min(1320px,calc(100% - 80px));margin:0 auto}
 .rxHead{height:104px;display:flex;align-items:center;justify-content:space-between;gap:24px}
 .rxBrand{display:flex;align-items:center;gap:22px;text-decoration:none}
 .rxBrand img{display:block;width:265px;height:auto}
 .rxBrand small{border-left:1px solid #d2d9eb;padding-left:18px;font-size:12px;letter-spacing:.15em;font-weight:800;color:#58647d}
 .rxNav{display:flex;align-items:center;gap:33px}
 .rxNav a{text-decoration:none;color:#2c3a54;font-size:15px;font-weight:700}
 .rxPrimary{background:#6d3cc9!important;color:white!important;display:inline-flex;align-items:center;gap:13px;border-radius:10px;padding:16px 23px;text-decoration:none;font-weight:750;font-size:15px;box-shadow:0 9px 20px #6d3cc920;transition:background .2s,transform .2s}
 .rxPrimary:hover{background:#4f27a8!important;transform:translateY(-2px)}
 .rxMainHero{background:radial-gradient(ellipse at 80% 40%,#f0e3fc 0%,transparent 50%),radial-gradient(ellipse at 14% 8%,#f4e7fb 0%,transparent 45%),linear-gradient(180deg,#fbfcff,#f8f4fd);border-top:1px solid #eee4f5;border-bottom:1px solid #eae0f3}
 .rxHero{display:grid;grid-template-columns:1.07fr .93fr;align-items:center;gap:60px;padding-top:76px;padding-bottom:82px}
 .rxEyebrow{font-size:12px;letter-spacing:.16em;color:#6d3cc9;font-weight:800;display:inline-flex;gap:12px;align-items:center}
 .rxEyebrow:before{content:"";width:22px;height:2px;background:#e83d8c}
 .rxHero h1{font-size:clamp(49px,4.7vw,73px);line-height:1.075;letter-spacing:-.055em;font-weight:800;margin:24px 0 24px;max-width:710px}
 .rxHero h1 em{font-style:normal;color:#6d3cc9}
 .rxHero p{max-width:570px;font-size:19px;line-height:1.7;color:#606a82;margin:0 0 31px}
 .rxHeroActions{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
 .rxOutline{display:inline-flex;align-items:center;padding:15px 22px;border:1px solid #dfd5ec;border-radius:10px;color:#233451;text-decoration:none;background:#fff9;font-weight:750;font-size:15px}
 .rxBenefit{display:flex;flex-wrap:wrap;gap:22px;margin-top:35px;color:#54657f;font-size:13px;font-weight:650}
 .rxBenefit span:before{content:"✓";font-weight:900;color:#348f93;margin-right:8px}
 .rxShowcase{background:#fff;box-shadow:0 32px 78px #4f27a82a,0 0 0 6px #ffffff9e;border:1px solid #e3d9f3;border-radius:24px;overflow:hidden;min-height:400px}
 .rxShowTop{height:59px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid #edf0f6}
 .rxShowTop span{font-size:11px;letter-spacing:.13em;font-weight:800;color:#71809b}
 .rxLights{display:flex;gap:7px}.rxLights i{height:9px;width:9px;border-radius:50%;background:#d9ddec}.rxLights i:first-child{background:#8981df}.rxLights i:nth-child(2){background:#96cbd4}
 .rxShowBody{display:grid;grid-template-columns:77px 1fr;min-height:338px}
 .rxRail{background:#35205e;display:flex;flex-direction:column;align-items:center;gap:18px;padding-top:28px}
 .rxRail i{height:29px;width:29px;border-radius:9px;background:#ffffff24}.rxRail i:first-child{background:#6d3cc9}
 .rxShowContent{padding:30px}
 .rxShowContent h3{font-size:23px;letter-spacing:-.03em;margin:0 0 6px}
 .rxShowContent>p{font-size:12px;color:#74819a;margin:0 0 24px}
 .rxFeatureGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}
 .rxFeature{border:1px solid #e8ecf5;border-radius:13px;padding:16px 13px;background:#fbf8ff}
 .rxFeature b{font-size:24px;display:block;margin-bottom:14px}.rxFeature strong{display:block;font-size:12px;color:#293655;margin-bottom:5px}.rxFeature small{font-size:11px;color:#7d89a0}
 .rxWorkflow{margin-top:17px;border-radius:12px;border:1px solid #e8ecf5;padding:16px;background:white}
 .rxWorkflow strong{font-size:12px}.rxWorkflow div{height:9px;margin-top:13px;border-radius:20px;background:#edf0f8;overflow:hidden}
 .rxWorkflow i{display:block;background:#8655d6;width:72%;height:100%;border-radius:20px}.rxWorkflow div:last-child i{width:48%;background:#69b7c6}
 .rxSection{padding-top:88px;padding-bottom:100px}
 .rxSectionHeading{display:flex;justify-content:space-between;align-items:end;gap:30px;margin-bottom:32px}
 .rxSectionHeading h2{font-size:clamp(33px,3vw,46px);letter-spacing:-.045em;line-height:1.1;max-width:600px;margin:14px 0 0}
 .rxSectionHeading p{max-width:370px;color:#687791;line-height:1.65;font-size:16px;margin:0}
 .rxCards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
 .rxCard{border:1px solid #e7ddf0;background:linear-gradient(155deg,#fff 70%,#fcf9ff);border-radius:24px;padding:33px 32px;min-height:316px;box-shadow:0 14px 38px #4f27a812;display:flex;flex-direction:column;transition:transform .2s,box-shadow .2s}
 .rxCard:hover{transform:translateY(-4px);box-shadow:0 22px 44px #6d3cc925}
 .rxCard:before{content:"";position:absolute;top:0;left:30px;right:30px;height:3px;border-radius:0 0 5px 5px;background:linear-gradient(90deg,#6d3cc9,#e83d8c,#14b8a6);opacity:.75}.rxCard{position:relative;overflow:hidden}.rxCardTop{display:flex;align-items:center;justify-content:space-between;margin-bottom:25px}
 .rxCardIcon{width:58px;height:58px;border-radius:17px;display:grid;place-items:center;font-weight:800;font-size:21px}
 .rxCardNum{color:#a2abc0;font-size:12px;font-weight:800;letter-spacing:.1em}
 .rxCard h3{font-size:27px;letter-spacing:-.03em;margin:0 0 7px}
 .rxCardCategory{font-size:12px;color:#6d3cc9;font-weight:800;letter-spacing:.04em;margin:0 0 14px}
 .rxCardDesc{color:#697892;line-height:1.6;font-size:14px;margin:0 0 22px}
 .rxCardBottom{margin-top:auto;border-top:1px solid #eef0f5;padding-top:17px;color:#4d5b78;font-size:12px;font-weight:750}
 .rxFooter{padding:25px 0;border-top:1px solid #e6eaf3;display:flex;justify-content:space-between;gap:18px;color:#7b879b;font-size:13px}
 .rxFooter a{color:inherit;text-decoration:none}
 @media(max-width:980px){.rxWrap{width:min(100% - 48px,800px)}.rxHero{grid-template-columns:1fr;gap:45px;padding-top:54px}.rxShowcase{max-width:660px}.rxSectionHeading{align-items:start;flex-direction:column}.rxCards{grid-template-columns:repeat(2,minmax(0,1fr))}}
 @media(max-width:640px){.rxWrap{width:calc(100% - 36px)}.rxHead{height:auto;padding-top:20px;padding-bottom:20px;align-items:start;flex-direction:column;gap:19px}.rxBrand img{width:210px}.rxBrand small{font-size:9px;padding-left:10px}.rxNav{gap:20px}.rxNav a{font-size:13px}.rxNav .rxPrimary{padding:11px 15px}.rxHero h1{font-size:44px}.rxHero p{font-size:16px}.rxHero{padding-top:44px;padding-bottom:56px}.rxShowBody{grid-template-columns:49px 1fr}.rxRail{padding-top:22px}.rxRail i{width:21px;height:21px}.rxShowContent{padding:20px 12px}.rxFeature{padding:11px 7px}.rxFeature b{font-size:19px}.rxFeature strong{font-size:10px}.rxFeature small{font-size:9px}.rxSection{padding:64px 0}.rxCards{grid-template-columns:1fr}.rxCard{min-height:260px}.rxFooter{flex-wrap:wrap}}
 @media(prefers-reduced-motion:reduce){.rxCard,.rxPrimary{transition:none}.rxCard:hover,.rxPrimary:hover{transform:none}}
 `}</style>
 <header className="rxWrap rxHead"><Link href="/" className="rxBrand" aria-label="Robotronix Education Suite home"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/><small>EDUCATION SUITE</small></Link><nav className="rxNav" aria-label="Main navigation"><a href="#products">Products</a><Link href="/login">Sign in</Link><Link href="/signup" className="rxPrimary">Get started <span aria-hidden="true">↗</span></Link></nav></header>
 <div className="rxMainHero"><section className="rxWrap rxHero"><div><span className="rxEyebrow">ROBOTRONIX EDUCATION SUITE</span><h1>One platform.<br/>Every part of your academy, <em>connected.</em></h1><p>Run learning, manage relationships and organize your team with a beautifully simple workspace built for modern education businesses.</p><div className="rxHeroActions"><Link href="/signup" className="rxPrimary">Get started <span aria-hidden="true">↗</span></Link><Link href="/login" className="rxOutline">Sign in to your workspace</Link></div><div className="rxBenefit"><span>Single sign-in</span><span>Secure organizations</span><span>Modular by design</span></div></div>
 <div className="rxShowcase" aria-label="Illustrative product workspace preview"><div className="rxShowTop"><div className="rxLights"><i/><i/><i/></div><span>WORKSPACE PREVIEW</span></div><div className="rxShowBody"><div className="rxRail"><i/><i/><i/><i/></div><div className="rxShowContent"><h3>Your workspace</h3><p>Everything you need, in one place</p><div className="rxFeatureGrid"><div className="rxFeature"><b style={{color:"#6d3cc9"}}>✦</b><strong>Academy</strong><small>Learning & progress</small></div><div className="rxFeature"><b style={{color:"#14a597"}}>◎</b><strong>Connect CRM</strong><small>Leads & admissions</small></div><div className="rxFeature"><b style={{color:"#e83d8c"}}>✓</b><strong>My Tasks</strong><small>Team priorities</small></div></div><div className="rxWorkflow"><strong>Working better, together</strong><div><i/></div><div><i/></div></div></div></div></div></section></div>
 <section className="rxWrap rxSection" id="products" aria-labelledby="rxProductsTitle"><div className="rxSectionHeading"><div><span className="rxEyebrow">YOUR EDUCATION BUSINESS, CONNECTED</span><h2 id="rxProductsTitle">From first enquiry to every learning milestone.</h2></div><p>Build stronger relationships, deliver organized learning and keep your team moving—all from a single education workspace.</p></div><div className="rxCards">{options.map(x=><article className="rxCard" key={x.id}><div className="rxCardTop"><span className="rxCardIcon" style={{color:x.accent,background:x.accent+"13"}}>{x.symbol}</span><span className="rxCardNum">{x.number}</span></div><h3>{x.name}</h3><div className="rxCardCategory">{x.category}</div><p className="rxCardDesc">{x.description}</p><div className="rxCardBottom">{x.features}</div></article>)}</div></section>
 <footer className="rxWrap rxFooter"><span>© Robotronix Education Suite</span><span><Link href="/privacy">Privacy</Link> &nbsp;·&nbsp; <Link href="/terms">Terms</Link> &nbsp;·&nbsp; <Link href="/support">Support</Link></span></footer>
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
