import re

with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

clickable_css = '''
a.clickable-step {
    display: block;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
}
a.clickable-step:focus-visible {
    outline: 2px solid var(--valorant-red);
    outline-offset: 4px;
}
a.clickable-step:hover {
    border-color: var(--valorant-red);
    box-shadow: 0 5px 20px rgba(255, 70, 85, 0.15);
}
'''

if 'a.clickable-step' not in css:
    css += clickable_css
    with open('style.css', 'w', encoding='utf-8') as f:
        f.write(css)
