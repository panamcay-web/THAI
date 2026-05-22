// GET /api/get-leads
// Returns leads from Supabase for admin panel (password protected)

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Simple password check via Authorization header or query param
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

    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '50');
    const status = req.query.status;
    const search = req.query.search;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(
        `family_name.ilike.%${search}%,first_name.ilike.%${search}%,tdac_email.ilike.%${search}%,passport_number.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) throw new Error(error.message);

    return res.status(200).json({
      success: true,
      leads: data,
      total: count,
      page,
      limit
    });

  } catch (err) {
    console.error('get-leads error:', err);
    return res.status(500).json({ error: err.message });
  }
};
