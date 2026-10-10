# -*- coding: utf-8 -*-
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Revert previous badge visibility if it was added
html = html.replace("document.getElementById('pro-badge').style.visibility = 'hidden';", "")
html = html.replace("document.getElementById('pro-badge').style.visibility = 'visible';", "")

# Add ID to the Pro card
html = html.replace('<div class="pricing-card popular reveal">', '<div class="pricing-card popular reveal" id="pro-card">')

# We can handle the popular class via JS.
# Let's completely rewrite the setBilling function to be robust
import re

new_script = '''    <script>
        function setBilling(plan) {
            const monthlyBtn = document.getElementById('toggle-monthly');
            const yearlyBtn = document.getElementById('toggle-yearly');
            const priceEl = document.getElementById('pro-price');
            const billingEl = document.getElementById('pro-billing');
            const savingsEl = document.getElementById('pro-savings');
            const ctaEl = document.getElementById('pro-cta');
            const proCard = document.getElementById('pro-card');
            const badge = document.getElementById('pro-badge');

            if (plan === 'monthly') {
                monthlyBtn.classList.add('active');
                monthlyBtn.setAttribute('aria-checked', 'true');
                yearlyBtn.classList.remove('active');
                yearlyBtn.setAttribute('aria-checked', 'false');
                
                priceEl.innerHTML = '<span>$</span>3<span>/month</span>';
                billingEl.textContent = 'billed monthly';
                savingsEl.style.visibility = 'hidden';
                ctaEl.textContent = 'Get Monthly Access';
                
                if(proCard) proCard.classList.remove('popular');
                if(badge) badge.style.visibility = 'hidden';
            } else {
                yearlyBtn.classList.add('active');
                yearlyBtn.setAttribute('aria-checked', 'true');
                monthlyBtn.classList.remove('active');
                monthlyBtn.setAttribute('aria-checked', 'false');
                
                priceEl.innerHTML = '<span>$</span>15<span>/year</span>';
                billingEl.textContent = 'billed annually';
                savingsEl.style.visibility = 'visible';
                ctaEl.textContent = 'Get Yearly Access';
                
                if(proCard) proCard.classList.add('popular');
                if(badge) badge.style.visibility = 'visible';
            }
        }
    </script>'''

html = re.sub(r'<script>\s*function setBilling\(plan\) \{.*?</script>', new_script, html, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)