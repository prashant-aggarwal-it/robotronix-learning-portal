# Robotronix Connect CRM — Phase 6 Contact Operations UAT

## Scope and safety
Use the DEV workspace and fictional contacts. Do not import real purchased contact lists for testing, or send any WhatsApp messages. Backend tests are transactional and rolled back; this checklist is for manual browser acceptance, not a record of completed browser tests.

| # | Scenario | Expected result |
|---|---|---|
| 1 | Open Contacts > Manage contacts | Operations interface appears only for managers/admins/owners |
| 2 | View contact directory | Contact count, pagination, details and consent badges load |
| 3 | Search by phone / email / name | Searches across full workspace, not only loaded page |
| 4 | Filter by city | Matching contacts only, correct count |
| 5 | Filter by imported tag | Imported tags match immediately after CSV import |
| 6 | Filter by source label | Only matching source contacts shown |
| 7 | Filter by consent status | Unknown, opted in and opted out are distinct |
| 8 | Save segment and reselect | Filters persist and restore correctly |
| 9 | Delete segment | Saved filter removed; contacts unaffected |
| 10 | Edit name, company, city, notes, tags | Changes persist after refreshing/reopening |
| 11 | Edit phone/email | Previous identifiers retained for linked conversation history |
| 12 | Discard editing via Escape | Unsaved-changes confirmation appears |
| 13 | Edit contact from Contact 360, off first page | Correct contact opens |
| 14 | Select page of contacts and add tag | Selected records updated; others unchanged |
| 15 | Remove tag and set city in bulk | Selected records updated, no implicit permission changes |
| 16 | Bulk WhatsApp opt-out | Explicit confirmation; all selected marked opted out |
| 17 | Attempt opt-out > unknown | Rejected; opt-out not silently reversed |
| 18 | Set verified opt-in without evidence | Blocked |
| 19 | Set verified opt-in with evidence | Explicit confirmation and audit record |
| 20 | Export filtered contacts | CSV includes name, phone, email, tags, source, consent; correct filtered count |
| 21 | Duplicate detection | Exact phone/email identifiers flagged; false positives dismissible |
| 22 | Merge unlinked duplicate | Preserve identifiers and opt-out, archive source, record audit |
| 23 | Merge contact with linked enquiry | Rejected with clear explanation; no history reassigned |
| 24 | Switch tenant | Contacts/segments/duplicates never leak across workspace |
| 25 | Test read-only and counsellor accounts | Cannot perform management mutations or access manager-only UI |
| 26 | Mobile at 390px | Filters, table scrolling, modal and actions remain accessible |
| 27 | Database audit / security | Role checks performed within tenant-scoped server RPCs; no direct browser table access |

## Release criteria
- TypeScript, Next.js build, structure checks and transaction-based SQL regression tests pass.
- Manual desktop/mobile UAT above is recorded as passed or defects filed.
- No production migration or main-branch merge until explicitly approved.
- Duplicate merging is deliberately conservative: contacts with linked CRM history require manual reconciliation.
- Contact storage and WhatsApp marketing permission remain separate. Only independently evidenced opt-in can make a recipient eligible for compliant future campaigns.
