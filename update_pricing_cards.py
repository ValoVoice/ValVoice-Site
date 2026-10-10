# -*- coding: utf-8 -*-
import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

new_pricing_grid = '''            <div class="pricing-grid">
                <!-- Free Plan -->
                <div class="pricing-card reveal" style="border-color: rgba(255,255,255,0.05);">
                    <h3>Free</h3>
                    <div class="price"><span>$</span>0</div>
                    <p class="billing-desc">Limited weekly usage</p>
                    <ul class="pricing-features">
                        <li><i class="fas fa-check" style="color: rgba(255,255,255,0.5);"></i> Core ValVoice features</li>
                        <li><i class="fas fa-check" style="color: rgba(255,255,255,0.5);"></i> Try OCR & TTS</li>
                        <li><i class="fas fa-check" style="color: rgba(255,255,255,0.5);"></i> Weekly usage limit</li>
                    </ul>
                    <a href="/download" class="btn-val-neutral pricing-btn">Get Started</a>
                </div>
                
                <!-- Pro Plan -->
                <div class="pricing-card popular reveal">
                    <div class="popular-badge">Best Value</div>
                    <h3>Pro</h3>
                    
                    <div class="billing-toggle" role="radiogroup" aria-label="Billing frequency">
                        <div class="toggle-option" id="toggle-monthly" role="radio" aria-checked="false" tabindex="0" onclick="setBilling('monthly')">Monthly</div>
                        <div class="toggle-option active" id="toggle-yearly" role="radio" aria-checked="true" tabindex="0" onclick="setBilling('yearly')">Yearly</div>
                    </div>
                    
                    <div class="price" id="pro-price"><span>$</span>15<span>/year</span></div>
                    <p class="billing-desc" id="pro-billing">billed annually</p>
                    <p class="savings-msg" id="pro-savings">Just .25/month, billed annually — 58% less than paying monthly.</p>
                    
                    <ul class="pricing-features">
                        <li><i class="fas fa-check"></i> Full access to OCR & TTS</li>
                        <li><i class="fas fa-check"></i> Unlimited access</li>
                        <li><i class="fas fa-check"></i> Cancel anytime</li>
                    </ul>
                    <a href="#" class="btn-val-primary pricing-btn" id="pro-cta" onclick="return false;" style="cursor: not-allowed; opacity: 0.8;">Get Yearly Access</a>
                </div>
                
                <!-- Lifetime Plan -->
                <div class="pricing-card reveal">
                    <h3>Lifetime</h3>
                    <div class="price"><span>$</span>30</div>
                    <p class="billing-desc">One-time payment</p>
                    <ul class="pricing-features">
                        <li><i class="fas fa-check"></i> One-time purchase</li>
                        <li><i class="fas fa-check"></i> No recurring charges</li>
                        <li><i class="fas fa-check"></i> Unlimited access to OCR & TTS</li>
                        <li><i class="fas fa-check"></i> Access for the lifespan of ValVoice</li>
                        <li><i class="fas fa-check"></i> Priority support</li>
                    </ul>
                    <a href="#" class="btn-val-neutral pricing-btn" onclick="return false;" style="cursor: not-allowed; opacity: 0.8;">Get Lifetime Access</a>
                </div>
            </div>'''

# Replace the pricing grid content
html = re.sub(r'<div class="pricing-grid">.*?</div>\s*</div>\s*</section>', new_pricing_grid + '\n        </div>\n    </section>', html, flags=re.DOTALL)

# Add the JavaScript for the toggle at the end of the file before </body> if it doesn't exist
script_str = '''
    <script>
        function setBilling(plan) {
            const monthlyBtn = document.getElementById('toggle-monthly');
            const yearlyBtn = document.getElementById('toggle-yearly');
            const priceEl = document.getElementById('pro-price');
            const billingEl = document.getElementById('pro-billing');
            const savingsEl = document.getElementById('pro-savings');
            const ctaEl = document.getElementById('pro-cta');

            if (plan === 'monthly') {
                monthlyBtn.classList.add('active');
                monthlyBtn.setAttribute('aria-checked', 'true');
                yearlyBtn.classList.remove('active');
                yearlyBtn.setAttribute('aria-checked', 'false');
                
                priceEl.innerHTML = '<span>$</span>3<span>/month</span>';
                billingEl.textContent = 'billed monthly';
                savingsEl.style.visibility = 'hidden';
                ctaEl.textContent = 'Get Monthly Access';
            } else {
                yearlyBtn.classList.add('active');
                yearlyBtn.setAttribute('aria-checked', 'true');
                monthlyBtn.classList.remove('active');
                monthlyBtn.setAttribute('aria-checked', 'false');
                
                priceEl.innerHTML = '<span>$</span>15<span>/year</span>';
                billingEl.textContent = 'billed annually';
                savingsEl.style.visibility = 'visible';
                ctaEl.textContent = 'Get Yearly Access';
            }
        }
    </script>
</body>'''

if 'function setBilling(plan)' not in html:
    html = html.replace('</body>', script_str)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)