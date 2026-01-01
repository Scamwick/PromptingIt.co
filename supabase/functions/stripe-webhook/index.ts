// Supabase Edge Function: Stripe Webhook Handler
// Deploy with: supabase functions deploy stripe-webhook
// Set up webhook in Stripe Dashboard pointing to:
// https://<project>.supabase.co/functions/v1/stripe-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature!, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    switch (event.type) {
      // ============================================
      // SUBSCRIPTION EVENTS
      // ============================================
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata.user_id

        if (userId) {
          const tier = subscription.items.data[0]?.price?.lookup_key?.includes('pro') 
            ? 'pro' 
            : 'enterprise'

          await supabase
            .from('subscriptions')
            .update({
              tier: tier,
              status: subscription.status === 'active' ? 'active' : subscription.status,
              stripe_subscription_id: subscription.id,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              prompts_limit: tier === 'enterprise' ? -1 : 999999, // Unlimited for paid
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata.user_id

        if (userId) {
          await supabase
            .from('subscriptions')
            .update({
              tier: 'free',
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              prompts_limit: 25,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
        }
        break
      }

      // ============================================
      // PAYMENT EVENTS (Marketplace)
      // ============================================
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        
        // Handle marketplace purchases
        if (session.metadata?.type === 'prompt_purchase') {
          const { prompt_id, buyer_id, seller_id } = session.metadata
          const amount = (session.amount_total || 0) / 100 // Convert from cents

          // Record the purchase using database function
          await supabase.rpc('record_purchase', {
            p_buyer_id: buyer_id,
            p_prompt_id: prompt_id,
            p_amount: amount,
            p_stripe_payment_id: session.payment_intent as string
          })

          // Log activity
          await supabase.from('activity_log').insert({
            user_id: buyer_id,
            action: 'prompt_purchased',
            resource_type: 'prompt',
            resource_id: prompt_id,
            metadata: { amount, seller_id }
          })
        }
        break
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log('Payment succeeded:', paymentIntent.id)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.error('Payment failed:', paymentIntent.id, paymentIntent.last_payment_error?.message)
        break
      }

      // ============================================
      // CONNECT EVENTS (Payouts)
      // ============================================
      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        
        // Update creator's Connect status
        if (account.metadata?.user_id) {
          await supabase
            .from('creator_earnings')
            .update({
              stripe_onboarding_complete: account.charges_enabled && account.payouts_enabled,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', account.metadata.user_id)
        }
        break
      }

      case 'payout.paid': {
        const payout = event.data.object as Stripe.Payout
        console.log('Payout completed:', payout.id)
        break
      }

      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout
        console.error('Payout failed:', payout.id, payout.failure_message)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})

