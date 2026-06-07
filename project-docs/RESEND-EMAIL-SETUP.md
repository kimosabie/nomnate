# Resend email setup — sending to pilot users

Status: **TODO (do this in Resend + Afrihost DNS).** Goal: send broadcast/announcement emails to pilot users from `nomnate.co.za`.

## Why this is needed

The app sends email via **Resend** (`RESEND_API_KEY` in env), but the only configured sender is `onboarding@resend.dev` — Resend's **sandbox** address, which can ONLY deliver to the Resend account owner (**kim.ormiston@gmail.com**). Sending to any other address returns:

> 403 validation_error: "You can only send testing emails to your own email address (kim.ormiston@gmail.com). To send emails to other recipients, please verify a domain at resend.com/domains, and change the `from` address."

So to email the 17 external pilot users we must **verify `nomnate.co.za` in Resend** and send from an address on that domain.

## Current DNS (nomnate.co.za, checked 2026-06-07)

- **Inbox / mailboxes: hosted at Afrihost** — `MX → mail.nomnate.co.za` (aserv.co.za infra).
- **Root SPF:** `v=spf1 include:spf.aserv.co.za +a +mx -all`
- No Resend records yet.

## Key point — this will NOT break your Afrihost email

Resend **sending** and Afrihost **receiving** are independent. Resend's domain verification puts its records on a **`send.` subdomain** plus one DKIM TXT — it does **not** touch the root `MX` or root `SPF`. Mailboxes keep working untouched.

## Steps (do in Resend dashboard + Afrihost DNS zone editor)

1. **Resend → Domains → Add domain** `nomnate.co.za`. It generates the exact records (values below are the typical shape — use whatever Resend shows).
2. In **Afrihost's DNS zone editor** (the *DNS records*, NOT the email/mailbox settings), add the generated records:

| Record | Name (host) | Value | Notes |
|--------|-------------|-------|-------|
| MX | `send.nomnate.co.za` | `feedback-smtp.<region>.amazonses.com` (priority 10) | new subdomain — root MX untouched |
| TXT (SPF) | `send.nomnate.co.za` | `v=spf1 include:amazonses.com ~all` | on the subdomain — root SPF untouched |
| TXT (DKIM) | `resend._domainkey.nomnate.co.za` | long `p=…` key from Resend | additive, safe |
| TXT (DMARC, optional) | `_dmarc.nomnate.co.za` | `v=DMARC1; p=none;` | only if not already present |

3. Wait for Resend to show **Verified** (minutes–hours).

### ⚠️ SPF caveat
You already have a root SPF (`v=spf1 include:spf.aserv.co.za +a +mx -all`). **Do not add a second `v=spf1` record on the root** — two SPF records breaks SPF. The subdomain setup above avoids this. If Resend ever insists on a root SPF, *merge* instead: `v=spf1 include:spf.aserv.co.za include:amazonses.com +a +mx -all` (keep `-all`).

## After it's verified — send the broadcast

Once verified, the `from` becomes e.g. **`NomNate <hello@nomnate.co.za>`** and we send the announcement to all pilot users.

**Recipients (18 — 17 external pilot users + owner), pulled from `auth.users` ⋈ `family_members`:**
natalee.holmes@gmail.com, paigevarney@icloud.com, natalie.varney@me.com, dawn@gerberfamily.co.za, staci.barrett2411@gmail.com, melanie.prosser284@gmail.com, 310mrommel@gmail.com, natalie.rommelspacher@outlook.com, bradley.jeanm@gmail.com, dabbletts@gmail.com, mandy@sommere.com, jo.pohl.za@gmail.com, sine@gunningham.co.za, amelia.mcnamara@icloud.com, dylan.ormiston@icloud.com, zane.wansbury@gmail.com, riley.ormiston2018@outlook.com, kim.ormiston@me.com
(re-pull live before sending; excludes admin kim.ormiston@gmail.com and any user with no family)

**Announcement content** (already drafted + test-sent to kim.ormiston@gmail.com on 2026-06-07): "New on NomNate 🎉 — courses, a food diary, and a braai planner" covering: starters & desserts, food diary, braai/party planner, 7 AI suggestions/week, better recipes, family settings. Personalise with `{name}` from `family_members.name`.

**Send mechanism:** one-off script using the Resend SDK (the test used `apps/web` so the `resend` module resolves — ESM resolves from the script's location). Loop recipients, personalise, send; confirm the recipient count before firing.

## Also remember
- Set `ADMIN_EMAILS=kim.ormiston@me.com` in **Vercel** prod env (already in local `.env.local`) so the admin link shows on the deployed app.
