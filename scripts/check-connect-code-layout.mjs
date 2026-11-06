import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const required=[
 "app/connect/page.tsx","app/connect/layout.tsx","app/connect/connect.css",
 "features/connect/api/client.ts","features/connect/model.ts","features/connect/types/enquiries.ts","features/connect/EmptyStates.tsx",
 "features/connect/ConnectSidebar.tsx","features/connect/ConnectTopbar.tsx","features/connect/ConnectBrand.tsx",
 "features/connect/ConnectAuthGates.tsx",
 "features/connect/components/contact/ContactProfile.tsx",
 "features/connect/components/contact/ContactTimeline.tsx",
 "features/connect/components/contact/ContactRelationships.tsx",
 "features/connect/components/contact/ContactIntelligence.tsx",
 "app/api/connect/workspaces/[tenantId]/intelligence/route.ts",
 "app/api/connect/workspaces/[tenantId]/whatsapp/threads/route.ts",
 "app/api/connect/workspaces/[tenantId]/whatsapp/conversations/[conversationId]/messages/route.ts",
 "app/api/connect/workspaces/[tenantId]/contacts/[personId]/relations/route.ts",
 "app/api/connect/workspaces/[tenantId]/contacts/[personId]/timeline/route.ts",
 "features/connect/components/ChannelSettings.tsx",
 "features/connect/components/ConnectWhatsAppInbox.tsx",
 "lib/server/connect-meta-test.ts",
 "app/api/connect/workspaces/[tenantId]/whatsapp/conversations/[conversationId]/send/route.ts",
 "app/api/connect/workspaces/[tenantId]/whatsapp/conversations/[conversationId]/route.ts",
 "app/api/connect/workspaces/[tenantId]/whatsapp/contacts/route.ts",
 "features/connect/components/ConnectAutomationSettings.tsx",
 "features/connect/components/ConnectCommunications.tsx",
 "features/connect/components/ConnectReports.tsx",
 "features/connect/components/EnquirySettings.tsx",
 "components/ApplicationSwitcher.tsx"
];
for(const file of required){if(!fs.existsSync(path.join(root,file)))throw Error("Missing Connect module: "+file);}
if(fs.existsSync(path.join(root,"components/connect")))throw Error("Old Connect components folder must not coexist with consolidated feature module.");

const inspect=[
 "app/connect/page.tsx","features/connect/model.ts","features/connect/types/enquiries.ts","components/AppShell.tsx","components/ApplicationSwitcher.tsx",
 ...required.filter(f=>f.startsWith("features/connect/")&&f.endsWith(".tsx"))
];
for(const file of inspect){
 const source=fs.readFileSync(path.join(root,file),"utf8");
 if(source.includes("@/components/connect/"))throw Error("Stale Connect component import in "+file);
 for(const match of source.matchAll(/from\s+["'](@\/[^"']+)["']/g)){
  const name=match[1].slice(2);
  const candidates=[name+".ts",name+".tsx",name+".js",name+".jsx",name+"/index.ts",name+"/index.tsx"];
  if(!candidates.some(candidate=>fs.existsSync(path.join(root,candidate))))throw Error("Missing local import "+match[1]+" from "+file);
 }
}
const page=fs.readFileSync(path.join(root,"app/connect/page.tsx"),"utf8");
if(!page.includes("<ConnectSidebar")||!page.includes("<ConnectTopbar")||!page.includes("<ConnectSignInGate")||!page.includes("<ConnectNoWorkspaceGate"))throw Error("Connect page is missing an extracted shell component.");
if(fs.existsSync(path.join(root,"lib/connect-client.ts")))throw Error("Redundant legacy Connect API shim has been reintroduced.");
console.log("Connect code organization and local import paths OK.");

const portal=fs.readFileSync(path.join(root,"components/AppShell.tsx"),"utf8");
const sidebar=fs.readFileSync(path.join(root,"features/connect/ConnectSidebar.tsx"),"utf8");
if(!portal.includes('<ApplicationSwitcher current="portal"')||!sidebar.includes('<ApplicationSwitcher current="connect"'))throw Error("Both products must use the shared app switcher.");

const brand=fs.readFileSync(path.join(root,"features/connect/ConnectBrand.tsx"),"utf8");
if(!brand.includes('/brand/robotronix-horizontal.png'))throw Error("Connect brand must reuse the existing Portal logo.");
if(!sidebar.includes("/brand/robotronix-horizontal.png")||!fs.readFileSync(path.join(root,"features/connect/ConnectAuthGates.tsx"),"utf8").includes("<ConnectBrand"))throw Error("Connect entry and sidebar must use the Portal logo.");

if(page.includes("ConnectWorkspaceSetupGate")||page.includes("createWorkspace("))throw Error("Self-service workspace creation must not be shown in Connect UI.");
if(!sidebar.includes("workspaces.length>1"))throw Error("Workspace selector must be hidden for single-organization users.");

