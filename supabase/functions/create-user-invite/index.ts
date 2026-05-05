// Supabase Edge Function: create user + send OTP email via Brevo
// Secrets required: BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME
// Optional secret:  APP_ORIGIN (your deployed frontend URL, defaults to localhost:5173)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghjkmnpqrstuvwxyz'
const DIGITS = '23456789'
const ALL = UPPER + LOWER + DIGITS
// Fixed app prefix for the per-user salt — must match src/lib/passwordUtils.js
const SALT_PREFIX = 'rdrms-c1:'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cryptographically secure random integer in [0, max). */
function cryptoRandInt(max: number): number {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0] % max
}

function generateTemporaryPassword(): string {
  const length = 12
  const chars: string[] = [
    UPPER[cryptoRandInt(UPPER.length)],
    LOWER[cryptoRandInt(LOWER.length)],
    DIGITS[cryptoRandInt(DIGITS.length)],
  ]
  for (let i = chars.length; i < length; i++) {
    chars.push(ALL[cryptoRandInt(ALL.length)])
  }
  // Fisher-Yates shuffle with CSPRNG
  for (let i = chars.length - 1; i > 0; i--) {
    const j = cryptoRandInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/**
 * Hash a password with a per-user salt (user's email).
 * Must stay in sync with src/lib/passwordUtils.js hashPassword().
 */
async function hashPassword(password: string, userEmail: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = SALT_PREFIX + userEmail.toLowerCase().trim()
  const data = encoder.encode(salt + password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sendBrevoEmail(
  apiKey: string,
  toEmail: string,
  toName: string,
  tempPassword: string
): Promise<void> {
  const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL')
  if (!senderEmail || !senderEmail.includes('@')) {
    console.error('BREVO_SENDER_EMAIL is missing or invalid')
    throw new Error('BREVO_SENDER_EMAIL not set or invalid. Add a verified sender email in Edge Function secrets.')
  }
  const senderName = Deno.env.get('BREVO_SENDER_NAME') || 'PROACT'

  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #333;">
  <p>Hello ${toName},</p>
  <p>Your account has been created. Use this temporary password to log in:</p>
  <p style="font-size: 1.1rem; font-family: monospace; background: #f3f4f6; padding: 0.5rem 0.75rem; border-radius: 0.5rem; letter-spacing: 0.05em;">${tempPassword}</p>
  <p><strong>Password rules:</strong> at least 8 characters, one uppercase letter, one lowercase letter, one number. Please change your password after first login.</p>
  <p>— PROACT</p>
</body>
</html>
`.trim()

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: toEmail, name: toName }],
      subject: 'Your temporary password – PROACT',
      htmlContent,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    let errorMessage = `Brevo error ${res.status}`
    try {
      const errJson = JSON.parse(errText)
      errorMessage += `: ${errJson.message || errText}`
    } catch {
      errorMessage += `: ${errText}`
    }
    throw new Error(errorMessage)
  }
}

// ---------------------------------------------------------------------------
// CORS — dynamically allow the request origin to support local IPs and dev environments.
// For production, you can still restrict this via the APP_ORIGIN secret.
// ---------------------------------------------------------------------------
const APP_ORIGIN = Deno.env.get('APP_ORIGIN')

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin')
  const allowedOrigin = APP_ORIGIN || origin || '*'
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }


  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // -------------------------------------------------------------------------
  // Parse body
  // -------------------------------------------------------------------------
  let reqBody: Record<string, unknown>
  try {
    reqBody = (await req.json()) as Record<string, unknown>
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // -------------------------------------------------------------------------
  // Authorization: verify the caller is an active Admin
  // -------------------------------------------------------------------------
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const callerId = reqBody?.caller_id ? String(reqBody.caller_id) : null
  if (!callerId) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized. Missing caller_id.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Verify caller is an active Admin in the users table
  const { data: callerUser, error: callerError } = await supabase
    .from('users')
    .select('role, status, account_type')
    .eq('id', callerId)
    .maybeSingle()

  if (
    callerError || 
    !callerUser || 
    callerUser.status !== 'Active' || 
    (callerUser.role !== 'Admin' && callerUser.role !== 'Super Admin' && !callerUser.account_type?.includes('Admin'))
  ) {
    return new Response(
      JSON.stringify({ error: 'Forbidden. Admin access required.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Body was already parsed above

  try {
    const email = String(reqBody?.email ?? '').trim().toLowerCase()
    const firstName = String(reqBody?.first_name ?? '').trim()
    const lastName = String(reqBody?.last_name ?? '').trim()
    const accountType = reqBody?.account_type || null
    const province = reqBody?.province || null
    const city = reqBody?.city ?? null

    if (!email || !firstName || !lastName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, first_name, last_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tempPassword = generateTemporaryPassword()
    // Per-user salt: use the new user's email (mirrors client-side hashPassword logic)
    const passwordHash = await hashPassword(tempPassword, email)

    const insertPayload: Record<string, unknown> = {
      email,
      first_name: firstName,
      last_name: lastName,
      phone: null,
      city: (accountType === 'LGU' || String(accountType || '').includes('Provincial')) ? (city || null) : null,
      password_hash: passwordHash,
      account_type: accountType,
      province,
      must_change_password: true,
    }

    const { error: insertError } = await supabase.from('users').insert(insertPayload)
    if (insertError) {
      console.error('create-user-invite insert error:', insertError)
      return new Response(
        JSON.stringify({
          error: insertError.code === '23505'
            ? 'A user with that email already exists.'
            : 'Failed to create user.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let emailSent = false
    let emailError = null

    // -------------------------------------------------------------------------
    // Optional: Email notification via Brevo
    // -------------------------------------------------------------------------
    const brevoKey = Deno.env.get('BREVO_API_KEY')
    if (brevoKey) {
      try {
        await sendBrevoEmail(brevoKey, email, `${firstName} ${lastName}`.trim() || email, tempPassword)
        emailSent = true
      } catch (err) {
        console.error('sendBrevoEmail failed:', err)
        emailError = err instanceof Error ? err.message : String(err)
      }
    } else {
      console.warn('BREVO_API_KEY is missing. Email skipped.')
      emailError = 'Email service not configured (missing BREVO_API_KEY secret).'
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: emailSent ? 'User created and email sent' : 'User created (email service unconfigured)',
        emailSent,
        emailError
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )


  } catch (err) {
    console.error('create-user-invite error:', err)
    const errMsg = err instanceof Error ? err.message : 'An unexpected error occurred.'
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
