# -*- coding: utf-8 -*-
import os
import re

terms_html = '''<main>
<div class="container" style="padding-top: 120px; padding-bottom: 80px; min-height: 80vh; max-width: 900px; margin: 0 auto;">
    <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: #fff;">Terms & Conditions</h1>
    <p style="color: rgba(255,255,255,0.6); margin-bottom: 2rem;">Last Updated: October 2026</p>
    
    <div class="legal-content" style="color: rgba(255,255,255,0.85); line-height: 1.8; font-size: 1.05rem;">
        
        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">1. Introduction</h2>
        <p style="margin-bottom: 1rem;">Welcome to ValVoice. ValVoice is a Windows desktop application designed to convert VALORANT in-game text chat into spoken voice using local screen OCR and text-to-speech technology.</p>
        <p style="margin-bottom: 1rem;">By downloading, installing, accessing, or using ValVoice, you agree to be bound by these Terms & Conditions. If you do not agree to these terms, do not use the software.</p>

        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">2. Non-Affiliation Disclaimer</h2>
        <p style="margin-bottom: 1rem;"><strong>ValVoice is not affiliated, associated, authorized, endorsed by, or in any way officially connected with Riot Games, Inc., VALORANT, or any of their subsidiaries or affiliates.</strong> The official VALORANT website can be found at <a href="https://playvalorant.com/" target="_blank" rel="noopener noreferrer" style="color: #ff4655;">playvalorant.com</a>. The name VALORANT as well as related names, marks, emblems, and images are registered trademarks of their respective owners.</p>
        <p style="margin-bottom: 1rem;">ValVoice is a third-party accessibility and utility tool that operates externally using visual screen recognition (OCR) and does not modify, inject into, or interact directly with the VALORANT game files or memory.</p>

        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">3. Software Licensing and Permitted Use</h2>
        <p style="margin-bottom: 1rem;">Subject to your compliance with these Terms, ValVoice grants you a limited, non-exclusive, non-transferable, non-sublicensable license to download, install, and use the ValVoice software for your personal, non-commercial gaming purposes.</p>

        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">4. Acceptable Use Restrictions</h2>
        <ul style="margin-bottom: 1rem; margin-left: 2rem;">
            <li style="margin-bottom: 0.5rem;">You may not reverse engineer, decompile, or disassemble the ValVoice software.</li>
            <li style="margin-bottom: 0.5rem;">You may not use ValVoice to broadcast offensive, harassing, or illegal content into the game's voice communication channels.</li>
            <li style="margin-bottom: 0.5rem;">You may not distribute, license, or sell access to the ValVoice software.</li>
            <li style="margin-bottom: 0.5rem;">You are solely responsible for ensuring your use of ValVoice complies with the Riot Games Terms of Service and Community Code of Conduct.</li>
        </ul>

        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">5. Subscriptions and Lifetime Licenses</h2>
        <p style="margin-bottom: 1rem;">ValVoice may be offered under various billing plans, including monthly subscriptions, annual subscriptions, or a one-time lifetime license.</p>
        <ul style="margin-bottom: 1rem; margin-left: 2rem;">
            <li style="margin-bottom: 0.5rem;"><strong>Subscriptions:</strong> Subscriptions automatically renew at the end of the billing period unless canceled. You must cancel before the renewal date to avoid being charged for the next period.</li>
            <li style="margin-bottom: 0.5rem;"><strong>Lifetime License:</strong> A lifetime license grants you access to the software for the lifespan of the ValVoice product. It does not automatically renew.</li>
        </ul>

        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">6. Intellectual Property</h2>
        <p style="margin-bottom: 1rem;">The ValVoice software, its original content, features, and functionality are owned by ValVoice and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.</p>

        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">7. Disclaimers and Limitation of Liability</h2>
        <p style="margin-bottom: 1rem;">THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. ValVoice does not warrant that the software will be uninterrupted, error-free, or completely secure.</p>
        <p style="margin-bottom: 1rem;">In no event shall ValVoice, its developers, or its affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of game accounts (including bans or suspensions issued by Riot Games), loss of data, or other intangible losses resulting from your use of the software.</p>

        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">8. Termination</h2>
        <p style="margin-bottom: 1rem;">We may terminate or suspend your access to the ValVoice software immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>

        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">9. Contact</h2>
        <p style="margin-bottom: 1rem;">If you have any questions about these Terms, please contact us at <a href="mailto:valorantvoiceofficials@gmail.com" style="color: #ff4655;">valorantvoiceofficials@gmail.com</a>.</p>
    </div>
</div>
</main>'''

