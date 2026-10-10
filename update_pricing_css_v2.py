import re

with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

# I will add CSS for the billing toggle switch and neutral button styles.
toggle_css = '''
/* Billing Toggle Switch */
.billing-toggle {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 30px;
    padding: 4px;
    margin-bottom: 20px;
    width: fit-content;
}

.toggle-option {
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    color: rgba(255, 255, 255, 0.6);
}

.toggle-option.active {
    background: var(--valorant-red);
    color: #fff;
    box-shadow: 0 4px 10px rgba(255, 70, 85, 0.3);
}

.savings-msg {
    color: var(--valorant-red);
    font-size: 0.85rem;
    font-weight: 600;
    margin-top: -20px;
    margin-bottom: 25px;
    min-height: 1.2em; /* Keep layout stable when hidden */
}

/* Neutral Buttons for Free / Lifetime */
.btn-val-neutral {
    background: transparent;
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    font-family: 'Orbitron', sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    transition: var(--transition);
}

.btn-val-neutral:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.4);
}
'''

if '.billing-toggle' not in css:
    css += toggle_css
    with open('style.css', 'w', encoding='utf-8') as f:
        f.write(css)