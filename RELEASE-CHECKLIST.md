# Production V1 Release Checklist

## Source
- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm run check:release`
- [ ] `npm run build`
- [ ] `.env.local`, `.qa-auth`, reports and test artifacts are not committed

## Database
- [ ] Fresh Supabase project created
- [ ] `supabase/production-v1-baseline.sql` ran successfully
- [ ] No historical patch/migration SQL applied on top of the fresh baseline
- [ ] First admin bootstrapped after Auth user creation

## Authentication
- [ ] Email/password sign-in checked
- [ ] Google OAuth callback/origins checked if enabled
- [ ] Admin/Trainer/Parent/Student role redirects checked

## Production QA
- [ ] Admin screens load
- [ ] Trainer screens load
- [ ] Parent learner view loads
- [ ] Student course view loads
- [ ] Enrollment hold/restore works
- [ ] Trainer class completion + attendance works
- [ ] Trainer earning is generated from actual delivered duration
- [ ] Parent/Student progress reflects completed learning
- [ ] Finance and Audit pages load without request errors

## Deployment
- [ ] Netlify environment variables configured
- [ ] `NEXT_PUBLIC_APP_ENV=production`
- [ ] Production Site URL configured in Netlify and Supabase
- [ ] Service-role key remains server-only
- [ ] Portal remains `noindex, nofollow`
