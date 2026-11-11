# Connect CRM Phase 5 — operational usability verification

Use the DEV workspace and fictional contacts only. These are **manual browser tests**, not claims that the tests were executed. Validate desktop keyboard, desktop mouse, and mobile viewport (375–430px). Document failures before merging or deploying.

| ID | Surface | Steps | Expected |
|---|---|---|---|
| 01 | New contact | Open, type a name, press Escape, cancel discard confirmation | Form remains open, text remains |
| 02 | New contact | Press Escape again and confirm discard | Form closes; focus returns to opener |
| 03 | New enquiry | Fill enquiry then click outside, cancel discard | No data lost and form remains open |
| 04 | New enquiry | Submit valid fields, observe saving, refresh | One enquiry stored; success feedback visible |
| 05 | Modal keyboard | Open a form; press Tab through last control, then Shift+Tab | Focus stays within topmost dialog, cycling correctly |
| 06 | Contact 360 | Open profile, Tab to tabs and use Left/Right/Home/End | Tab selection changes; corresponding content updates |
| 07 | Contact 360 | Open profile and press Escape | Closes active profile, returns focus |
| 08 | Admission | Change stage to Won/Lost; reject confirmation | Stage unchanged |
| 09 | Admission | Change stage to Won/Lost; confirm | Stage saved and CRM refreshes |
| 10 | Calendar editor | Edit, change notes, press Escape and reject confirmation | Editor remains open |
| 11 | Calendar editor | Fill invalid end time, submit | Validation message announced and focused |
| 12 | Calendar editor | Save valid changes and reopen | Values persist |
| 13 | Calendar | Click Cancel appointment and reject confirmation | Appointment remains scheduled |
| 14 | Calendar | Create follow-up and open Follow-ups | One task is visible |
| 15 | Communications | Open linked conversation then select Enquiries/Follow-ups | Relevant contact context retained |
| 16 | Customer context | Click All records or sidebar section | Scoped filter removed without cross-tenant leakage |
| 17 | Reports | Switch tabs with Arrow/Home/End | Correct tab selected with keyboard focus |
| 18 | Mobile | Open Calendar and CRM forms at 390px wide | No truncated actions, horizontal content accessible |
| 19 | Reduced motion | Enable system reduced-motion preference | No essential information relies on animation |
| 20 | Multi-tenant | Switch DEV workspace while customer context open | Prior customer selection and data do not persist |

No customer emails, WhatsApp replies, or real bookings should be sent during these tests. Production remains untouched.
