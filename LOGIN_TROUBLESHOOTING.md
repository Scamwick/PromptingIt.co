# Login Troubleshooting Guide

## Common Issues and Solutions

### 1. "Email not confirmed" Error

**Problem**: Supabase requires email verification before login.

**Solution Options**:

#### Option A: Disable Email Verification (Development)
1. Go to Supabase Dashboard
2. Navigate to Authentication → Settings
3. Find "Email Auth" section
4. Disable "Confirm email" toggle
5. Save changes

#### Option B: Verify Email
1. Check your email inbox (and spam folder)
2. Click the verification link from Supabase
3. Try logging in again

### 2. "Invalid login credentials" Error

**Possible Causes**:
- Wrong email or password
- Account doesn't exist
- Password was changed

**Solutions**:
1. Double-check email: `cgs18g@gmail.com`
2. Double-check password: `Cody_7367`
3. Try signing up again if account doesn't exist
4. Use "Forgot password" to reset

### 3. Account Not Created During Signup

**Check**:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors during signup
4. Check Network tab for failed API calls

**Solution**:
- Try signing up again
- Check Supabase dashboard to see if user was created
- Verify Supabase connection is working

### 4. Owner Upgrade Failed

**Check**:
1. After login, check browser console for errors
2. Verify in Supabase dashboard:
   - Profile role should be 'owner'
   - Subscription tier should be 'enterprise'

**Solution**:
- Login will now automatically upgrade owner accounts
- If upgrade fails, it will still allow login
- You can manually upgrade in Supabase dashboard

### 5. Supabase Connection Issues

**Check**:
1. Open browser DevTools → Console
2. Look for Supabase initialization errors
3. Check Network tab for failed requests to Supabase

**Solution**:
- Verify `supabase-config.js` has correct URL and key
- Check internet connection
- Verify Supabase project is active

---

## Quick Diagnostic Steps

### Step 1: Check Browser Console
1. Open `login.html` in browser
2. Press F12 to open DevTools
3. Go to Console tab
4. Try to log in
5. Look for any red error messages
6. Copy any errors you see

### Step 2: Check Network Requests
1. In DevTools, go to Network tab
2. Try to log in
3. Look for requests to `supabase.co`
4. Check if they return errors (red status codes)
5. Click on failed requests to see error details

### Step 3: Verify Account Exists
1. Go to Supabase Dashboard
2. Navigate to Authentication → Users
3. Search for `cgs18g@gmail.com`
4. Check if user exists
5. Check if email is confirmed

### Step 4: Test Signup First
1. Go to `signup.html`
2. Try creating the account again
3. Check console for errors
4. If signup succeeds, try login

---

## Manual Account Creation (If Needed)

If signup isn't working, you can manually create the account in Supabase:

1. Go to Supabase Dashboard
2. Navigate to Authentication → Users
3. Click "Add User" → "Create new user"
4. Enter:
   - Email: `cgs18g@gmail.com`
   - Password: `Cody_7367`
   - Auto Confirm User: ✅ (check this)
5. Click "Create user"
6. Then manually set role and subscription in database

---

## Manual Owner Upgrade (If Needed)

If automatic upgrade isn't working, you can manually upgrade in Supabase:

### SQL Editor Method:
1. Go to Supabase Dashboard → SQL Editor
2. Run these queries:

```sql
-- Update profile to owner
UPDATE profiles 
SET role = 'owner' 
WHERE email = 'cgs18g@gmail.com';

-- Update subscription to enterprise
UPDATE subscriptions 
SET tier = 'enterprise',
    status = 'active',
    prompts_limit = -1,
    trial_ends_at = NULL
WHERE user_id = (SELECT id FROM profiles WHERE email = 'cgs18g@gmail.com');
```

---

## Testing Login

1. **Clear browser cache** (important!)
2. Open `login.html`
3. Enter:
   - Email: `cgs18g@gmail.com`
   - Password: `Cody_7367`
4. Click "Sign In"
5. Check console for any errors
6. Should redirect to dashboard

---

## Still Having Issues?

1. **Check Supabase Settings**:
   - Email verification enabled/disabled?
   - OAuth providers configured?
   - RLS policies allow access?

2. **Check Browser**:
   - Try different browser
   - Clear cookies and cache
   - Disable browser extensions

3. **Check Network**:
   - Firewall blocking Supabase?
   - VPN interfering?
   - Corporate network restrictions?

4. **Get Error Details**:
   - Copy exact error message from console
   - Check Network tab for failed requests
   - Check Supabase dashboard logs

---

## Updated Login Features

The login page now includes:
- ✅ Owner account auto-upgrade on login
- ✅ Better error messages
- ✅ Security.js integration
- ✅ Audit logging
- ✅ Smart redirect (owner → owner-dashboard, others → creator-dashboard)

---

**Last Updated**: January 1, 2025

