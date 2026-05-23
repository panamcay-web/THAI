// GET /api/get-payments
// Returns payments + summary stats for admin panel

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'];
  const queryPassword = req.query.password;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const providedPassword = authHeader?.replace('Bearer ', '') || queryPassword;

  if (!adminPassword || providedPassword !== adminPassword) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: payments, error } = await supabase
      .from('payments')
      .select(`*, leads (family_name, first_name, tdac_email, passport_number, nationality, arrival_date, processed)`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    const { data: stats } = await supabase
      .from('leads')
      .select('status, amount_paid, currency');

    const summary = {
      total_leads: stats?.length || 0,
      paid: stats?.filter(l => l.status === 'paid' || l.status === 'completed').length || 0,
      pending: stats?.filter(l => l.status === 'pending').length || 0,
      refunded: stats?.filter(l => l.status === 'refunded').length || 0,
      total_revenue: stats?.reduce((sum, l) => sum + (l.amount_paid || 0), 0) || 0
    };

    return res.status(200).json({ success: true, payments, summary });

  } catch (err) {
    console.error('get-payments error:', err);
    return res.status(500).json({ error: err.message });
  }
};