const contact=fs.readFileSync(path.join(root,"features/connect/components/contact/ContactProfile.tsx"),"utf8");
if(!page.includes("<ContactProfile")||!contact.includes('role="tablist"')||!contact.includes("Contact follow-ups")||!contact.includes("Related appointments"))throw Error("Contact 360 profile must contain its navigation and linked records.");
if(!page.includes("onSubmit={saveTask}")||!page.includes("onSubmit={saveAppointment}")||!page.includes("onSubmit={saveNote}")||!page.includes("onSubmit={startAdmission}"))throw Error("Contact 360 must retain its existing action forms.");

const timeline=fs.readFileSync(path.join(root,"features/connect/components/contact/ContactTimeline.tsx"),"utf8");
const timelineApi=fs.readFileSync(path.join(root,"app/api/connect/workspaces/[tenantId]/contacts/[personId]/timeline/route.ts"),"utf8");
const migration=fs.readFileSync(path.join(root,"database/connect/saas/24_contact_360_timeline_PENDING.sql"),"utf8");
if(!page.includes("<ContactTimeline")||!timeline.includes("Load older activity")||!timeline.includes("generation.current"))throw Error("Unified Contact 360 timeline or stale response handling missing.");
if(!timelineApi.includes("connect_contact_timeline")||!timelineApi.includes("isConnectSession")||!migration.includes("m.tenant_id=p_tenant_id")||!migration.includes("c.person_id=p_person_id"))throw Error("Tenant-authorized contact timeline query missing.");
if(!migration.includes("revoke all on function public.connect_contact_timeline"))throw Error("Contact timeline RPC must not be callable by public roles.");

const relationships=fs.readFileSync(path.join(root,"features/connect/components/contact/ContactRelationships.tsx"),"utf8");
const relationApi=fs.readFileSync(path.join(root,"app/api/connect/workspaces/[tenantId]/contacts/[personId]/relations/route.ts"),"utf8");
const relationMigration=fs.readFileSync(path.join(root,"database/connect/saas/25_contact_relationships.sql"),"utf8");
const contactProfile=fs.readFileSync(path.join(root,"features/connect/components/contact/ContactProfile.tsx"),"utf8");
if(!page.includes("<ContactRelationships")||!contactProfile.includes('tab==="relations"')||!relationships.includes('assign_owner'))
 throw Error("Contact 360 relationship tab and owner assignment are required.");
if(!relationApi.includes("connect_contact_relations")||!relationApi.includes("connect_contact_relation_command")||
 !relationMigration.includes("m.user_id=p_actor_id")||!relationMigration.includes("tenant_id=p_tenant_id")||
 !relationMigration.includes("revoke all on function public.connect_contact_relation_command"))
 throw Error("Contact relationship RPC and tenant permission checks are required.");

const intelligence=fs.readFileSync(path.join(root,"features/connect/components/contact/ContactIntelligence.tsx"),"utf8");
const intelligenceApi=fs.readFileSync(path.join(root,"app/api/connect/workspaces/[tenantId]/intelligence/route.ts"),"utf8");
const intelligenceMigration=fs.readFileSync(path.join(root,"database/connect/saas/27_contact_intelligence.sql"),"utf8");
if(!page.includes("<WorkspaceIntelligence")||!contactProfile.includes('tab==="insights"')||!intelligence.includes("ContactIntelligence"))throw Error("Contact intelligence UI and dashboard attention board must be present.");
if(!intelligenceApi.includes("connect_contact_insights")||!intelligenceApi.includes("isConnectSession")||!intelligenceMigration.includes("m.user_id=p_actor_id")||!intelligenceMigration.includes("revoke all on function public.connect_contact_insights"))throw Error("Contact intelligence authorization and private RPC missing.");
if(intelligence.includes("AI-powered")||intelligence.includes("predictive score"))throw Error("Do not claim unimplemented AI predictions.");

const waWebhook=fs.readFileSync(path.join(root,"app/api/connect/webhooks/meta/route.ts"),"utf8");
const waIngestion=fs.readFileSync(path.join(root,"lib/server/connect-ingestion.ts"),"utf8");
const waMigration=fs.readFileSync(path.join(root,"database/connect/saas/28_whatsapp_messaging_foundation.sql"),"utf8");
const waReadMigration=fs.readFileSync(path.join(root,"database/connect/saas/29_whatsapp_inbox_read_apis.sql"),"utf8");
const waThreads=fs.readFileSync(path.join(root,"app/api/connect/workspaces/[tenantId]/whatsapp/threads/route.ts"),"utf8");
const waMessages=fs.readFileSync(path.join(root,"app/api/connect/workspaces/[tenantId]/whatsapp/conversations/[conversationId]/messages/route.ts"),"utf8");
if(!waWebhook.includes('connect_ingest_whatsapp_message')||!waWebhook.includes('connect_ingest_whatsapp_status')
 ||!waWebhook.includes('smb_message_echoes')||!waWebhook.includes('checkHmacSha256'))
 throw Error("Verified WhatsApp inbound, status and coexistence echo adapters are required.");
