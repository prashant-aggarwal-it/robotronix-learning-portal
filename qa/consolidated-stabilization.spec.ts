import {test,expect} from "@playwright/test";
import {ensureRoleSession,newRoleContext} from "./session";

test.describe("Consolidated stabilization — protected UI smoke",()=>{
 test("Admin finance and operations navigation",async({page})=>{
  await ensureRoleSession(page,"admin");
  await page.goto("/admin/system-logs");
  await expect(page.getByRole("heading",{name:"System Logs"})).toBeVisible();
  await page.goto("/admin/trainers");
  await expect(page.getByText("Trainers").first()).toBeVisible();
 });
 test("Trainer profile exposes payout state and effective cycle safely",async({page})=>{
  await ensureRoleSession(page,"trainer");
  await page.goto("/trainer/profile");
  await expect(page.getByRole("heading",{name:"Your payout account"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Your current earning terms"})).toBeVisible();
 });
 test("Parent cannot read Admin System Logs",async({page})=>{
  await ensureRoleSession(page,"parent");
  await page.goto("/admin/system-logs");
  // RoleGuard should not grant Admin UI access even if a Parent guesses the URL.
  await expect(page.getByRole("heading",{name:"System Logs"})).not.toBeVisible({timeout:10000});
 });
 test("Unauthenticated visitor cannot query system logs",async({request})=>{
  const response=await request.get("/api/admin/system-logs");
  expect([401,503]).toContain(response.status());
 });
});
