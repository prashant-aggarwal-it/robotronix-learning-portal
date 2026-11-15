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

function ProductIcon({kind}:{kind:string}){
 const pathProps={stroke:"currentColor",strokeWidth:1.9,fill:"none",strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
 return <svg aria-hidden="true" viewBox="0 0 24 24" width="29" height="29" {...pathProps}>
  {kind==="crm"?<><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.1-.64L4 20l1.64-5.4A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8.5 10h8M8.5 13.5h5"/></>:kind==="academy"?<><path d="m2 9.2 10-5 10 5-10 5-10-5Z"/><path d="M6.5 12v4.1c3.2 2.9 7.8 2.9 11 0V12M22 9.2v6"/></>:<><rect x="5" y="4" width="14" height="17" rx="2"/><path d="m8.1 10 1.5 1.5 2.5-3M13.5 10H16M8 16h8"/></>}
 </svg>;
}

function SuiteHomePage({products}:{products:readonly string[]}){
 const options=[
  {id:"crm",number:"01",name:"Connect CRM",category:"ATTRACT & CONVERT",description:"Capture enquiries, manage conversations and demos, and guide prospective learners from first interest to enrollment.",symbol:"crm",accent:"#14b8a6",features:"Enquiries · Demos · Enrollment"},
  {id:"portal",number:"02",name:"Academy",category:"TEACH & ENGAGE",description:"Deliver courses across subjects and skill levels, manage classes and trainers, and keep learners informed about their progress.",symbol:"academy",accent:"#6d3cc9",features:"Courses · Classes · Progress"},
  {id:"tasks",number:"03",name:"My Tasks",category:"PLAN & DELIVER",description:"Plan daily priorities, assign responsibilities and track the work that keeps your learning organization moving.",symbol:"tasks",accent:"#e83d8c",features:"Planning · Delegation · Follow-ups"}
 ].filter(x=>products.includes(x.id));
 return <main className="rxLanding">
 <style>{`
 .rxLanding{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17183f;min-height:100vh;background:radial-gradient(ellipse 80% 22% at 50% 0%,#efe1ff90,transparent),#fcfaff;overflow:hidden}
 .rxLanding *{box-sizing:border-box}
 .rxWrap{width:min(1320px,calc(100% - 80px));margin:0 auto}
 .rxHead{height:112px;position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:24px}
 .rxBrand{display:flex;align-items:center;gap:22px;text-decoration:none}
 .rxBrand img{display:block;width:285px;height:auto;filter:drop-shadow(0 3px 8px #7043a017)}
 .rxBrand small{border-left:1px solid #d2d9eb;padding-left:18px;font-size:12px;letter-spacing:.15em;font-weight:800;color:#58647d}
 .rxNav{display:flex;align-items:center;gap:33px}
 .rxNav a{text-decoration:none;color:#2c3a54;font-size:15px;font-weight:700}.rxNav .rxNavLogin{background:#fff9;border:1px solid #d7c6f0;padding:12px 22px;border-radius:12px;color:#542fa9}
 .rxPrimary{background:linear-gradient(105deg,#6d3cc9,#cb319e)!important;color:white!important;display:inline-flex;align-items:center;gap:13px;border-radius:16px;padding:17px 26px;text-decoration:none;font-weight:750;font-size:15px;box-shadow:0 12px 28px #9b33c345,0 3px 0 #ffffff40 inset;transition:background .2s,transform .2s}
 .rxPrimary:hover{background:#4f27a8!important;transform:translateY(-2px)}
 .rxMainHero{position:relative;background:radial-gradient(ellipse 46% 70% at 82% 48%,#bcb1ff73 0%,#ffd9f245 52%,transparent 84%),radial-gradient(ellipse 44% 80% at 3% 15%,#f3e5ff 0%,transparent 85%),linear-gradient(112deg,#fffaff 0%,#fbf6ff 48%,#f2faff 100%);border-top:1px solid #eee4f5;border-bottom:1px solid #e8ddf4}.rxMainHero:after{content:"";pointer-events:none;position:absolute;right:-9%;bottom:-75px;width:45%;height:160px;border-radius:50%;background:linear-gradient(100deg,#a659e714,#ec4ba819,#26b8d51f);filter:blur(30px)}
 .rxHero{display:grid;grid-template-columns:1.04fr .96fr;align-items:center;gap:38px;padding-top:30px;padding-bottom:44px}
 .rxEyebrow{font-size:12px;letter-spacing:.16em;color:#6d3cc9;font-weight:800;display:inline-flex;gap:12px;align-items:center}
 .rxEyebrow:before{content:"";width:22px;height:2px;background:#e83d8c}
 .rxHero h1{font-size:clamp(42px,4vw,60px);line-height:1.105;letter-spacing:-.045em;font-weight:800;margin:17px 0 17px;max-width:690px}
 .rxHero h1 em{font-style:normal;background:linear-gradient(105deg,#693bcc 25%,#c936a1 83%);-webkit-background-clip:text;background-clip:text;color:transparent}
 .rxHero p{max-width:580px;font-size:17px;line-height:1.6;color:#59677f;margin:0 0 23px}
 .rxHeroActions{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
 .rxOutline{display:inline-flex;align-items:center;padding:16px 24px;border:1px solid #bba2ed;border-radius:16px;color:#233451;text-decoration:none;background:#ffffffdf;box-shadow:0 8px 24px #6035b810;font-weight:750;font-size:15px}
 .rxBenefit{display:flex;flex-wrap:wrap;gap:18px;margin-top:23px;color:#54657f;font-size:13px;font-weight:650}.rxFirstTimeNote{font-size:13px!important;line-height:1.55!important;margin:12px 0 17px!important;color:#636886!important}.rxSetupSteps{display:flex;gap:13px;align-items:center;flex-wrap:wrap;color:#505d79;font-size:12px;font-weight:700}.rxSetupSteps span{display:inline-flex;align-items:center;gap:7px}.rxSetupSteps b{height:23px;width:23px;border-radius:50%;display:inline-grid;place-items:center;background:#eee6ff;color:#5a30bd;font-size:11px}
 .rxBenefit span:before{content:"✓";font-weight:900;color:#348f93;margin-right:8px}
 .rxHeroIllustration{position:relative;border-radius:30px;isolation:isolate;transform:perspective(1500px) rotateY(-3deg);transition:transform .4s ease}.rxHeroIllustration:hover{transform:perspective(1500px) rotateY(0)}.rxHeroIllustration:before{content:"";position:absolute;inset:-24px;background:radial-gradient(ellipse at 55% 52%,#bba5f385,transparent 72%);filter:blur(22px);z-index:-1}.rxHeroImage{display:block;position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;border-radius:22px;z-index:2;box-shadow:0 28px 70px #6d3cc923}.rxShowcase{background:#fff;box-shadow:18px 38px 75px #4f27a838,-5px -5px 30px #ffffffb9,0 0 0 5px #ffffffb5;border:1px solid #e3d9f3;border-radius:22px;overflow:hidden}
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
 .rxClassScene{height:93px;border-radius:9px;background:linear-gradient(130deg,#30205f,#7255ba 62%,#9f65aa);position:relative;display:flex;align-items:center;justify-content:center;gap:13px;overflow:hidden}
 .rxClassScene:before{content:"";position:absolute;width:125px;height:125px;border-radius:50%;background:#ffffff12;right:-50px;top:-60px}
 .rxAvatar{height:46px;width:46px;border-radius:15px;background:#e7dafe;color:#5f40b2;display:grid;place-items:center;font-size:23px;font-weight:800;z-index:1}
 .rxAvatar.mentor{background:#bdece5;color:#087d7f}.rxAvatar{box-shadow:0 9px 16px #180c454d;border:2px solid #ffffff6b}
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
 .rxSection{position:relative;padding-top:76px;padding-bottom:95px}.rxSection:before{content:"";position:absolute;pointer-events:none;z-index:0;left:-12%;top:0;width:38%;height:90%;background:radial-gradient(ellipse,#4cddd217,transparent 70%)}.rxSection>*{position:relative;z-index:1}
 .rxSectionHeading{display:block;max-width:890px;margin:0 auto 42px;text-align:center}
 .rxSectionHeading h2{font-size:clamp(34px,3.4vw,49px);letter-spacing:-.045em;line-height:1.15;max-width:780px;margin:16px auto 14px}
 .rxSectionHeading p{max-width:670px;color:#687791;line-height:1.6;font-size:17px;margin:0 auto}
 .rxCards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.rxCard:not(:last-child):after{content:"›";position:absolute;right:-14px;top:45%;width:27px;height:27px;display:grid;place-items:center;border-radius:50%;background:#fff;color:#6d3cc9;box-shadow:0 4px 13px #5026a12a;font-size:25px;z-index:4}.rxCards{isolation:isolate}.rxCard{overflow:visible!important}
 .rxCard{border:1px solid #e5d8f3;background:linear-gradient(155deg,#fff 70%,#fcf9ff);border-radius:26px;padding:33px 32px;min-height:316px;box-shadow:0 15px 35px #4f27a814,0 3px 1px #ffffffa0 inset;display:flex;flex-direction:column;transition:transform .2s,box-shadow .2s}
 .rxCard:hover{transform:translateY(-4px);box-shadow:0 25px 54px #6d3cc927}
 .rxCard:before{content:"";position:absolute;top:0;left:30px;right:30px;height:3px;border-radius:0 0 5px 5px;background:linear-gradient(90deg,#6d3cc9,#e83d8c,#14b8a6);opacity:.75}.rxCard{position:relative;overflow:hidden}.rxCard:nth-child(1){background:radial-gradient(circle at 95% 6%,#b9f8f063,transparent 44%),linear-gradient(145deg,#fff 54%,#effbf9)}.rxCard:nth-child(2){background:radial-gradient(circle at 95% 6%,#e2c7ff90,transparent 44%),linear-gradient(145deg,#fff 54%,#f7f0ff)}.rxCard:nth-child(3){background:radial-gradient(circle at 95% 6%,#ffc5e68a,transparent 44%),linear-gradient(145deg,#fff 54%,#fff2f8)}.rxCardTop{display:flex;align-items:center;justify-content:space-between;margin-bottom:25px}
 .rxCardIcon{width:60px;height:60px;border-radius:19px;box-shadow:0 7px 20px #643b9d18,0 2px 0 #fff9 inset;display:grid;place-items:center;font-weight:800;font-size:21px}
 .rxCardNum{color:#a2abc0;font-size:12px;font-weight:800;letter-spacing:.1em}
 .rxCard h3{font-size:27px;letter-spacing:-.03em;margin:0 0 7px}
 .rxCardCategory{font-size:12px;color:#6d3cc9;font-weight:800;letter-spacing:.04em;margin:0 0 14px}
 .rxCardDesc{color:#697892;line-height:1.6;font-size:14px;margin:0 0 22px}
 .rxCardBottom{margin-top:auto;border-top:1px solid #eef0f5;padding-top:17px;color:#4d5b78;font-size:12px;font-weight:750}
 .rxAfterProducts{display:flex;justify-content:center;align-items:center;flex-direction:column;gap:20px;margin-top:28px}.rxCapabilities{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:11px 23px;color:#586681;font-size:13px;font-weight:650;text-align:center}.rxCapabilities span:before{content:"✓";color:#12a397;margin-right:8px;font-weight:900}.rxAfterProducts .rxPrimary{padding:14px 23px}.rxCardIcon svg{display:block}.rxFooter{padding:25px 0;border-top:1px solid #e6eaf3;display:flex;justify-content:space-between;gap:18px;color:#7b879b;font-size:13px}
 .rxFooter a{color:inherit;text-decoration:none}
 @media(max-width:980px){.rxCard:not(:last-child):after{display:none}.rxHeroIllustration{transform:none}.rxHeroIllustration:hover{transform:none}.rxWrap{width:min(100% - 48px,800px)}.rxHero{grid-template-columns:1fr;gap:28px;padding-top:36px}.rxShowcase{max-width:660px}.rxSectionHeading{align-items:start;flex-direction:column}.rxCards{grid-template-columns:repeat(2,minmax(0,1fr))}}
 @media(max-width:640px){.rxWrap{width:calc(100% - 36px)}.rxHead{height:auto;padding-top:20px;padding-bottom:20px;align-items:start;flex-direction:column;gap:19px}.rxBrand img{width:210px}.rxBrand small{font-size:9px;padding-left:10px}.rxNav{gap:20px}.rxNav a{font-size:13px}.rxNav .rxPrimary{padding:11px 15px}.rxHero h1{font-size:44px}.rxHero p{font-size:16px}.rxHero{padding-top:30px;padding-bottom:40px}.rxShowBody{grid-template-columns:42px minmax(0,1fr)}.rxDash{padding:10px}.rxKpi{padding:8px 5px}.rxDashCard{padding:8px}.rxDashGrid{grid-template-columns:1fr 1fr}.rxClassScene{height:82px}.rxAvatar{height:35px;width:35px;font-size:16px}.rxDashBottom{grid-template-columns:1fr 1fr}.rxRail{padding-top:22px}.rxRail i{width:21px;height:21px}.rxShowContent{padding:20px 12px}.rxFeature{padding:11px 7px}.rxFeature b{font-size:19px}.rxFeature strong{font-size:10px}.rxFeature small{font-size:9px}.rxSection{padding:64px 0}.rxCards{grid-template-columns:1fr}.rxCard{min-height:260px}.rxFooter{flex-wrap:wrap}}
 @media(prefers-reduced-motion:reduce){.rxHeroIllustration,.rxHeroIllustration:hover{transform:none;transition:none}.rxCard,.rxPrimary{transition:none}.rxCard:hover,.rxPrimary:hover{transform:none}}
 `}</style>
 <header className="rxWrap rxHead"><Link href="/" className="rxBrand" aria-label="Robotronix Education Suite home"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/><small>EDUCATION SUITE</small></Link><nav className="rxNav" aria-label="Main navigation"><a href="#products">Explore the platform</a><Link href="/login" className="rxNavLogin">Sign in</Link></nav></header>
 <div className="rxMainHero"><section className="rxWrap rxHero"><div><span className="rxEyebrow">ONE PLATFORM FOR EDUCATION & TRAINING</span><h1>Grow your education business.<br/><em>Connect every learning journey.</em></h1><p>Bring enquiries, enrollments, classes, learner progress and team operations together—so your people spend less time coordinating and more time helping learners succeed.</p><div className="rxHeroActions"><Link href="/signup" className="rxPrimary">Create your academy account <span aria-hidden="true">↗</span></Link></div><p className="rxFirstTimeNote">New here? Create your owner account to set up your organization and choose your applications.</p><div className="rxSetupSteps" aria-label="Getting started steps"><span><b>1</b> Create account</span><span><b>2</b> Set up organization</span><span><b>3</b> Choose applications</span></div></div>
 <div className="rxHeroIllustration"><div className="rxShowcase" aria-label="Illustrative dashboard showing academy classes, learner progress, admissions and tasks"><div className="rxShowTop"><div className="rxLights"><i/><i/><i/></div><span>ROBOTRONIX / WORKSPACE</span></div>
 <div className="rxShowBody"><div className="rxRail" aria-hidden="true"><span>R</span><span>⌂</span><span>◎</span><span>▤</span><span>✓</span></div>
 <div className="rxDash"><div className="rxDashTop"><h3>Workspace overview</h3><span className="rxDemoTag">ILLUSTRATIVE PREVIEW</span></div>
 <div className="rxKpis"><div className="rxKpi"><b>128</b><span>Enrolled learners</span></div><div className="rxKpi"><b>24</b><span>Open enquiries</span></div><div className="rxKpi"><b>7</b><span>Tasks today</span></div></div>
 <div className="rxDashGrid"><div className="rxDashCard"><div className="rxDashCardHead"><strong>Class in progress</strong><span className="rxLive">● Live demo</span></div><div className="rxClassScene"><div className="rxAvatar" aria-hidden="true">S</div><div className="rxAvatar mentor" aria-hidden="true">T</div><span className="rxClassJoin">INTERACTIVE LEARNING SESSION</span></div><div className="rxClassTitle">Digital Skills Workshop</div><div className="rxClassSub">Learners working with a mentor</div></div>
 <div className="rxDashCard"><div className="rxDashCardHead"><strong>Learner progress</strong><span style={{fontSize:10,color:"#8862cf"}}>↗</span></div><div className="rxClassSub">Career Skills Program</div><div className="rxProgressCount">72% <small>complete</small></div><div className="rxProgressTrack"><i/></div><div className="rxProgressMeta"><span>18 of 25 sessions</span><span>On track</span></div><div className="rxClassSub" style={{marginTop:14}}>Next: skills assessment</div></div></div>
 <div className="rxDashBottom"><div className="rxDashCard"><div className="rxDashCardHead"><strong>Enrollment pipeline</strong><span style={{fontSize:9,color:"#0e8f8b"}}>CRM</span></div><div className="rxFunnel"><div><b>8</b><span>Enquiries</span></div><div><b>5</b><span>Demos</span></div><div><b>3</b><span>Enrolled</span></div></div></div>
 <div className="rxDashCard"><div className="rxDashCardHead"><strong>Team priorities</strong><span style={{fontSize:9,color:"#bb478e"}}>TASKS</span></div><div className="rxTaskLine"><i/> Parent follow-up</div><div className="rxTaskLine"><i/> Review class feedback</div></div></div>
 </div></div></div><img className="rxHeroImage" src="/brand/robotronix-3d-students-hero.webp" alt="Students and educators exploring diverse skills in a colorful three-dimensional learning environment" onError={event=>{event.currentTarget.style.display="none";}}/></div></section></div>
 <section className="rxWrap rxSection" id="products" aria-labelledby="rxProductsTitle"><div className="rxSectionHeading"><div><span className="rxEyebrow">YOUR EDUCATION BUSINESS, CONNECTED</span><h2 id="rxProductsTitle">From first enquiry to lasting learning outcomes.</h2></div><p>Connect the full journey—from winning enrollments and delivering great teaching to keeping your team on track.</p></div><div className="rxCards">{options.map(x=><article className="rxCard" key={x.id}><div className="rxCardTop"><span className="rxCardIcon" style={{color:x.accent,background:x.accent+"13"}}><ProductIcon kind={x.symbol}/></span><span className="rxCardNum">{x.number}</span></div><h3>{x.name}</h3><div className="rxCardCategory">{x.category}</div><p className="rxCardDesc">{x.description}</p><div className="rxCardBottom">{x.features}</div></article>)}</div><div className="rxAfterProducts"><div className="rxCapabilities"><span>One shared sign-in</span><span>Organization-based access</span><span>Modular applications</span><span>Learning progress tracking</span></div></div></section>
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
