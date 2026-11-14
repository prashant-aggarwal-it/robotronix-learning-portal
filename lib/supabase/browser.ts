import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
const activeOrganizationKey="robotronix_saas_active_organization";
const validOrganizationId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A client organization choice is only a filter; database RLS independently validates membership. */
export function setAcademyBrowserOrganizationContext(organizationId:string|null):void {
 if(typeof window==="undefined")return;
 try {
  if(organizationId&&validOrganizationId.test(organizationId))
   window.sessionStorage.setItem(activeOrganizationKey,organizationId);
  else window.sessionStorage.removeItem(activeOrganizationKey);
 }catch{}
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  if (!browserClient) {
    browserClient = createClient(url, anonKey, {
      global: {
        fetch: (input, init) => {
          const address=typeof input==="string"?input:input instanceof URL?input.href:input.url;
          if(typeof window==="undefined"||!address.includes("/rest/v1/"))return fetch(input,init);
          const headers=new Headers(init?.headers);
          try {
            const selected=window.sessionStorage.getItem(activeOrganizationKey);
            if(selected&&validOrganizationId.test(selected))headers.set("x-organization-id",selected);
          }catch{}
          return fetch(input,{...init,headers});
        }
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}
