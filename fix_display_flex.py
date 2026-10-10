# -*- coding: utf-8 -*-
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace("if(prioritySupport) prioritySupport.style.display = 'block';", "if(prioritySupport) prioritySupport.style.display = 'flex';")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)