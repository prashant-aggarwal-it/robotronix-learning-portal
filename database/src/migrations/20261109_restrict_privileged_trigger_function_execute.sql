-- Development-verified hardening: trigger-only functions have no legitimate
-- direct REST/RPC invocation surface. Existing trigger bindings remain intact.
-- Avoid blanket revocation on scalar SECURITY DEFINER helpers used by RLS.
revoke execute on function public.audit_core_change() from public,anon,authenticated;
revoke execute on function public.handle_communication_message() from public,anon,authenticated;
revoke execute on function public.lock_trainer_payout_instructions() from public,anon,authenticated;
revoke execute on function public.notify_absence() from public,anon,authenticated;
revoke execute on function public.notify_admin_critical_schedule_change() from public,anon,authenticated;
revoke execute on function public.notify_admin_on_onboarding_submission() from public,anon,authenticated;
revoke execute on function public.notify_enrollment_hold() from public,anon,authenticated;
revoke execute on function public.notify_feedback() from public,anon,authenticated;
revoke execute on function public.notify_onboarding_activation() from public,anon,authenticated;
revoke execute on function public.notify_open_progress_alert() from public,anon,authenticated;
revoke execute on function public.notify_project_review() from public,anon,authenticated;
revoke execute on function public.notify_schedule_change() from public,anon,authenticated;
revoke execute on function public.notify_trainer_payout_action() from public,anon,authenticated;
revoke execute on function public.on_class_attendance_change() from public,anon,authenticated;
revoke execute on function public.on_enrollment_opening_progress_change() from public,anon,authenticated;
revoke execute on function public.prepare_communication_message() from public,anon,authenticated;
revoke execute on function public.prepare_communication_thread() from public,anon,authenticated;
revoke execute on function public.protect_profile_privileges() from public,anon,authenticated;
revoke execute on function public.resolve_correction_request_fields() from public,anon,authenticated;
revoke execute on function public.trg_sync_trainer_earning() from public,anon,authenticated;
revoke execute on function public.trg_sync_trainer_earning_from_attendance() from public,anon,authenticated;
revoke execute on function public.version_direct_admin_payout_change() from public,anon,authenticated;