privacy_html = '''<main>
<div class="container" style="padding-top: 120px; padding-bottom: 80px; min-height: 80vh; max-width: 900px; margin: 0 auto;">
    <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: #fff;">Privacy Policy</h1>
    <p style="color: rgba(255,255,255,0.6); margin-bottom: 2rem;">Last Updated: October 2026</p>
    
    <div class="legal-content" style="color: rgba(255,255,255,0.85); line-height: 1.8; font-size: 1.05rem;">
        
        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">1. Core Privacy Principle: Local Processing</h2>
        <p style="margin-bottom: 1rem;">ValVoice is built with a privacy-first, local-processing architecture. The primary functions of the software - recognizing text on your screen and synthesizing speech - occur entirely on your local machine.</p>
        <p style="margin-bottom: 1rem;">ValVoice utilizes local OCR (Optical Character Recognition), local TTS processing, Pocket TTS, Windows SAPI, local audio processing, and local virtual audio routing (such as VB-CABLE).</p>

        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">2. What We Do Not Collect</h2>
        <p style="margin-bottom: 1rem;">To ensure your security and privacy, ValVoice <strong>does not</strong> collect, retain, or upload any of the following data to our servers or any third-party cloud service:</p>
        <ul style="margin-bottom: 1rem; margin-left: 2rem;">
            <li style="margin-bottom: 0.5rem;">VALORANT in-game chat messages</li>
            <li style="margin-bottom: 0.5rem;">OCR text output or transcription results</li>
            <li style="margin-bottom: 0.5rem;">Generated TTS audio files or voice streams</li>
            <li style="margin-bottom: 0.5rem;">Microphone recordings or voice communications</li>
            <li style="margin-bottom: 0.5rem;">Riot Games credentials or passwords</li>
            <li style="margin-bottom: 0.5rem;">Riot Player UUIDs (PUUID)</li>
            <li style="margin-bottom: 0.5rem;">Gameplay data or statistics</li>
        </ul>

        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">3. Screen Capture and OCR</h2>
        <p style="margin-bottom: 1rem;">ValVoice processes the required screen region locally for OCR and does not retain or transmit screenshots, screen recordings, or desktop imagery to ValVoice or third-party cloud services.</p>

        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">4. Limited Network Connections</h2>
        <p style="margin-bottom: 1rem;">While the core processing is local, ValVoice makes limited outbound network connections for essential software maintenance and diagnostics:</p>
        <ul style="margin-bottom: 1rem; margin-left: 2rem;">
            <li style="margin-bottom: 0.5rem;"><strong>GitHub:</strong> ValVoice connects to GitHub repositories to check for software updates and to download official release packages.</li>
            <li style="margin-bottom: 0.5rem;"><strong>PostHog:</strong> ValVoice uses PostHog for installation-scoped, pseudonymous telemetry and product diagnostics. This helps us understand crash reports, feature usage rates, and software stability. This telemetry does not contain the contents of your gameplay or screen.</li>
        </ul>

        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">5. Contact Information</h2>
        <p style="margin-bottom: 1rem;">If you have any questions about this Privacy Policy or our data practices, please contact us at <a href="mailto:valorantvoiceofficials@gmail.com" style="color: #ff4655;">valorantvoiceofficials@gmail.com</a>.</p>
    </div>
</div>
</main>'''

