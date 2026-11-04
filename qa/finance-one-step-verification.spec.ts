import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const db = readFileSync("database/01_install/modules/schema/07_notifications_security_and_lifecycle.sql", "utf8");
const migration = readFileSync("database/04_existing_db_migrations/20261104_finance_one_step_admin_verification.sql", "utf8");
const review = readFileSync("components/finance/PayoutReview.tsx", "utf8");
const trainer = readFileSync("app/admin/trainers/[id]/page.tsx", "utf8");
function rpc(sql: string) {
  const first = sql.indexOf("create or replace function public.review_trainer_finance_request(");
  const last = sql.indexOf("grant execute on function public.review_trainer_finance_request(uuid,text,text) to authenticated;", first);
  if (first < 0 || last < 0) throw new Error("Admin payout review RPC missing");
  return sql.slice(first, last);
}

test.describe("One-step Admin payout approval source contracts", () => {
  test("migration uses the same Admin approval RPC as fresh-install schema", () => {
    expect(rpc(migration)).toBe(rpc(db));
  });
  test("approval atomically saves verified status and payout version", () => {
    const fn = rpc(db);
    expect(fn).toContain("if not public.is_admin() then raise exception");
    expect(fn).toContain("if r.status<>'pending' then raise exception");
    expect(fn).toContain("insert into public.trainer_payout_instruction_versions(");
    expect(fn).toContain("perform set_config('robotronix.payout_review','1',true)");
    expect(fn).toContain("compliance_status='verified'");
    expect(fn).toContain("pan,'verified',now()");
  });
  test("bank/UPI inputs are checked before verification", () => {
    const fn = rpc(db);
    expect(fn).toContain("r.preferred_payout_method='bank'");
    expect(fn).toContain("r.account_holder_name");
    expect(fn).toContain("r.account_number");
    expect(fn).toContain("r.ifsc");
    expect(fn).toContain("r.preferred_payout_method='upi'");
    expect(fn).toContain("r.upi_id");
  });
  test("rejection or correction never performs the approval's finance upsert", () => {
    const fn = rpc(db);
    const approvalStart = fn.indexOf("if target_status='approved' then");
    const approvalEnd = fn.indexOf("end if;", fn.indexOf("compliance_status='verified'", approvalStart));
    const financeWrite = fn.indexOf("insert into public.trainer_finance(", approvalStart);
    expect(approvalStart).toBeGreaterThan(0);
    expect(financeWrite).toBeGreaterThan(approvalStart);
    expect(financeWrite).toBeLessThan(approvalEnd);
    expect(fn.slice(approvalEnd)).not.toContain("insert into public.trainer_finance(");
  });
  test("UI has one explicit approval button and Admin verification description", () => {
    expect(review).toContain("Approve & verify payout details");
    expect(review).toContain("Admin verified");
    expect(review).not.toContain("Continue to confirmation");
    expect(review).not.toContain("setConfirm(");
    expect(trainer).toContain("Verification override (exception only)");
    expect(trainer).toContain("Payout verification");
  });
});
