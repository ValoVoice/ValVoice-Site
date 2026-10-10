# -*- coding: utf-8 -*-
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re

# We will replace the savings-msg paragraph with a structured div matching Image 2, but colored green.
new_savings = '''<div class="savings-msg" id="pro-savings" style="margin-top: 15px; margin-bottom: 25px; min-height: 3em;">
                        <div style="color: #10b981; font-size: 1.1rem; font-weight: 700; margin-bottom: 4px;">Just .25/month</div>
                        <div style="color: #10b981; font-size: 0.85rem; opacity: 0.9;">Billed annually &mdash; 58% less than paying monthly.</div>
                    </div>'''

html = re.sub(r'<p class="savings-msg" id="pro-savings">.*?</p>', new_savings, html)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)