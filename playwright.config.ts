import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function loadLocalEnvFiles(){
  for(const file of ['.env.local','.env.qa.local','.env.sanity.local']){
    const full=path.resolve(file);
    if(!fs.existsSync(full))continue;
    for(const raw of fs.readFileSync(full,'utf8').split(/\r?\n/)){
      const line=raw.trim();if(!line||line.startsWith('#'))continue;
      const eq=line.indexOf('=');if(eq<1)continue;
      const key=line.slice(0,eq).trim();let value=line.slice(eq+1).trim();
      if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
      if(process.env[key]===undefined)process.env[key]=value;
    }
  }
}
loadLocalEnvFiles();

const baseURL = process.env.QA_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './qa',
  timeout: 75_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'desktop-chromium',
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['auth-setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['auth-setup'],
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: process.env.QA_NO_WEBSERVER === '1' ? undefined : {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
