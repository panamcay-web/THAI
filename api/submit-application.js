// POST /api/submit-application
// Saves lead to Supabase (no Stripe yet)

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const data = req.body;

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        family_name: data.familyName,
        first_name: data.firstName,
        middle_name: data.middleName || null,
        passport_number: data.passportNumber,
        nationality: data.nationality,
        date_of_birth: data.dateOfBirth,
        occupation: data.occupation,
        gender: data.gender,
        country_of_residence: data.countryOfResidence,
        city_of_residence: data.cityOfResidence,
        phone_number: data.phoneNumber,
        arrival_date: data.arrivalDate,
        purpose_of_travel: data.purposeOfTravel || data.othersPurpose,
        mode_of_transport: data.modeOfTransport || data.othersTransport,
        flight_number: data.flightNumber || null,
        departure_date: data.departureDate,
        mode_of_transport_departure: data.modeOfTransportDeparture || data.othersTransportDeparture,
        flight_number_departure: data.flightNumberDeparture || null,
        accommodation_type: data.transitPassenger ? 'transit' : (data.accommodationType || data.othersAccommodation),
        accommodation_address: data.accommodationAddress || null,
        transit_passenger: data.transitPassenger === true || data.transitPassenger === 'true',
        tdac_email: data.tdacEmail,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);

    return res.status(200).json({
      success: true,
      lead_id: lead.id,
      // No Stripe yet - payment will be added later
      client_secret: null
    });

  } catch (err) {
    console.error('submit-application error:', err);
    return res.status(500).json({ error: err.message });
  }
};
