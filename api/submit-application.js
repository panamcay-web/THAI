// POST /api/submit-application
// Saves lead to Supabase and creates Stripe PaymentIntent

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const data = req.body;

    // Save lead to Supabase
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        // Personal Info
        family_name: data.familyName,
        first_name: data.firstName,
        middle_name: data.middleName || null,
        passport_number: data.passportNumber,
        nationality: data.nationality,
        date_of_birth: data.dateOfBirth,
        occupation: data.occupation,
        gender: data.gender,

        // Residence
        country_of_residence: data.countryOfResidence,
        city_of_residence: data.cityOfResidence,
        phone_number: data.phoneNumber,

        // Travel
        arrival_date: data.arrivalDate,
        purpose_of_travel: data.purposeOfTravel || data.othersPurpose,
        mode_of_transport: data.modeOfTransport || data.othersTransport,
        flight_number: data.flightNumber || null,

        // Departure
        departure_date: data.departureDate,
        mode_of_transport_departure: data.modeOfTransportDeparture || data.othersTransportDeparture,
        flight_number_departure: data.flightNumberDeparture || null,

        // Accommodation
        accommodation_type: data.transitPassenger ? 'transit' : (data.accommodationType || data.othersAccommodation),
        accommodation_address: data.accommodationAddress || null,
        transit_passenger: data.transitPassenger === true || data.transitPassenger === 'true',

        // Contact
        tdac_email: data.tdacEmail,

        status: 'pending'
      })
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);

    // Create Stripe PaymentIntent
    const price = parseInt(process.env.APPLICATION_PRICE || '2900');
    const currency = process.env.APPLICATION_CURRENCY || 'usd';

    const paymentIntent = await stripe.paymentIntents.create({
      amount: price,
      currency: currency,
      metadata: {
        lead_id: lead.id,
        applicant_name: `${data.firstName} ${data.familyName}`,
        passport_number: data.passportNumber,
        email: data.tdacEmail
      },
      receipt_email: data.tdacEmail,
      description: `Thailand TDAC Application - ${data.firstName} ${data.familyName}`
    });

    // Save PaymentIntent ID to lead
    await supabase
      .from('leads')
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq('id', lead.id);

    return res.status(200).json({
      success: true,
      lead_id: lead.id,
      client_secret: paymentIntent.client_secret
    });

  } catch (err) {
    console.error('submit-application error:', err);
    return res.status(500).json({ error: err.message });
  }
};
