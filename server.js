// Local development server with mock database
const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ───────────────────────────────────────────────────────────────
// Mock Database (in-memory)
// ───────────────────────────────────────────────────────────────
let leads = [
    {
        id: '1',
        family_name: 'Smith',
        first_name: 'John',
        middle_name: 'Michael',
        passport_number: 'AB123456',
        nationality: 'US',
        date_of_birth: '1990-05-15',
        occupation: 'Software Engineer',
        gender: 'male',
        country_of_residence: 'US',
        city_of_residence: 'New York',
        phone_number: '+1 (212) 555-0123',
        arrival_date: '2026-06-15',
        purpose_of_travel: 'tourism',
        mode_of_transport: 'airplane',
        flight_number: 'AA100',
        departure_date: '2026-06-25',
        mode_of_transport_departure: 'airplane',
        flight_number_departure: 'AA101',
        accommodation_type: 'hotel',
        accommodation_address: 'Nana Hotel, Bangkok',
        transit_passenger: false,
        tdac_email: 'john@example.com',
        status: 'paid',
        stripe_payment_intent_id: 'pi_test123',
        stripe_payment_status: 'succeeded',
        amount_paid: 4999,
        currency: 'usd',
        paid_at: new Date().toISOString(),
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: '2',
        family_name: 'Johnson',
        first_name: 'Sarah',
        middle_name: null,
        passport_number: 'CD789012',
        nationality: 'GB',
        date_of_birth: '1995-03-22',
        occupation: 'Marketing Manager',
        gender: 'female',
        country_of_residence: 'GB',
        city_of_residence: 'London',
        phone_number: '+44 20 7946 0958',
        arrival_date: '2026-07-10',
        purpose_of_travel: 'business',
        mode_of_transport: 'airplane',
        flight_number: 'BA200',
        departure_date: '2026-07-17',
        mode_of_transport_departure: 'airplane',
        flight_number_departure: 'BA201',
        accommodation_type: 'hotel',
        accommodation_address: 'Sheraton Bangkok, Thailand',
        transit_passenger: false,
        tdac_email: 'sarah@example.com',
        status: 'pending',
        stripe_payment_intent_id: null,
        stripe_payment_status: null,
        amount_paid: null,
        currency: null,
        paid_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

let payments = [
    {
        id: '1',
        lead_id: '1',
        stripe_payment_intent_id: 'pi_test123',
        amount: 4999,
        currency: 'usd',
        status: 'succeeded',
        customer_email: 'john@example.com',
        customer_name: 'John Smith',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

// ───────────────────────────────────────────────────────────────
// API: POST /api/submit-application
// ───────────────────────────────────────────────────────────────
app.post('/api/submit-application', (req, res) => {
    const adminPassword = 'test123';
    const authHeader = req.headers['authorization'];
    const providedPassword = authHeader?.replace('Bearer ', '');

    if (providedPassword && providedPassword !== adminPassword) {
        // For now, don't require auth on submit
    }

    const data = req.body;
    const id = Math.random().toString(36).substr(2, 9);

    const newLead = {
        id,
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
        purpose_of_travel: data.purposeOfTravel,
        mode_of_transport: data.modeOfTransport,
        flight_number: data.flightNumber || null,
        departure_date: data.departureDate,
        mode_of_transport_departure: data.modeOfTransportDeparture,
        flight_number_departure: data.flightNumberDeparture || null,
        accommodation_type: data.accommodationType || null,
        accommodation_address: data.accommodationAddress || null,
        transit_passenger: data.transitPassenger || false,
        tdac_email: data.tdacEmail,
        status: 'pending',
        stripe_payment_intent_id: null,
        stripe_payment_status: null,
        amount_paid: null,
        currency: null,
        paid_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    leads.push(newLead);

    // Simulate Stripe PaymentIntent
    const clientSecret = 'pi_test_' + id + '_secret_' + Math.random().toString(36).substr(2, 9);

    res.json({
        success: true,
        lead_id: id,
        client_secret: clientSecret
    });
});

// ───────────────────────────────────────────────────────────────
// API: GET /api/get-leads
// ───────────────────────────────────────────────────────────────
app.get('/api/get-leads', (req, res) => {
    const authHeader = req.headers['authorization'];
    const queryPassword = req.query.password;
    const providedPassword = authHeader?.replace('Bearer ', '') || queryPassword;

    if (providedPassword !== 'test123') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '25');
    const status = req.query.status;
    const search = req.query.search;

    let filtered = leads;

    if (status && status !== 'all') {
        filtered = filtered.filter(l => l.status === status);
    }

    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(l =>
            l.family_name.toLowerCase().includes(q) ||
            l.first_name.toLowerCase().includes(q) ||
            l.tdac_email.toLowerCase().includes(q) ||
            l.passport_number.toLowerCase().includes(q)
        );
    }

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    res.json({
        success: true,
        leads: paginated,
        total,
        page,
        limit
    });
});

// ───────────────────────────────────────────────────────────────
// API: GET /api/get-payments
// ───────────────────────────────────────────────────────────────
app.get('/api/get-payments', (req, res) => {
    const authHeader = req.headers['authorization'];
    const queryPassword = req.query.password;
    const providedPassword = authHeader?.replace('Bearer ', '') || queryPassword;

    if (providedPassword !== 'test123') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Join payments with leads
    const paymentsWithLeads = payments.map(p => {
        const lead = leads.find(l => l.id === p.lead_id);
        return {
            ...p,
            leads: lead ? {
                family_name: lead.family_name,
                first_name: lead.first_name,
                tdac_email: lead.tdac_email,
                passport_number: lead.passport_number,
                nationality: lead.nationality,
                arrival_date: lead.arrival_date
            } : null
        };
    });

    // Summary stats
    const summary = {
        total_leads: leads.length,
        paid: leads.filter(l => l.status === 'paid' || l.status === 'completed').length,
        pending: leads.filter(l => l.status === 'pending').length,
        refunded: leads.filter(l => l.status === 'refunded').length,
        total_revenue: leads.reduce((sum, l) => sum + (l.amount_paid || 0), 0)
    };

    res.json({
        success: true,
        payments: paymentsWithLeads,
        summary
    });
});

// ───────────────────────────────────────────────────────────────
// API: POST /api/webhook (for testing)
// ───────────────────────────────────────────────────────────────
app.post('/api/webhook', (req, res) => {
    const event = req.body;

    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const leadId = paymentIntent.metadata?.lead_id;

        if (leadId) {
            const lead = leads.find(l => l.id === leadId);
            if (lead) {
                lead.status = 'paid';
                lead.stripe_payment_status = 'succeeded';
                lead.amount_paid = paymentIntent.amount;
                lead.currency = paymentIntent.currency;
                lead.paid_at = new Date().toISOString();
            }
        }

        // Add payment record
        payments.push({
            id: Math.random().toString(36).substr(2, 9),
            lead_id: leadId,
            stripe_payment_intent_id: paymentIntent.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: 'succeeded',
            customer_email: paymentIntent.receipt_email,
            customer_name: paymentIntent.metadata?.applicant_name,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    }

    res.json({ received: true });
});

// ───────────────────────────────────────────────────────────────
// Serve HTML files
// ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/index.html'));
});

app.get('/apply', (req, res) => {
    res.sendFile(path.join(__dirname, 'apply.html'));
});

// ───────────────────────────────────────────────────────────────
// Start server
// ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║  🚀 Thailand TDAC Server запущен                          ║
║                                                            ║
║  📍 http://localhost:${PORT}                                ║
║  📱 Форма:  http://localhost:${PORT}/apply                 ║
║  🔐 Админка: http://localhost:${PORT}/admin               ║
║                                                            ║
║  Пароль админки: test123                                  ║
║                                                            ║
║  Mock данные загружены (2 лида)                           ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});
