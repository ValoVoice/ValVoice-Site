import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace Title and Meta
html = re.sub(r'<title>.*?</title>', '<title>Download ValVoice | Valorant Text-to-Voice Game Chat Assistant</title>', html)
html = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="Download ValVoice, the Windows desktop application that converts Valorant text chat into spoken voice using OCR.">', html)
html = re.sub(r'<link rel="canonical" href="[^"]*">', '<link rel="canonical" href="https://valvoice.vercel.app/download.html">', html)
html = re.sub(r'<meta property="og:url" content="[^"]*">', '<meta property="og:url" content="https://valvoice.vercel.app/download.html">', html)
html = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="Download ValVoice | Valorant Text-to-Voice Game Chat Assistant">', html)

# The new content for <main>
download_content = '''<main>
<div class="container" style="padding-top: 120px; padding-bottom: 80px; min-height: 80vh;">
    <h1 style="font-size: 3rem; margin-bottom: 1rem; color: #fff;">Download ValVoice</h1>
    <p style="font-size: 1.2rem; color: rgba(255,255,255,0.8); margin-bottom: 3rem; max-width: 800px;">ValVoice is a Windows desktop application that converts Valorant in-game text chat into spoken voice using screen OCR and local text-to-speech.</p>
    
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 2rem; margin-bottom: 3rem;">
        <h2 style="font-size: 1.8rem; margin-bottom: 1.5rem; color: #ff4655;">Product Specifications</h2>
        <table style="width: 100%; border-collapse: collapse; color: rgba(255,255,255,0.9); font-size: 1.1rem;">
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 1rem 0; font-weight: 600; width: 30%;">Product</td>
                <td style="padding: 1rem 0;">ValVoice</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 1rem 0; font-weight: 600;">Type</td>
                <td style="padding: 1rem 0;">Windows desktop application</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 1rem 0; font-weight: 600;">Purpose</td>
                <td style="padding: 1rem 0;">Valorant text-chat-to-voice communication</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 1rem 0; font-weight: 600;">Input</td>
                <td style="padding: 1rem 0;">In-game text chat</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 1rem 0; font-weight: 600;">Detection</td>
                <td style="padding: 1rem 0;">Screen OCR</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 1rem 0; font-weight: 600;">Voice generation</td>
                <td style="padding: 1rem 0;">Text-to-speech</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 1rem 0; font-weight: 600;">Audio routing</td>
                <td style="padding: 1rem 0;">VB-CABLE</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 1rem 0; font-weight: 600;">Voice engine</td>
                <td style="padding: 1rem 0;">XTTS</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 1rem 0; font-weight: 600;">Voices</td>
                <td style="padding: 1rem 0;">30+</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 1rem 0; font-weight: 600;">Processing</td>
                <td style="padding: 1rem 0;">Local, where applicable</td>
            </tr>
            <tr>
                <td style="padding: 1rem 0; font-weight: 600;">Price</td>
                <td style="padding: 1rem 0;">Free (Early Access)</td>
            </tr>
        </table>
    </div>

    <a href="#" class="btn-val-primary" style="display: inline-block;">DOWNLOAD FOR WINDOWS</a>
    <p style="margin-top: 1rem; color: rgba(255,255,255,0.6); font-size: 0.9rem;">By downloading, you agree to our Terms of Service.</p>
</div>
</main>'''

pattern = r'(?s)<main>.*?</main>'
html = re.sub(pattern, download_content, html)

with open('download.html', 'w', encoding='utf-8') as f:
    f.write(html)