refund_html = '''<main>
<div class="container" style="padding-top: 120px; padding-bottom: 80px; min-height: 80vh; max-width: 900px; margin: 0 auto;">
    <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: #fff;">Refund & Cancellation Policy</h1>
    <p style="color: rgba(255,255,255,0.6); margin-bottom: 2rem;">Last Updated: October 2026</p>
    
    <div class="legal-content" style="color: rgba(255,255,255,0.85); line-height: 1.8; font-size: 1.05rem;">
        
        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">1. No Refund Policy</h2>
        <p style="margin-bottom: 1rem;">ValVoice purchases are generally <strong>non-refundable</strong>. This applies to all pricing tiers, including:</p>
        <ul style="margin-bottom: 1rem; margin-left: 2rem;">
            <li style="margin-bottom: 0.5rem;">Monthly subscriptions</li>
            <li style="margin-bottom: 0.5rem;">Annual subscriptions</li>
            <li style="margin-bottom: 0.5rem;">Lifetime purchases</li>
        </ul>
        <p style="margin-bottom: 1rem;">Except where a refund or cancellation right is required under applicable law, we do not issue refunds for any purchases once they have been processed.</p>

        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">2. Subscription Cancellation</h2>
        <p style="margin-bottom: 1rem;">For users on recurring billing cycles (monthly or annual plans):</p>
        <ul style="margin-bottom: 1rem; margin-left: 2rem;">
            <li style="margin-bottom: 0.5rem;">You may cancel your future renewal at any time.</li>
            <li style="margin-bottom: 0.5rem;">Cancellation stops all future recurring charges for that subscription.</li>
            <li style="margin-bottom: 0.5rem;">Cancellation does not automatically provide a refund for the already-paid billing period.</li>
            <li style="margin-bottom: 0.5rem;">Your access to ValVoice will remain available according to the applicable subscription terms until the end of your current paid billing period.</li>
        </ul>

        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">3. Lifetime Purchases</h2>
        <p style="margin-bottom: 1rem;">The ValVoice Lifetime plan is a one-time purchase. It does not automatically renew, and it grants ongoing access to the software without recurring charges.</p>

        <h2 style="color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem;">4. Support and Billing Questions</h2>
        <p style="margin-bottom: 1rem;">If you require assistance with canceling a subscription, or have account and billing-related questions, please contact our official support team at <a href="mailto:valorantvoiceofficials@gmail.com" style="color: #ff4655;">valorantvoiceofficials@gmail.com</a>.</p>
    </div>
</div>
</main>'''

def replace_main_content(filepath, new_main):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the <main> block
    content = re.sub(r'(?s)<main>.*?</main>', new_main, content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

replace_main_content('terms.html', terms_html)
replace_main_content('privacy.html', privacy_html)
replace_main_content('refund-policy.html', refund_html)

# Now let's update footer links across all HTML files
htmlFiles = []
for root, _, files in os.walk('.'):
    for f in files:
        if f.endswith('.html'):
            htmlFiles.append(os.path.join(root, f))

for file in htmlFiles:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace('Terms of Service</a>', 'Terms &amp; Conditions</a>')
    content = content.replace('Refund Policy</a>', 'Refund &amp; Cancellation Policy</a>')

    if file.endswith('terms.html'):
        content = re.sub(r'<title>.*?</title>', '<title>ValVoice Terms &amp; Conditions</title>', content)
        content = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="ValVoice Terms &amp; Conditions">', content)
        content = re.sub(r'<meta property="twitter:title" content="[^"]*">', '<meta property="twitter:title" content="ValVoice Terms &amp; Conditions">', content)
    
    if file.endswith('privacy.html'):
        content = re.sub(r'<title>.*?</title>', '<title>ValVoice Privacy Policy</title>', content)
        content = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="ValVoice Privacy Policy">', content)
        content = re.sub(r'<meta property="twitter:title" content="[^"]*">', '<meta property="twitter:title" content="ValVoice Privacy Policy">', content)

    if file.endswith('refund-policy.html'):
        content = re.sub(r'<title>.*?</title>', '<title>ValVoice Refund &amp; Cancellation Policy</title>', content)
        content = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="ValVoice Refund &amp; Cancellation Policy">', content)
        content = re.sub(r'<meta property="twitter:title" content="[^"]*">', '<meta property="twitter:title" content="ValVoice Refund &amp; Cancellation Policy">', content)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Updated legal pages and footer links")