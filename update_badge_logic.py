# -*- coding: utf-8 -*-
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Add ID to the badge
html = html.replace('<div class="popular-badge">Best Value</div>', '<div class="popular-badge" id="pro-badge">Best Value</div>')

# Update JS function to toggle badge visibility
new_js_logic_monthly = '''                priceEl.innerHTML = '<span>$</span>3<span>/month</span>';
                billingEl.textContent = 'billed monthly';
                savingsEl.style.visibility = 'hidden';
                ctaEl.textContent = 'Get Monthly Access';
                document.getElementById('pro-badge').style.visibility = 'hidden';'''

new_js_logic_yearly = '''                priceEl.innerHTML = '<span>$</span>15<span>/year</span>';
                billingEl.textContent = 'billed annually';
                savingsEl.style.visibility = 'visible';
                ctaEl.textContent = 'Get Yearly Access';
                document.getElementById('pro-badge').style.visibility = 'visible';'''

# We need to replace the exact strings in the JS function
html = html.replace('''                priceEl.innerHTML = '<span>$</span>3<span>/month</span>';
                billingEl.textContent = 'billed monthly';
                savingsEl.style.visibility = 'hidden';
                ctaEl.textContent = 'Get Monthly Access';''', new_js_logic_monthly)

html = html.replace('''                priceEl.innerHTML = '<span>$</span>15<span>/year</span>';
                billingEl.textContent = 'billed annually';
                savingsEl.style.visibility = 'visible';
                ctaEl.textContent = 'Get Yearly Access';''', new_js_logic_yearly)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)