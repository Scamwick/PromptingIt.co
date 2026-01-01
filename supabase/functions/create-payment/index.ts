// Supabase Edge Function: Create Payment for Marketplace Purchase
// Deploy with: supabase functions deploy create-payment

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

// Platform fee percentage (20%)
const PLATFORM_FEE_PERCENT = 20

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { promptId, buyerId, amount, sellerId, customerEmail, successUrl, cancelUrl } = await req.json()

    // Validate
    if (!promptId || !buyerId || !amount || !sellerId) {
      throw new Error('Missing required fields')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get prompt details
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('title, price')
      .eq('id', promptId)
      .single()

    if (promptError) throw promptError

    // Get seller's Connect account
    const { data: sellerEarnings } = await supabase
      .from('creator_earnings')
      .select('stripe_connect_id')
      .eq('user_id', sellerId)
      .single()

    // Calculate fees
    const platformFee = Math.round(amount * (PLATFORM_FEE_PERCENT / 100))
    const sellerAmount = amount - platformFee

    // Create checkout session with Connect
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: prompt.title,
              description: `Prompt purchase on Prompting It`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
      metadata: {
        prompt_id: promptId,
        buyer_id: buyerId,
        seller_id: sellerId,
        type: 'prompt_purchase'
      },
    }

    // If seller has Connect account, use destination charges
    if (sellerEarnings?.stripe_connect_id) {
      sessionParams.payment_intent_data = {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: sellerEarnings.stripe_connect_id,
        },
        metadata: {
          prompt_id: promptId,
          buyer_id: buyerId,
          seller_id: sellerId,
        }
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Payment error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

