import type {Metadata} from "next";
import Link from "next/link";
import styles from "../privacy/privacy.module.css";

export const metadata:Metadata={
 title:"Zoom Marketplace Reviewer Test Plan — Robotronix Classroom",
 description:"Step-by-step functional and scope-by-scope Zoom Marketplace review instructions for Robotronix Classroom.",
 robots:{index:false,follow:false},
 alternates:{canonical:"https://portal.robotronixstemlab.com/zoom-review-plan"},
};

const roles=[
 ["Administrator","robotronixstemlab+zoomadmin@gmail.com","Connect Zoom hosts, manage meetings and recordings"],
 ["Trainer","robotronixstemlab+zoomtrainer@gmail.com","View and join assigned classes"],
 ["Parent","robotronixstemlab+zoomparent@gmail.com","View only linked learner classes and permitted resources"],
 ["Student","robotronixstemlab+zoomstudent@gmail.com","View only assigned learning sessions"],
];
const scopes=[
 ["meeting:write:meeting","Create a disposable general meeting in Admin → Zoom","T04"],
 ["meeting:read:meeting","Sync Zoom meetings and verify metadata","T03"],
 ["meeting:update:meeting","Update a disposable meeting","T15"],
 ["meeting:delete:meeting","Cancel a disposable meeting","T15"],
 ["meeting:read:participant","Sync attendance for a completed sample meeting","T09"],
 ["user:read:user","Authorize a Zoom host and confirm its identity","T02"],
 ["user:read:zak","Start an authorized trainer-hosted meeting","T06"],
 ["cloud_recording:read:recording","Sync and inspect processed recording metadata","T09"],
 ["cloud_recording:read:list_recording_files","Locate, play and seek the processed MP4","T09–T10"],
 ["cloud_recording:delete:recording_file","Move a separate disposable file to Zoom Trash","T13"],
];
const tests=[
 ["T01","Admin","Sign in with password in a private window","Admin dashboard opens without access to email inbox"],
 ["T02","Admin","Connect a permitted Zoom host via Zoom OAuth","Correct Zoom identity linked; tokens never displayed"],
 ["T03","Admin","Sync Zoom host and meeting data","Host and meeting details reconcile"],
 ["T04","Admin","Create a disposable meeting or provision an eligible upcoming class","One intended meeting is created; retry does not duplicate"],
 ["T05","Trainer","Open assigned class","Only assigned classes and permitted actions visible"],
 ["T06","Trainer","Start or join an assigned Zoom classroom","Authorized meeting entry succeeds"],
 ["T07","Parent","Open linked learner's scheduled class","Linked class accessible; unrelated learner denied"],
 ["T08","Student","Open assigned learning session","Only student's own session accessible"],
 ["T09","Admin","Finish disposable meeting; await cloud MP4; sync","Processed MP4 appears; other file types not presented as video"],
 ["T10","Admin / authorized user","Play and seek disposable MP4","Secure authorized playback succeeds"],
 ["T11","Unauthorized user","Attempt another learner's recording and Zoom Admin access","Access denied; no media or tokens disclosed"],
 ["T12","Admin","Protect, unprotect and adjust retention of disposable recording","Recording settings persist as intended"],
 ["T13","Admin","Move separate disposable recording file to Zoom Trash","Only selected file is affected"],
 ["T14","Admin","Reauthorize the same Zoom host","Same Zoom user and existing meeting associations retained"],
 ["T15","Admin","Update then cancel disposable meeting","Zoom and portal reflect the changes"],
 ["T16","Zoom user / Admin","Remove disposable Zoom app authorization and inspect host","Verified deauthorization disables matching host; if event unavailable mark BLOCKED"],
 ["T17","All roles","Sign in independently and test role boundaries","Each role sees only permitted QA data"],
];
export default function ZoomReviewPlan(){
 return <main className={styles.page}>
 <header className={styles.header}><Link href="/"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link><Link href="/zoom-guide">End-user Zoom guide →</Link></header>
 <div className={styles.container}>
 <div className={styles.hero}><p className={styles.eyebrow}>ROBOTRONIX CLASSROOM · MARKETPLACE REVIEW</p><h1>Reviewer Test Plan</h1><p>End-to-end Zoom authorization, role-based access, scope verification and expected outcomes.</p><small>Prepared 2 November 2026 · Reviewer credentials supplied separately and privately</small></div>
 <div className={styles.content}><nav className={styles.toc} aria-label="Test plan sections"><strong>On this page</strong><a href="#start">Start here</a><a href="#accounts">Portal reviewer accounts</a><a href="#workflow">End-to-end workflow</a><a href="#scopes">Zoom scopes</a><a href="#cases">17 test cases</a><a href="#limits">Prerequisites and limitations</a><a href="#help">Support</a></nav>
 <article className={styles.article}>
 <section id="start"><h2>1. Start here</h2><p>Application: <Link href="/">Robotronix Learning Portal</Link>. Login: <Link href="/login">Sign in with password</Link>. Zoom connection landing page: <Link href="/zoom/connect">Connect Robotronix Classroom</Link>. Only an approved adult Robotronix administrator may authorize Zoom. Trainer, Parent and Student roles do not authorize the Zoom integration.</p><ol><li>Open the portal login in a fresh private/incognito browser session.</li><li>Use the Admin email below and its password supplied privately in Zoom's reviewer communications.</li><li>Open <Link href="/admin/zoom">Admin → Zoom</Link>, select Hosts and use Connect Host. If a disposable host is already connected, use that host for non-authorization cases.</li><li>Sign in to an eligible Zoom host account on Zoom's own consent screen. This is a separate identity from the portal login.</li><li>Repeat the portal login independently for Trainer, Parent and Student, checking role-specific access.</li><li>Record PASS / FAIL / BLOCKED for each test; do not treat historical testing as current certification.</li></ol></section>
 <section id="accounts"><h2>2. Portal reviewer accounts</h2><p>Each role has its own portal account. Passwords are intentionally excluded from this public page; they must be supplied privately to the Zoom review team. A reviewer must not need access to the owner's email inbox for ordinary password sign-in.</p><ul>{roles.map(([role,email,purpose])=><li key={role}><strong>{role}</strong> — {email}. {purpose}.</li>)}</ul><p>To test Zoom consent and cloud recordings, the reviewer also needs an eligible Zoom account permitted to authorize this application, with a cloud-recording-capable plan for recording scenarios.</p></section>
 <section id="workflow"><h2>3. End-to-end workflow</h2><ol><li><strong>Authorize:</strong> Portal Admin → Zoom → Hosts → Connect Host → Zoom consent → callback → connected host. Declining consent must not create an active host.</li><li><strong>Schedule:</strong> Admin creates a disposable general meeting or provisions an eligible scheduled class. Verify the Zoom meeting reference and repeat-safe behavior.</li><li><strong>Attend:</strong> Assigned Trainer joins/starts; linked Parent and Student see their permitted class. Verify unrelated users cannot see another family's data.</li><li><strong>Record:</strong> Complete a disposable meeting, allow Zoom to process the MP4, sync recordings, and verify authorized playback and seeking.</li><li><strong>Manage:</strong> Protect/unprotect, adjust retention and send a <em>separate disposable</em> recording file to Zoom Trash. Do not use live student media.</li><li><strong>Reauthorize:</strong> Use the same Zoom identity to renew an existing host without losing its associations.</li><li><strong>Remove:</strong> Remove the app from a disposable Zoom account's Added Apps. A signed deauthorization event should disable the matching host; if the event is unavailable, record BLOCKED.</li></ol></section>
 <section id="scopes"><h2>4. Scope-by-scope test matrix</h2><p>The following list is the scope inventory from the development submission plan, not a claim about the live Zoom Production configuration. Compare with Production → Scopes before review. For each optional scope, test consent granted and denied and record which dependent feature is unavailable when denied.</p><ul>{scopes.map(([scope,action,id])=><li key={scope}><code>{scope}</code> — {action} ({id})</li>)}</ul></section>
 <section id="cases"><h2>5. Functional test cases and expected results</h2><ol>{tests.map(([id,role,action,expected])=><li key={id}><strong>{id} · {role}</strong> — {action}. <strong>Expected:</strong> {expected}.</li>)}</ol></section>
 <section id="limits"><h2>6. Prerequisites, test data and limitations</h2><ul><li>Use only disposable sample learner, course, enrollment, scheduled class, meetings and recordings. No real children's recordings or customer billing data.</li><li>Cloud recording requires a Zoom account with the necessary plan and permissions and time for processing.</li><li>Reviewer Admin must have a suitable host linked or a Zoom account eligible for consent; Zoom tenant policy may require admin preapproval.</li><li>If 2FA, CAPTCHA or another restriction affects reviewer sign-in, arrange a legitimate reviewer-accessible method through the Zoom review team; do not bypass or globally disable security controls.</li><li>Live app-deauthorization events may not be emitted for some private/development installations. Mark that test BLOCKED rather than reporting an unobserved PASS.</li><li>Record date, deployed commit, result and evidence for each test. Do not expose passwords, OAuth tokens or real learner data in screenshots.</li></ul></section>
 <section id="help"><h2>7. Support and documentation</h2><p>End-user instructions: <Link href="/zoom-guide">Zoom Classroom Guide</Link>. Privacy: <Link href="/privacy">Privacy Policy</Link>. Support: <Link href="/support">Support Center</Link>. For reviewer questions, email <a href="mailto:info@robotronixstemlab.com">info@robotronixstemlab.com</a>.</p></section>
 </article></div></div>
 <footer className={styles.footer}><Link href="/zoom-guide">Zoom Guide</Link><Link href="/privacy">Privacy</Link><Link href="/support">Support</Link><Link href="/">Portal</Link></footer>
 </main>;
}
