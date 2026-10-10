# -*- coding: utf-8 -*-
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Change visibility to display for the savings element
html = html.replace("savingsEl.style.visibility = 'hidden';", "savingsEl.style.display = 'none';")
html = html.replace("savingsEl.style.visibility = 'visible';", "savingsEl.style.display = 'block';")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)