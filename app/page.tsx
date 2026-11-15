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
    {id:"portal",name:"Academy",description:"Learning, classes, curriculum, student progress and family engagement.",href:"/login",symbol:"🎓"},
    {id:"crm",name:"Connect CRM",description:"Manage enquiries, conversations, admissions and relationships.",href:"/login?next=%2Fconnect",symbol:"◈"},
    {id:"tasks",name:"My Tasks",description:"Plan priorities, delegate work and keep your team moving.",href:"/login?next=%2Ftasks",symbol:"✓"}
  ].filter(item=>products.includes(item.id));
  return <main style={{minHeight:"100vh",background:"linear-gradient(155deg,#f8faff 0%,#eef2ff 52%,#f9fbff 100%)",color:"#172341"}}>
    <header style={{maxWidth:1180,margin:"auto",padding:"24px clamp(20px,4vw,48px)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
      <Link href="/" aria-label="Robotronix Education Suite home"><img src="/brand/robotronix-horizontal.png" alt="Robotronix" style={{width:190,maxWidth:"100%"}}/></Link>
      <nav aria-label="Main navigation" style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"}}>
        <a href="#products" style={{color:"#374569",fontWeight:600,textDecoration:"none"}}>Products</a>
        <Link href="/login" style={{color:"#374569",fontWeight:600}}>Sign in</Link>
        <Link href="/login" className="button" style={{textDecoration:"none"}}>Get started</Link>
      </nav>
    </header>
    <section style={{maxWidth:1180,margin:"auto",padding:"clamp(56px,8vw,110px) clamp(20px,4vw,48px) 70px",textAlign:"center"}}>
      <span style={{display:"inline-block",padding:"8px 16px",borderRadius:100,background:"#e6eafe",color:"#3c358e",fontWeight:700,fontSize:13,letterSpacing:".03em"}}>ONE PLATFORM · YOUR EDUCATION BUSINESS</span>
      <h1 style={{maxWidth:850,margin:"24px auto",fontSize:"clamp(38px,5.5vw,72px)",lineHeight:1.12,letterSpacing:"-.035em"}}>Run your academy. Connect your team. Grow with confidence.</h1>
      <p style={{maxWidth:660,margin:"0 auto 30px",fontSize:"clamp(17px,2vw,21px)",lineHeight:1.65,color:"#53617e"}}>Bring learning operations, customer relationships and everyday tasks together, with access designed for each organization and role.</p>
      <div style={{display:"flex",justifyContent:"center",gap:14,flexWrap:"wrap"}}>
        <Link href="/login" className="button" style={{textDecoration:"none"}}>Get started</Link>
        <a href="#products" className="button secondary" style={{textDecoration:"none"}}>Explore products</a>
      </div>
    </section>
    <section id="products" aria-labelledby="suite-products-heading" style={{maxWidth:1180,margin:"auto",padding:"18px clamp(20px,4vw,48px) 90px",scrollMarginTop:24}}>
      <h2 id="suite-products-heading" style={{fontSize:"clamp(27px,3vw,38px)",textAlign:"center",marginBottom:10}}>Choose the tools that fit your academy</h2>
      <p style={{textAlign:"center",color:"#53617e",margin:"0 0 32px"}}>One shared sign-in. Independent applications. Permissions tailored to each user.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,260px),1fr))",gap:18}}>
        {options.map(item=><article key={item.id} style={{padding:28,borderRadius:20,background:"#fff",border:"1px solid #dfe5f5",boxShadow:"0 10px 35px rgba(39,57,105,.06)"}}>
          <div aria-hidden="true" style={{fontSize:34,marginBottom:18}}>{item.symbol}</div>
          <h3 style={{fontSize:24,marginBottom:12}}>{item.name}</h3>
          <p style={{color:"#53617e",lineHeight:1.65,minHeight:84}}>{item.description}</p>
          <Link href={item.href} style={{fontWeight:700,color:"#4537a5"}}>Sign in to {item.name} →</Link>
        </article>)}
      </div>
    </section>
    <footer style={{borderTop:"1px solid #dfe5f5",padding:"24px 20px",textAlign:"center",color:"#586581",fontSize:14}}>
      Robotronix Education Suite · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/support">Support</Link>
    </footer>
  </main>;
}

"use client";
import Link from "next/link";

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
