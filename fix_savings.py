# -*- coding: utf-8 -*-
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re
html = re.sub(r'<p class="savings-msg" id="pro-savings">.*?</p>', '<p class="savings-msg" id="pro-savings">Just .25/month, billed annually &mdash; 58% less than paying monthly.</p>', html)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)