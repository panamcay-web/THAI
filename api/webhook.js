// POST /api/webhook
// Handles Stripe webhook events (payment confirmation)

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const leadId = paymentIntent.metadata?.lead_id;

        // Update lead status to paid
        if (leadId) {
          await supabase
            .from('leads')
            .update({
              status: 'paid',
              stripe_payment_status: 'succeeded',
              amount_paid: paymentIntent.amount,
              currency: paymentIntent.currency,
              paid_at: new Date().toISOString()
            })
            .eq('id', leadId);
        }

        // Save payment record
        await supabase.from('payments').insert({
          lead_id: leadId || null,
          stripe_payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: 'succeeded',
          customer_email: paymentIntent.receipt_email,
          customer_name: paymentIntent.metadata?.applicant_name,
          raw_event: event
        });

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const leadId = paymentIntent.metadata?.lead_id;

        if (leadId) {
          await supabase
            .from('leads')
            .update({ stripe_payment_status: 'failed' })
            .eq('id', leadId);
        }

        await supabase.from('payments').insert({
          lead_id: leadId || null,
          stripe_payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: 'failed',
          customer_email: paymentIntent.receipt_email,
          raw_event: event
        });

        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;

        if (paymentIntentId) {
          await supabase
            .from('leads')
            .update({ status: 'refunded', stripe_payment_status: 'refunded' })
            .eq('stripe_payment_intent_id', paymentIntentId);
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Helper: read raw body for Stripe signature verification
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
