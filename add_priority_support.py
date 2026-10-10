# -*- coding: utf-8 -*-
import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Add the priority support li element
new_li = '''<li><i class="fas fa-check"></i> Cancel anytime</li>
                        <li id="pro-priority-support"><i class="fas fa-check"></i> Priority support</li>'''
html = html.replace('<li><i class="fas fa-check"></i> Cancel anytime</li>', new_li)

# Update the JavaScript to toggle it
js_monthly_old = '''                ctaEl.textContent = 'Get Monthly Access';
                
                if(proCard) proCard.classList.remove('popular');'''
js_monthly_new = '''                ctaEl.textContent = 'Get Monthly Access';
                
                const prioritySupport = document.getElementById('pro-priority-support');
                if(prioritySupport) prioritySupport.style.display = 'none';
                
                if(proCard) proCard.classList.remove('popular');'''

js_yearly_old = '''                ctaEl.textContent = 'Get Yearly Access';
                
                if(proCard) proCard.classList.add('popular');'''
js_yearly_new = '''                ctaEl.textContent = 'Get Yearly Access';
                
                const prioritySupport = document.getElementById('pro-priority-support');
                if(prioritySupport) prioritySupport.style.display = 'block';
                
                if(proCard) proCard.classList.add('popular');'''

html = html.replace(js_monthly_old, js_monthly_new)
html = html.replace(js_yearly_old, js_yearly_new)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)