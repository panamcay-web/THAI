// POST /api/create-checkout-session
// Creates a Stripe Checkout Session (hosted payment page) for one or more leads.
// Returns { url } — the frontend redirects the browser to this URL.

const Stripe = require('stripe');

const PRICE_PER_PERSON_CENTS = 4999; // $49.99

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { leadIds, email, name } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'leadIds are required' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Server-side price — never trust an amount sent from the browser.
    const quantity = leadIds.length;

    // Build absolute base URL for redirect targets.
    const origin =
      req.headers.origin ||
      (req.headers.host ? `https://${req.headers.host}` : 'https://www.thaisupportcenter.com');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Thailand Digital Arrival Card (TDAC) Assistance',
              description: 'Expert review and submission assistance'
            },
            unit_amount: PRICE_PER_PERSON_CENTS
          },
          quantity
        }
      ],
      customer_email: email || undefined,
      // lead_ids travel on both the session and the resulting payment intent
      metadata: {
        lead_ids: leadIds.join(','),
        applicant_name: name || ''
      },
      payment_intent_data: {
        metadata: { lead_ids: leadIds.join(',') },
        receipt_email: email || undefined
      },
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/apply.html`
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('create-checkout-session error:', err);
    return res.status(500).json({ error: err.message });
  }
};
