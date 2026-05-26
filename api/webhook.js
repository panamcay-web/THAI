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
      // Primary success path: Stripe-hosted Checkout completed.
      // One Checkout Session can cover several applicants (leads).
      case 'checkout.session.completed': {
        const session = event.data.object;
        const leadIds = (session.metadata?.lead_ids || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id || null;
        const currency = session.currency || 'usd';
        const email = session.customer_details?.email || session.customer_email || null;
        const name = session.customer_details?.name || session.metadata?.applicant_name || null;

        // Split the total evenly across the applicants it paid for.
        const perLead = leadIds.length
          ? Math.round((session.amount_total || 0) / leadIds.length)
          : (session.amount_total || 0);

        for (const leadId of leadIds) {
          await supabase
            .from('leads')
            .update({
              status: 'paid',
              stripe_payment_status: 'succeeded',
              stripe_payment_intent_id: paymentIntentId,
              amount_paid: perLead,
              currency,
              paid_at: new Date().toISOString()
            })
            .eq('id', leadId);

          await supabase.from('payments').insert({
            lead_id: leadId,
            stripe_payment_intent_id: paymentIntentId,
            amount: perLead,
            currency,
            status: 'succeeded',
            customer_email: email,
            customer_name: name,
            raw_event: event
          });
        }

        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const leadId = paymentIntent.metadata?.lead_id;

        // Checkout-driven payments are handled by checkout.session.completed
        // above (they carry `lead_ids`, not a singular `lead_id`). Ignore them
        // here to avoid creating duplicate / orphaned payment rows.
        if (!leadId) break;

        // Update lead status to paid
        await supabase
          .from('leads')
          .update({
            status: 'paid',
            stripe_payment_status: 'succeeded',
            stripe_payment_intent_id: paymentIntent.id,
            amount_paid: paymentIntent.amount,
            currency: paymentIntent.currency,
            paid_at: new Date().toISOString()
          })
          .eq('id', leadId);

        // Save payment record
        await supabase.from('payments').insert({
          lead_id: leadId,
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
        // Support both singular (lead_id) and Checkout plural (lead_ids).
        const leadIds = (paymentIntent.metadata?.lead_ids || paymentIntent.metadata?.lead_id || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

        // No leads attached — nothing meaningful to record.
        if (leadIds.length === 0) break;

        for (const leadId of leadIds) {
          await supabase
            .from('leads')
            .update({ stripe_payment_status: 'failed' })
            .eq('id', leadId);

          await supabase.from('payments').insert({
            lead_id: leadId,
            stripe_payment_intent_id: paymentIntent.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: 'failed',
            customer_email: paymentIntent.receipt_email,
            raw_event: event
          });
        }

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

// Helper: read raw body for Stripe signature verification.
// Stripe needs the exact raw bytes — if the platform already buffered the
// body as a Buffer, use it directly; otherwise read it from the stream.
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    if (Buffer.isBuffer(req.body)) return resolve(req.body);
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
