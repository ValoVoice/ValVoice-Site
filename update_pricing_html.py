# -*- coding: utf-8 -*-
import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

pricing_section = '''    <!-- Pricing -->
    <section class="pricing" id="pricing">
        <div class="container">
            <div class="section-title reveal">
                <h2>Choose Your ValVoice Plan</h2>
                <p>Unlock the ValVoice experience with a plan that works for you.</p>
            </div>
            
            <div class="pricing-grid">
                <!-- Monthly Plan -->
                <div class="pricing-card reveal">
                    <h3>Monthly</h3>
                    <div class="price"><span>$</span>3<span>/month</span></div>
                    <p class="billing-desc">billed monthly</p>
                    <ul class="pricing-features">
                        <li><i class="fas fa-check"></i> Monthly recurring subscription</li>
                        <li><i class="fas fa-check"></i> Full access to OCR & TTS</li>
                        <li><i class="fas fa-check"></i> Cancel anytime</li>
                    </ul>
                    <a href="#" class="btn-val-secondary pricing-btn" onclick="return false;" style="cursor: not-allowed; opacity: 0.8;">Get Monthly Access</a>
                </div>
                
                <!-- Yearly Plan -->
                <div class="pricing-card popular reveal">
                    <div class="popular-badge">Best Value</div>
                    <h3>Yearly</h3>
                    <div class="price"><span>$</span>15<span>/year</span></div>
                    <p class="billing-desc">billed annually</p>
                    <ul class="pricing-features">
                        <li><i class="fas fa-check"></i> Annual recurring subscription</li>
                        <li><i class="fas fa-check"></i> Full access to OCR & TTS</li>
                        <li><i class="fas fa-check"></i> Cancel anytime</li>
                    </ul>
                    <a href="#" class="btn-val-primary pricing-btn" onclick="return false;" style="cursor: not-allowed; opacity: 0.8;">Get Yearly Access</a>
                </div>
                
                <!-- Lifetime Plan -->
                <div class="pricing-card reveal">
                    <h3>Lifetime</h3>
                    <div class="price"><span>$</span>30<span></span></div>
                    <p class="billing-desc">one-time payment</p>
                    <ul class="pricing-features">
                        <li><i class="fas fa-check"></i> One-time purchase</li>
                        <li><i class="fas fa-check"></i> No recurring charges</li>
                        <li><i class="fas fa-check"></i> Access for the lifespan of ValVoice</li>
                    </ul>
                    <a href="#" class="btn-val-secondary pricing-btn" onclick="return false;" style="cursor: not-allowed; opacity: 0.8;">Get Lifetime Access</a>
                </div>
            </div>
        </div>
    </section>

'''

# Inject Pricing before Download CTA
if '<!-- Pricing -->' not in html:
    html = html.replace('<!-- Download CTA -->', pricing_section + '    <!-- Download CTA -->')
    
    # Also in case it uses a different comment for CTA:
    if '<!-- Download CTA -->' not in html:
        # Looking for the CTA section directly
        html = html.replace('<section class="cta" id="download">', pricing_section + '    <section class="cta" id="download">')

# Add Pricing to main nav
if '<li><a href="#pricing">Pricing</a></li>' not in html:
    html = html.replace('<li><a href="#faq">FAQ</a></li>', '<li><a href="#pricing">Pricing</a></li>\n                    <li><a href="#faq">FAQ</a></li>')

# Add Pricing to footer
if '<li><a href="#pricing"><i class="fas fa-chevron-right"></i> Pricing</a></li>' not in html:
    html = html.replace('<li><a href="#testimonials"><i class="fas fa-chevron-right"></i> Testimonials</a></li>', '<li><a href="#testimonials"><i class="fas fa-chevron-right"></i> Testimonials</a></li>\n                        <li><a href="#pricing"><i class="fas fa-chevron-right"></i> Pricing</a></li>')


with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)