// Explicit DEV-only operator workflow. Dry-run unless --apply and --confirm are supplied.
import {createClient} from '@supabase/supabase-js';
const DEV='uzzuquxeeqonxeqcuohh';
const args=process.argv.slice(2);
const value=(flag)=>{const i=args.indexOf(flag);return i>=0?args[i+1]:undefined};
const userId=value('--user-id');
const apply=args.includes('--apply');
const confirm=value('--confirm');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if(!uuid.test(userId||''))throw Error('Pass --user-id <existing verified Auth UUID>');
const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||new URL(url).hostname!==DEV+'.supabase.co')throw Error('Refusing non-DEV Supabase URL');
if(!key)throw Error('Missing SUPABASE_SERVICE_ROLE_KEY (server-side only)');
if(apply&&confirm!==DEV)throw Error('Apply requires --confirm '+DEV);
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:{user},error}=await client.auth.admin.getUserById(userId);
if(error||!user||!user.email_confirmed_at||user.is_anonymous)throw Error('Existing verified non-anonymous Auth user required');
console.log(JSON.stringify({target:DEV,userId:user.id,email:user.email,mode:apply?'APPLY':'DRY_RUN'}));
if(!apply){console.log('No changes. To apply, append --apply --confirm '+DEV);process.exit(0);}
const {data,error:rpcError}=await client.rpc('saas_bootstrap_platform_admin_v1',{p_user_id:user.id});
if(rpcError||data!==true)throw Error('Bootstrap failed: '+(rpcError?.message||'unexpected result'));
const {data:check,error:checkError}=await client.rpc('saas_is_platform_admin_v1',{p_actor_id:user.id});
if(checkError||check!==true)throw Error('Post-bootstrap authorization verification failed');
console.log('Verified: platform administrator provisioned in DEV');
