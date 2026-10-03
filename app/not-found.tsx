import Link from "next/link";

export default function NotFound(){
  return <main className="loginShell"><section className="card"><h1>Page not found</h1><p>The requested portal page does not exist or is no longer available.</p><Link href="/" className="button">Return to portal</Link></section></main>;
}
