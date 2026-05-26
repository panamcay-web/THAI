// DELETE /api/delete-lead
// Deletes a lead from Supabase (password protected)

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

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

    const { leadId } = req.body;

    if (!leadId) {
      return res.status(400).json({ error: 'Lead ID is required' });
    }

    // A paid lead has rows in the `payments` table that reference it
    // (payments.lead_id -> leads.id, with no ON DELETE CASCADE). Postgres blocks
    // deleting the lead while those rows exist — which is why previously only
    // pending leads (which have no payment rows) could be deleted. Remove the
    // dependent payment rows first, then delete the lead itself.
    const { error: payErr } = await supabase
      .from('payments')
      .delete()
      .eq('lead_id', leadId);

    if (payErr) throw new Error(`DB error (payments): ${payErr.message}`);

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId);

    if (error) throw new Error(`DB error: ${error.message}`);

    return res.status(200).json({
      success: true,
      message: 'Lead deleted successfully'
    });

  } catch (err) {
    console.error('delete-lead error:', err);
    return res.status(500).json({ error: err.message });
  }
};
