# -*- coding: utf-8 -*-
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# We need to target the Lifetime card's Priority support line. 
# There's also the Pro card's Priority support line which has id="pro-priority-support".
# The Lifetime one doesn't have an ID, it's just '<li><i class="fas fa-check"></i> Priority support</li>'.

html = html.replace('<li><i class="fas fa-check"></i> Priority support</li>', '<li><i class="fas fa-check"></i> Premium Support</li>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)