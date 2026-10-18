// Admin sign-in backed by Supabase Auth.
//
// The browser never holds a shared password any more. An admin signs in
// with an email + password that lives in Supabase Auth, and Supabase sends
// the resulting JWT with every request. The real protection is the row-level
// security policies in supabase/migrations/003_admin_lockdown.sql: only a
// user listed in public.admin_users can insert, update or delete movies and
// articles. This file only decides what the UI shows.

import { supabase } from './supabase'

export async function signInAdmin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { session: data?.session ?? null, error }
}

export async function getAdminSession() {
  const { data } = await supabase.auth.getSession()
  return data?.session ?? null
}

// True when the signed-in user is listed in public.admin_users.
export async function isAdminUser() {
  const { data, error } = await supabase.rpc('is_vexn_admin')
  return !error && data === true
}

export function onAdminSessionChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

export async function signOutAdmin() {
  await supabase.auth.signOut()
}