if(!waIngestion.includes('connect_ingest_whatsapp_message')||!waMigration.includes('v_created and p_direction=\'inbound\'')
 ||!waMigration.includes('create unique index if not exists idx_connect_msg_external_id')
 ||!waMigration.includes('enable row level security'))
 throw Error("WhatsApp-only message capture, deduplication and private status storage missing.");
if(!waReadMigration.includes('connect_whatsapp_threads')||
 !waReadMigration.includes('connect_whatsapp_conversation_messages')||
 !waThreads.includes('connectSession')||!waMessages.includes('connectSession'))
 throw Error("Protected paginated WhatsApp inbox read APIs are required.");

const inbox=fs.readFileSync(path.join(root,"features/connect/components/ConnectWhatsAppInbox.tsx"),"utf8");
const inboxWorkflow=fs.readFileSync(path.join(root,"database/connect/saas/30_whatsapp_inbox_workflow.sql"),"utf8");
const identityFix=fs.readFileSync(path.join(root,"database/connect/saas/31_whatsapp_preserve_contact_links.sql"),"utf8");
const inboxApi=fs.readFileSync(path.join(root,"app/api/connect/workspaces/[tenantId]/whatsapp/conversations/[conversationId]/route.ts"),"utf8");
const contactSearchApi=fs.readFileSync(path.join(root,"app/api/connect/workspaces/[tenantId]/whatsapp/contacts/route.ts"),"utf8");
if(!page.includes("<ConnectWhatsAppInbox")||!inbox.includes("Load older messages")||
 !inbox.includes("Link CRM contact")||!inbox.includes("Save draft")||!inbox.includes("sendReady?.canSend"))
 throw Error("WhatsApp conversation UI, pagination or Meta-gated send composer missing.");
if(!inboxApi.includes("connectSession")||!inboxApi.includes("connect_whatsapp_manage_thread")||
 !contactSearchApi.includes("connect_whatsapp_contact_search")||
 !inboxWorkflow.includes("whatsapp_thread_state")||!inboxWorkflow.includes("enable row level security")||
 !identityFix.includes("Preserve explicitly linked CRM contact"))
 throw Error("Phase 2 WhatsApp agent state or access control missing.");

const metaTestAdapter=fs.readFileSync(path.join(root,"lib/server/connect-meta-test.ts"),"utf8");
const metaTestApi=fs.readFileSync(path.join(root,"app/api/connect/workspaces/[tenantId]/whatsapp/conversations/[conversationId]/send/route.ts"),"utf8");
const metaTestSql=fs.readFileSync(path.join(root,"database/connect/saas/32_whatsapp_meta_test_sending.sql"),"utf8");
const metaEligibilitySql=fs.readFileSync(path.join(root,"database/connect/saas/33_whatsapp_meta_reply_eligibility.sql"),"utf8");
const metaLimitSql=fs.readFileSync(path.join(root,"database/connect/saas/34_whatsapp_meta_test_send_limits.sql"),"utf8");
if(!metaTestAdapter.includes("CONNECT_META_TEST_SEND_ENABLED")||
 !metaTestAdapter.includes("CONNECT_META_TEST_RECIPIENTS")||
 !metaTestAdapter.includes("CONNECT_META_TEST_ACCESS_TOKEN")||
 !metaTestAdapter.includes("https://graph.facebook.com/"))
 throw Error("Secure Meta test-only adapter or allowlist missing.");
if(!metaTestApi.includes("connect_whatsapp_reserve_test_send")||
 !metaTestApi.includes("connect_whatsapp_complete_test_send")||
 !metaTestApi.includes("metaTestReady")||!metaTestApi.includes("connectSession"))
 throw Error("Authorized Meta test sending and idempotency missing.");
if(!metaTestSql.includes("customer-service reply window expired")&&
 !metaTestSql.includes("Customer-service reply window expired"))
 throw Error("Customer-service reply window check missing.");
if(!metaEligibilitySql.includes("connect_whatsapp_test_reply_context")||
 !metaLimitSql.includes("whatsapp_test_send_rate_guard"))
 throw Error("Meta reply eligibility and test rate limits missing.");
if(!inbox.includes('sendTestReply')||!inbox.includes('Send test reply')||!inbox.includes('sendReady?.canSend'))
 throw Error("WhatsApp Phase 3 composer must only send to verified Meta test recipients.");
if(waWebhook.includes('){\\n'))throw Error("Meta webhook contains literal escaped newlines that break TypeScript.");
