# Brevo email (Super Admin invite OTP)

When a **Super Admin** adds a user, the app creates the account and sends a temporary password by email using **Brevo** (formerly Sendinblue).

## 1. Create a Brevo account

1. Sign up at [brevo.com](https://www.brevo.com) (free tier: 300 emails/day).
2. Go to **SMTP & API** → **API Keys** and create an API key.
3. Copy the key (starts with `xkeysib-...`).

## 2. Configure the Edge Function

The `create-user-invite` Edge Function needs your Brevo API key and optional sender info.

**Option A – Supabase Dashboard (recommended)**

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select your project (**wqgszzuolkbuhfkxaaty**).
2. In the left sidebar click **Edge Functions**.
3. Click the **Secrets** tab (or **Manage secrets** / the secrets icon next to your function).
4. Add a secret:
   - **Name:** exactly `BREVO_API_KEY` (case-sensitive, no spaces).
   - **Value:** paste your Brevo API key (from step 1, e.g. `xkeysib-...`).
5. Click **Save** / **Add secret**.
6. **Redeploy** the function so it picks up the secret: run `npx supabase functions deploy create-user-invite` (after `npx supabase login` and `npx supabase link`), or use the dashboard’s deploy option if you have it.
7. (Optional) Add `BREVO_SENDER_EMAIL` and `BREVO_SENDER_NAME` the same way if you want a custom sender.

**Option B – Supabase CLI (from project root)**

The key is stored in `supabase/functions/.env`. Push it to Supabase so the deployed function can use it:

```bash
npx supabase login
npx supabase link --project-ref wqgszzuolkbuhfkxaaty
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy create-user-invite
```

To set a single secret manually:

```bash
npx supabase secrets set BREVO_API_KEY=your-brevo-api-key-here
```

**Sender email (required for delivery):** Brevo only sends from a **verified** sender. You must set `BREVO_SENDER_EMAIL` to an email you have verified in Brevo (see “No email received?” below).

## 3. Deploy the Edge Function

If you use Supabase CLI and have linked your project:

```bash
npx supabase functions deploy create-user-invite
```

If you use the Supabase Dashboard, you can deploy from the **Edge Functions** page (or via GitHub integration).

## 4. Test

1. Log in as a **Super Admin** user.
2. Go to **Users** → **Add User**.
3. Fill email, name, account type, province (and city if LGU) and submit.
4. The new user should receive an email at that address with the temporary password.

If the email does not arrive, see’ **"No email received?"** below.

## Troubleshooting 500 errors

1. **Check Edge Function logs** – Supabase Dashboard → **Edge Functions** → **create-user-invite** → **Logs**. The log shows the real error (e.g. missing secret or Brevo API error).

2. **BREVO_API_KEY not configured** – Add the secret under **Edge Functions** → **Secrets**. Name must be exactly `BREVO_API_KEY`. Redeploy the function after adding or changing secrets.

3. **Brevo sender not verified** – If the log shows `Brevo error 400` or sender not allowed, set a verified sender in Brevo (Settings → Senders & IP) and use that email for the `BREVO_SENDER_EMAIL` secret.

---

## No email received?

Brevo will **not** deliver until the **sender email** is set and verified.

### 1. Verify a sender in Brevo

1. Log in at [brevo.com](https://www.brevo.com).
2. Go to **Settings** (gear) → **Senders & IP** (or **Senders, domains & dedicated IPs**).
3. Click **Add a sender** (or **Add an email**).
4. Enter an email you own (e.g. `yourname@gmail.com` or `noreply@yourdomain.com`).
5. Enter the sender name (e.g. **Report System**).
6. Save. Brevo will send a **verification email** to that address.
7. Open that email and click the verification link.

### 2. Set the sender in Supabase

Add a secret so the Edge Function uses that verified email:

- **In Dashboard:** Edge Functions → Secrets → add **Name** `BREVO_SENDER_EMAIL`, **Value** = the verified email (e.g. `yourname@gmail.com`).
- **Or in CLI:**  
  `npx supabase secrets set BREVO_SENDER_EMAIL=yourname@gmail.com`

Then **redeploy** the function:

```bash
npx supabase functions deploy create-user-invite
```

### 3. Optional: add to your local .env

In `supabase/functions/.env` add (so future `secrets set --env-file` includes it):

```
BREVO_SENDER_EMAIL=yourname@gmail.com
BREVO_SENDER_NAME=Report System
```

### 4. Check delivery

- **Brevo:** **Statistics** → **Transactional** – see if the email was sent and delivered.
- **Recipient:** Check **Spam / Junk**.
- **Supabase:** Edge Functions → **create-user-invite** → **Logs** – see if Brevo returned an error.
