const stripe = Stripe('YOUR_PUBLISHABLE_KEY'); // Replace with your pk_... from env



document.getElementById('single-form').addEventListener('submit', async (e) => {

    e.preventDefault();

    const cardNumber = document.getElementById('card-number').value;

    const expiry = document.getElementById('expiry').value;

    const cvc = document.getElementById('cvc').value;

    

    const resultDiv = document.getElementById('result');

    resultDiv.innerHTML = 'Checking...';

    

    // Create card element

    const elements = stripe.elements();

    const card = elements.create('card', {style: {base: {color: '#00FF7F'}}});

    // (For simplicity, we're using manual input; in prod, mount card element)

    

    try {

        const response = await fetch('/.netlify/functions/check-card', {

            method: 'POST',

            headers: {'Content-Type': 'application/json'},

            body: JSON.stringify({cardNumber, expiry, cvc})

        });

        const data = await response.json();

        resultDiv.innerHTML = data.status === 'live' ? `<p>Live: ${data.details}</p>` : `<p>Dead: ${data.details}</p>`;

    } catch (err) {

        resultDiv.innerHTML = `<p>Error: ${err.message}</p>`;

    }

});



document.getElementById('bulk-check-btn').addEventListener('click', async () => {

    const file = document.getElementById('csv-file').files[0];

    if (!file) return alert('Select a CSV file');

    

    const reader = new FileReader();

    reader.onload = async (e) => {

        const csv = e.target.result;

        const rows = csv.split('\n').map(row => row.split('|'));  // Changed delimiter to '|'

        const resultsDiv = document.getElementById('bulk-results');

        resultsDiv.innerHTML = '';

        

        for (let i = 1; i < rows.length; i++) { // Skip header

            const [cardNumber, expiry, cvc] = rows[i];

            if (!cardNumber || !expiry || !cvc) continue;

            

            try {

                const response = await fetch('/.netlify/functions/check-card', {

                    method: 'POST',

                    headers: {'Content-Type': 'application/json'},

                    body: JSON.stringify({cardNumber, expiry, cvc})

                });

                const data = await response.json();

                resultsDiv.innerHTML += `<p>${cardNumber}: ${data.status} - ${data.details}</p>`;

            } catch (err) {

                resultsDiv.innerHTML += `<p>${cardNumber}: Error - ${err.message}</p>`;

            }

            await new Promise(resolve => setTimeout(resolve, Math.random() * 4000 + 1000)); // Delay 1-5s

        }

    };

    reader.readAsText(file);

});
