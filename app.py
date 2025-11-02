from flask import Flask, request, jsonify, render_template
import stripe
import os

app = Flask(__name__)

# Set Stripe keys from environment variables
stripe.api_key = os.getenv('STRIPE_SECRET_KEY', 'sk_test_your_test_secret_key_here')
stripe_publishable_key = os.getenv('STRIPE_PUBLISHABLE_KEY', 'pk_test_your_test_publishable_key_here')

@app.route('/')
def home():
    return render_template('index.html', publishable_key=stripe_publishable_key)

@app.route('/check', methods=['POST'])
def check():
    data = request.get_json()
    card_number = data.get('card_number')
    exp_month = int(data.get('exp_month'))
    exp_year = int(data.get('exp_year'))
    cvc = data.get('cvc')
    
    try:
        # Create payment method
        payment_method = stripe.PaymentMethod.create(
            type='card',
            card={
                'number': card_number,
                'exp_month': exp_month,
                'exp_year': exp_year,
                'cvc': cvc,
            },
        )
        
        # Authorize $1
        payment_intent = stripe.PaymentIntent.create(
            amount=100,
            currency='usd',
            payment_method=payment_method.id,
            confirmation_method='manual',
            confirm=True,
            capture_method='manual',
        )
        
        if payment_intent.status == 'requires_capture':
            stripe.PaymentIntent.cancel(payment_intent.id)
            card_info = payment_method.card
            result = {
                'Status': 'Live',
                'Card Type': card_info.brand.capitalize(),
                'Last 4 Digits': card_info.last4,
                'Expiration Month': card_info.exp_month,
                'Expiration Year': card_info.exp_year,
                'Country': card_info.country,
                'Funding': card_info.funding.capitalize(),
                'Issuer': card_info.issuer or 'Unknown',
                'Checks': {
                    'Address Line1 Check': card_info.checks.address_line1_check,
                    'Address Postal Code Check': card_info.checks.address_postal_code_check,
                    'CVC Check': card_info.checks.cvc_check,
                }
            }
            return jsonify(result)
        else:
            return jsonify({'Status': 'Dead', 'Reason': payment_intent.last_payment_error.message if payment_intent.last_payment_error else 'Unknown'})
    except stripe.error.CardError as e:
        return jsonify({'Status': 'Dead', 'Reason': e.error.message})
    except Exception as e:
        return jsonify({'Status': 'Error', 'Reason': str(e)})

if __name__ == '__main__':
    app.run(debug=True)
