// POST /api/submit-application
// Saves multiple leads to Supabase (no Stripe yet)

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

    const { applicants } = req.body;

    if (!Array.isArray(applicants) || applicants.length === 0) {
      return res.status(400).json({ error: 'No applicants provided' });
    }

    // Convert each applicant to database format
    const leadsToInsert = applicants.map(applicant => ({
      family_name: applicant.familyName,
      first_name: applicant.firstName,
      middle_name: applicant.middleName || null,
      passport_number: applicant.passportNumber,
      nationality: applicant.nationality,
      date_of_birth: applicant.dateOfBirth,
      occupation: applicant.occupation,
      gender: applicant.gender,
      country_of_residence: applicant.countryOfResidence,
      city_of_residence: applicant.cityOfResidence,
      phone_number: applicant.phoneNumber,
      arrival_date: applicant.arrivalDate,
      purpose_of_travel: applicant.purposeOfTravel === 'others' ? applicant.othersPurpose : applicant.purposeOfTravel,
      mode_of_transport: applicant.modeOfTransport === 'others-transport' ? applicant.othersTransport : applicant.modeOfTransport,
      flight_number: applicant.flightNumber || null,
      departure_date: applicant.departureDate,
      mode_of_transport_departure: applicant.modeOfTransportDeparture === 'others-transport' ? applicant.othersTransportDeparture : applicant.modeOfTransportDeparture,
      flight_number_departure: applicant.flightNumberDeparture || null,
      accommodation_type: applicant.transitPassenger ? 'transit' : (applicant.accommodationType === 'others' ? applicant.othersAccommodation : applicant.accommodationType),
      accommodation_address: applicant.accommodationAddress || null,
      transit_passenger: applicant.transitPassenger === true || applicant.transitPassenger === 'true',
      tdac_email: applicant.tdacEmail,
      status: 'pending'
    }));

    // Insert all applicants at once
    const { data: leads, error } = await supabase
      .from('leads')
      .insert(leadsToInsert)
      .select();

    if (error) throw new Error(`DB error: ${error.message}`);

    return res.status(200).json({
      success: true,
      leads_count: leads.length,
      lead_ids: leads.map(l => l.id),
      // No Stripe yet - payment will be added later
      client_secret: null
    });

  } catch (err) {
    console.error('submit-application error:', err);
    return res.status(500).json({ error: err.message });
  }
};
