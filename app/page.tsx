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
 .rxPrimary{background:linear-gradient(105deg,#6d3cc9,#cb319e)!important;color:white!important;display:inline-flex;align-items:center;gap:13px;border-radius:10px;padding:16px 23px;text-decoration:none;font-weight:750;font-size:15px;box-shadow:0 9px 20px #6d3cc920;transition:background .2s,transform .2s}
 .rxPrimary:hover{background:#4f27a8!important;transform:translateY(-2px)}
 .rxMainHero{background:radial-gradient(ellipse at 80% 40%,#eee2fb 0%,transparent 53%),radial-gradient(ellipse at 14% 8%,#f9eaf5 0%,transparent 45%),linear-gradient(180deg,#fffafd,#f8f4fd);border-top:1px solid #eee4f5;border-bottom:1px solid #eae0f3}
 .rxHero{display:grid;grid-template-columns:1.07fr .93fr;align-items:center;gap:60px;padding-top:76px;padding-bottom:82px}
 .rxEyebrow{font-size:12px;letter-spacing:.16em;color:#6d3cc9;font-weight:800;display:inline-flex;gap:12px;align-items:center}
 .rxEyebrow:before{content:"";width:22px;height:2px;background:#e83d8c}
 .rxHero h1{font-size:clamp(49px,4.7vw,73px);line-height:1.075;letter-spacing:-.055em;font-weight:800;margin:24px 0 24px;max-width:710px}
 .rxHero h1 em{font-style:normal;background:linear-gradient(105deg,#693bcc 25%,#c936a1 83%);-webkit-background-clip:text;background-clip:text;color:transparent}
 .rxHero p{max-width:570px;font-size:19px;line-height:1.7;color:#606a82;margin:0 0 31px}
 .rxHeroActions{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
 .rxOutline{display:inline-flex;align-items:center;padding:15px 22px;border:1px solid #dfd5ec;border-radius:10px;color:#233451;text-decoration:none;background:#fff9;font-weight:750;font-size:15px}
 .rxBenefit{display:flex;flex-wrap:wrap;gap:22px;margin-top:35px;color:#54657f;font-size:13px;font-weight:650}
 .rxBenefit span:before{content:"✓";font-weight:900;color:#348f93;margin-right:8px}
 .rxHeroIllustration{position:relative;border-radius:28px;isolation:isolate}.rxHeroIllustration:before{content:"";position:absolute;inset:-24px;background:radial-gradient(ellipse at 55% 52%,#bba5f385,transparent 72%);filter:blur(22px);z-index:-1}.rxHeroImage{display:block;position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;border-radius:22px;z-index:2;box-shadow:0 28px 70px #6d3cc923}.rxShowcase{background:#fff;box-shadow:0 28px 70px #4f27a821,0 0 0 5px #ffffffb5;border:1px solid #e3d9f3;border-radius:22px;overflow:hidden}
 .rxShowTop{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 17px;border-bottom:1px solid #ece9f3;background:#fcfbff}
 .rxShowTop span{font-size:10px;letter-spacing:.08em;font-weight:800;color:#77819c}
 .rxLights{display:flex;gap:6px}.rxLights i{height:8px;width:8px;border-radius:50%;background:#d9ddec}.rxLights i:first-child{background:#8b70e0}.rxLights i:nth-child(2){background:#81c7c9}
 .rxShowBody{display:grid;grid-template-columns:54px minmax(0,1fr)}
 .rxRail{background:#33205b;display:flex;flex-direction:column;align-items:center;gap:14px;padding:19px 0}
 .rxRail span{height:30px;width:30px;display:grid;place-items:center;border-radius:9px;color:#d8c8f5;font-size:14px;font-weight:800}
 .rxRail span:first-child{background:#7447d4;color:white}
 .rxDash{background:#f8f7fd;padding:18px;min-width:0}
 .rxDashTop{display:flex;justify-content:space-between;align-items:center;gap:9px;margin-bottom:13px}
 .rxDashTop h3{font-size:17px;letter-spacing:-.035em;margin:0;color:#222743}
 .rxDemoTag{font-size:9px;font-weight:800;color:#6750b6;background:#eee9fb;border-radius:20px;padding:5px 8px;white-space:nowrap}
 .rxKpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px}
 .rxKpi{background:#fff;border:1px solid #e8e5f1;border-radius:11px;padding:11px 10px}
 .rxKpi b{display:block;font-size:20px;letter-spacing:-.04em;color:#282845}.rxKpi span{font-size:9px;color:#717c96;line-height:1.25;display:block;margin-top:3px}
 .rxDashGrid{display:grid;grid-template-columns:1.12fr .88fr;gap:9px;margin-bottom:9px}
 .rxDashCard{background:#fff;border:1px solid #e8e5f1;border-radius:12px;padding:12px;min-width:0}
 .rxDashCardHead{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}
 .rxDashCardHead strong{font-size:11px;color:#2d3152}
 .rxLive{font-size:9px;font-weight:800;border-radius:20px;padding:4px 7px;background:#eaf9f3;color:#158161}
 .rxClassScene{height:93px;border-radius:9px;background:linear-gradient(130deg,#30205f,#7255ba);position:relative;display:flex;align-items:center;justify-content:center;gap:13px;overflow:hidden}
 .rxClassScene:before{content:"";position:absolute;width:125px;height:125px;border-radius:50%;background:#ffffff12;right:-50px;top:-60px}
 .rxAvatar{height:46px;width:46px;border-radius:15px;background:#e7dafe;color:#5f40b2;display:grid;place-items:center;font-size:23px;font-weight:800;z-index:1}
 .rxAvatar.mentor{background:#bdece5;color:#087d7f}
 .rxClassJoin{position:absolute;bottom:7px;font-size:9px;color:#f0eafa;font-weight:750}
 .rxClassTitle{font-size:11px;font-weight:800;margin:9px 0 3px;color:#303451}.rxClassSub{font-size:9px;color:#7a8298}
 .rxProgressCount{font-size:19px;font-weight:850;color:#5b42c6;margin:5px 0}.rxProgressCount small{font-size:10px;color:#8b92aa;font-weight:600}
 .rxProgressTrack{height:7px;background:#eeebf6;border-radius:10px;overflow:hidden;margin:9px 0}
 .rxProgressTrack i{display:block;width:72%;height:100%;background:linear-gradient(90deg,#7952d4,#e46aa4);border-radius:10px}
 .rxProgressMeta{display:flex;justify-content:space-between;gap:5px;font-size:9px;color:#79849c}
 .rxDashBottom{display:grid;grid-template-columns:1fr 1fr;gap:9px}
 .rxFunnel{display:flex;gap:6px;align-items:center;justify-content:space-between}
 .rxFunnel div{flex:1;text-align:center;background:#f5f3fb;padding:8px 3px;border-radius:8px}
 .rxFunnel b{display:block;font-size:15px;color:#5f46ba}.rxFunnel span{display:block;font-size:8px;color:#7e859b;margin-top:2px}
 .rxTaskLine{font-size:9px;color:#5d6885;margin:6px 0;display:flex;gap:6px;align-items:center}
 .rxTaskLine i{width:12px;height:12px;flex-shrink:0;border:1px solid #b4a8d4;border-radius:4px;display:block}
 .rxSection{padding-top:88px;padding-bottom:100px}
 .rxSectionHeading{display:block;max-width:810px;margin:0 auto 38px;text-align:center}
 .rxSectionHeading h2{font-size:clamp(34px,3.4vw,49px);letter-spacing:-.045em;line-height:1.15;max-width:780px;margin:16px auto 14px}
 .rxSectionHeading p{max-width:670px;color:#687791;line-height:1.6;font-size:17px;margin:0 auto}
 .rxCards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
 .rxCard{border:1px solid #e7ddf0;background:linear-gradient(155deg,#fff 70%,#fcf9ff);border-radius:24px;padding:33px 32px;min-height:316px;box-shadow:0 14px 38px #4f27a812;display:flex;flex-direction:column;transition:transform .2s,box-shadow .2s}
 .rxCard:hover{transform:translateY(-4px);box-shadow:0 22px 44px #6d3cc925}
 .rxCard:before{content:"";position:absolute;top:0;left:30px;right:30px;height:3px;border-radius:0 0 5px 5px;background:linear-gradient(90deg,#6d3cc9,#e83d8c,#14b8a6);opacity:.75}.rxCard{position:relative;overflow:hidden}.rxCard:nth-child(1){background:linear-gradient(145deg,#fff 62%,#effbf9)}.rxCard:nth-child(2){background:linear-gradient(145deg,#fff 62%,#f7f0ff)}.rxCard:nth-child(3){background:linear-gradient(145deg,#fff 62%,#fff2f8)}.rxCardTop{display:flex;align-items:center;justify-content:space-between;margin-bottom:25px}
 .rxCardIcon{width:58px;height:58px;border-radius:17px;display:grid;place-items:center;font-weight:800;font-size:21px}
 .rxCardNum{color:#a2abc0;font-size:12px;font-weight:800;letter-spacing:.1em}
 .rxCard h3{font-size:27px;letter-spacing:-.03em;margin:0 0 7px}
 .rxCardCategory{font-size:12px;color:#6d3cc9;font-weight:800;letter-spacing:.04em;margin:0 0 14px}
 .rxCardDesc{color:#697892;line-height:1.6;font-size:14px;margin:0 0 22px}
 .rxCardBottom{margin-top:auto;border-top:1px solid #eef0f5;padding-top:17px;color:#4d5b78;font-size:12px;font-weight:750}
 .rxFooter{padding:25px 0;border-top:1px solid #e6eaf3;display:flex;justify-content:space-between;gap:18px;color:#7b879b;font-size:13px}
 .rxFooter a{color:inherit;text-decoration:none}
 @media(max-width:980px){.rxWrap{width:min(100% - 48px,800px)}.rxHero{grid-template-columns:1fr;gap:45px;padding-top:54px}.rxShowcase{max-width:660px}.rxSectionHeading{align-items:start;flex-direction:column}.rxCards{grid-template-columns:repeat(2,minmax(0,1fr))}}
 @media(max-width:640px){.rxWrap{width:calc(100% - 36px)}.rxHead{height:auto;padding-top:20px;padding-bottom:20px;align-items:start;flex-direction:column;gap:19px}.rxBrand img{width:210px}.rxBrand small{font-size:9px;padding-left:10px}.rxNav{gap:20px}.rxNav a{font-size:13px}.rxNav .rxPrimary{padding:11px 15px}.rxHero h1{font-size:44px}.rxHero p{font-size:16px}.rxHero{padding-top:44px;padding-bottom:56px}.rxShowBody{grid-template-columns:42px minmax(0,1fr)}.rxDash{padding:10px}.rxKpi{padding:8px 5px}.rxDashCard{padding:8px}.rxDashGrid{grid-template-columns:1fr 1fr}.rxClassScene{height:82px}.rxAvatar{height:35px;width:35px;font-size:16px}.rxDashBottom{grid-template-columns:1fr 1fr}.rxRail{padding-top:22px}.rxRail i{width:21px;height:21px}.rxShowContent{padding:20px 12px}.rxFeature{padding:11px 7px}.rxFeature b{font-size:19px}.rxFeature strong{font-size:10px}.rxFeature small{font-size:9px}.rxSection{padding:64px 0}.rxCards{grid-template-columns:1fr}.rxCard{min-height:260px}.rxFooter{flex-wrap:wrap}}
 @media(prefers-reduced-motion:reduce){.rxCard,.rxPrimary{transition:none}.rxCard:hover,.rxPrimary:hover{transform:none}}
 `}</style>
 <header className="rxWrap rxHead"><Link href="/" className="rxBrand" aria-label="Robotronix Education Suite home"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/><small>EDUCATION SUITE</small></Link><nav className="rxNav" aria-label="Main navigation"><a href="#products">Products</a><Link href="/login">Sign in</Link><Link href="/signup" className="rxPrimary">Get started <span aria-hidden="true">↗</span></Link></nav></header>
 <div className="rxMainHero"><section className="rxWrap rxHero"><div><span className="rxEyebrow">ROBOTRONIX EDUCATION SUITE</span><h1>One platform.<br/>Every part of your academy, <em>connected.</em></h1><p>Run learning, manage relationships and organize your team with a beautifully simple workspace built for modern education businesses.</p><div className="rxHeroActions"><Link href="/signup" className="rxPrimary">Get started <span aria-hidden="true">↗</span></Link><Link href="/login" className="rxOutline">Sign in to your workspace</Link></div><div className="rxBenefit"><span>Single sign-in</span><span>Secure organizations</span><span>Modular by design</span></div></div>
 <div className="rxHeroIllustration"><div className="rxShowcase" aria-label="Illustrative dashboard showing academy classes, learner progress, admissions and tasks"><div className="rxShowTop"><div className="rxLights"><i/><i/><i/></div><span>ROBOTRONIX / WORKSPACE</span></div>
 <div className="rxShowBody"><div className="rxRail" aria-hidden="true"><span>R</span><span>⌂</span><span>◎</span><span>▤</span><span>✓</span></div>
 <div className="rxDash"><div className="rxDashTop"><h3>Workspace overview</h3><span className="rxDemoTag">ILLUSTRATIVE PREVIEW</span></div>
 <div className="rxKpis"><div className="rxKpi"><b>128</b><span>Active learners</span></div><div className="rxKpi"><b>24</b><span>Open enquiries</span></div><div className="rxKpi"><b>7</b><span>Tasks today</span></div></div>
 <div className="rxDashGrid"><div className="rxDashCard"><div className="rxDashCardHead"><strong>Class in progress</strong><span className="rxLive">● Live demo</span></div><div className="rxClassScene"><div className="rxAvatar" aria-hidden="true">S</div><div className="rxAvatar mentor" aria-hidden="true">T</div><span className="rxClassJoin">STUDENT &amp; TRAINER SESSION</span></div><div className="rxClassTitle">Python Foundations</div><div className="rxClassSub">Student learning with a trainer</div></div>
 <div className="rxDashCard"><div className="rxDashCardHead"><strong>Learner progress</strong><span style={{fontSize:10,color:"#8862cf"}}>↗</span></div><div className="rxClassSub">Robotics Foundations</div><div className="rxProgressCount">72% <small>complete</small></div><div className="rxProgressTrack"><i/></div><div className="rxProgressMeta"><span>18 of 25 sessions</span><span>On track</span></div><div className="rxClassSub" style={{marginTop:14}}>Next: project showcase</div></div></div>
 <div className="rxDashBottom"><div className="rxDashCard"><div className="rxDashCardHead"><strong>Admissions pipeline</strong><span style={{fontSize:9,color:"#0e8f8b"}}>CRM</span></div><div className="rxFunnel"><div><b>8</b><span>Enquiries</span></div><div><b>5</b><span>Demos</span></div><div><b>3</b><span>Admissions</span></div></div></div>
 <div className="rxDashCard"><div className="rxDashCardHead"><strong>Team priorities</strong><span style={{fontSize:9,color:"#bb478e"}}>TASKS</span></div><div className="rxTaskLine"><i/> Parent follow-up</div><div className="rxTaskLine"><i/> Review class feedback</div></div></div>
 </div></div></div><img className="rxHeroImage" src="/brand/robotronix-3d-students-hero.webp" alt="Illustrated students collaborating on robotics and coding, with a connected education dashboard" onError={event=>{event.currentTarget.style.display="none";}}/></div></section></div>
 <section className="rxWrap rxSection" id="products" aria-labelledby="rxProductsTitle"><div className="rxSectionHeading"><div><span className="rxEyebrow">YOUR EDUCATION BUSINESS, CONNECTED</span><h2 id="rxProductsTitle">From the first enquiry to a thriving academy.</h2></div><p>Win new admissions. Deliver excellent learning. Keep your team on track.</p></div><div className="rxCards">{options.map(x=><article className="rxCard" key={x.id}><div className="rxCardTop"><span className="rxCardIcon" style={{color:x.accent,background:x.accent+"13"}}>{x.symbol}</span><span className="rxCardNum">{x.number}</span></div><h3>{x.name}</h3><div className="rxCardCategory">{x.category}</div><p className="rxCardDesc">{x.description}</p><div className="rxCardBottom">{x.features}</div></article>)}</div></section>
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
