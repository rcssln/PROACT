import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import crypto from 'crypto'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Need service key for bulk updates

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const SALT_PREFIX = 'rdrms-c1:'

async function hashPassword(password, userEmail) {
  const salt = SALT_PREFIX + userEmail.toLowerCase().trim()
  const data = salt + password
  return crypto.createHash('sha256').update(data).digest('hex')
}

async function resetAllPasswords() {
  console.log('Fetching all users...')
  const { data: users, error: fetchError } = await supabase
    .from('users')
    .select('id, email')

  if (fetchError) {
    console.error('Error fetching users:', fetchError)
    return
  }

  console.log(`Found ${users.length} users.`)
  if (users.length === 0) {
    console.log('No users found to reset.')
    return
  }

  const newPassword = 'Wakin123'
  
  for (const user of users) {
    console.log(`Resetting password for ${user.email}...`)
    const hashed = await hashPassword(newPassword, user.email)
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        password_hash: hashed,
        must_change_password: true 
      })
      .eq('id', user.id)

    if (updateError) {
      console.error(`Failed to update ${user.email}:`, updateError)
    } else {
      console.log(`Success for ${user.email}`)
    }
  }

  console.log('All passwords reset to Wakin123 (must change on next login).')
}

resetAllPasswords()
