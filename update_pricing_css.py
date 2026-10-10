# -*- coding: utf-8 -*-
import re

with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

pricing_css = '''
/* Pricing */
.pricing {
    background: var(--valorant-dark);
}

.pricing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 30px;
    margin-top: 40px;
}

.pricing-card {
    background: var(--valorant-card);
    padding: 40px 30px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.03);
    backdrop-filter: blur(10px);
    transition: var(--transition);
    position: relative;
    display: flex;
    flex-direction: column;
}

.pricing-card:hover {
    transform: translateY(-5px);
    border-color: rgba(255,70,85,0.2);
}

.pricing-card.popular {
    border-color: rgba(255,70,85,0.4);
    box-shadow: 0 10px 30px rgba(255,70,85,0.1);
}

.pricing-card.popular:hover {
    border-color: var(--valorant-red);
    box-shadow: 0 15px 40px rgba(255,70,85,0.2);
}

.popular-badge {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--valorant-red);
    color: #fff;
    padding: 4px 16px;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.pricing-card h3 {
    font-family: 'Outfit', sans-serif;
    font-size: 1.5rem;
    color: #fff;
    margin-bottom: 15px;
}

.price {
    font-size: 3rem;
    font-weight: 800;
    color: #fff;
    font-family: 'Outfit', sans-serif;
    line-height: 1;
    margin-bottom: 5px;
    display: flex;
    align-items: flex-start;
}

.price span:first-child {
    font-size: 1.5rem;
    margin-top: 5px;
    margin-right: 2px;
}

.price span:last-child {
    font-size: 1rem;
    color: rgba(255,255,255,0.5);
    align-self: flex-end;
    margin-bottom: 8px;
    margin-left: 2px;
    font-weight: 500;
}

.billing-desc {
    color: var(--valorant-red);
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 30px;
}

.pricing-features {
    margin-bottom: 40px;
    flex-grow: 1;
}

.pricing-features li {
    display: flex;
    align-items: flex-start;
    margin-bottom: 15px;
    color: rgba(255,255,255,0.8);
    font-size: 0.95rem;
    line-height: 1.5;
}

.pricing-features li i {
    color: var(--valorant-red);
    margin-right: 12px;
    margin-top: 4px;
    font-size: 0.9rem;
}

.pricing-btn {
    width: 100%;
    text-align: center;
    padding: 14px 20px;
}
'''

if '.pricing-grid' not in css:
    css += pricing_css
    with open('style.css', 'w', encoding='utf-8') as f:
        f.write(css)