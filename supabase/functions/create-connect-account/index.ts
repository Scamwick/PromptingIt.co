// Supabase Edge Function: Create Stripe Connect Account for Creators
// Deploy with: supabase functions deploy create-connect-account

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, email, returnUrl, refreshUrl } = await req.json()

    if (!userId || !email) {
      throw new Error('Missing required fields')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if user already has a Connect account
    const { data: earnings } = await supabase
      .from('creator_earnings')
      .select('stripe_connect_id')
      .eq('user_id', userId)
      .single()

    let accountId = earnings?.stripe_connect_id

    if (!accountId) {
      // Create new Express Connect account
      const account = await stripe.accounts.create({
        type: 'express',
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          user_id: userId
        }
      })
      accountId = account.id

      // Save Connect account ID
      await supabase
        .from('creator_earnings')
        .upsert({
          user_id: userId,
          stripe_connect_id: accountId,
          stripe_onboarding_complete: false
        }, {
          onConflict: 'user_id'
        })
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    })

    return new Response(
      JSON.stringify({ 
        accountId: accountId,
        onboardingUrl: accountLink.url 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Connect account error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

