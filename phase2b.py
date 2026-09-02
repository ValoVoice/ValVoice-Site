import os
import re

def create_or_update_page(filepath, title, desc, canonical, main_content):
    # Base layout from index.html
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # Replace Metadata
    html = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', html)
    html = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{desc}">', html)
    html = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{canonical}">', html)
    html = re.sub(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{canonical}">', html)
    html = re.sub(r'<meta property="twitter:url" content="[^"]*">', f'<meta property="twitter:url" content="{canonical}">', html)
    html = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{title}">', html)
    html = re.sub(r'<meta property="twitter:title" content="[^"]*">', f'<meta property="twitter:title" content="{title}">', html)
    
    # Strip SoftwareApplication from all except download/index
    if filepath != 'download.html' and filepath != 'index.html':
        html = re.sub(r'<!-- Structured Data -->.*?</script>', '', html, flags=re.DOTALL)

    # Insert Main Content
    pattern = r'(?s)<main>.*?</main>'
    html = re.sub(pattern, main_content, html)

    os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else '.', exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"Generated {filepath}")

# 1. DOWNLOAD PAGE
download_content = '''<main>
<div class="container" style="padding-top: 120px; padding-bottom: 80px; min-height: 80vh;">
    <h1 style="font-size: 3rem; margin-bottom: 1rem; color: #fff;">Download ValVoice</h1>
    
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 2rem; margin-bottom: 3rem;">
        <h2 style="font-size: 1.8rem; margin-bottom: 1rem; color: #fff;">What is ValVoice?</h2>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1rem; line-height: 1.6;">ValVoice is a Windows desktop application that converts Valorant in-game text chat into spoken voice. It uses screen OCR to recognize chat text and local text-to-speech to turn that text into audio.</p>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1.5rem; line-height: 1.6;">ValVoice is designed specifically for Valorant players who want to hear in-game text chat as spoken audio rather than relying entirely on reading the chat manually.</p>
        
        <h3 style="font-size: 1.4rem; margin-bottom: 1rem; color: #ff4655;">Key Takeaways</h3>
        <ul style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1rem; line-height: 1.6; margin-left: 1.5rem;">
            <li>ValVoice runs as a Windows desktop application.</li>
            <li>It reads Valorant text chat using screen OCR.</li>
            <li>Recognized text is converted into spoken audio using local text-to-speech.</li>
            <li>Audio routing can be configured using a virtual audio device such as VB-CABLE.</li>
        </ul>
    </div>

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
                <td style="padding: 1rem 0;">ValVoice converts Valorant in-game text chat into spoken voice.</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 1rem 0; font-weight: 600;">Input</td>
                <td style="padding: 1rem 0;">The application reads visible in-game text chat using screen OCR.</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 1rem 0; font-weight: 600;">Processing</td>
                <td style="padding: 1rem 0;">The recognized text is converted into speech using local text-to-speech.</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 1rem 0; font-weight: 600;">Audio Routing</td>
                <td style="padding: 1rem 0;">The generated speech can be routed through the configured virtual audio setup.</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 1rem 0; font-weight: 600;">Voice Engine</td>
                <td style="padding: 1rem 0;">ValVoice uses a local XTTS-based voice engine.</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 1rem 0; font-weight: 600;">Platform</td>
                <td style="padding: 1rem 0;">Windows</td>
            </tr>
            <tr>
                <td style="padding: 1rem 0; font-weight: 600;">Price</td>
                <td style="padding: 1rem 0;">Free / Early Access</td>
            </tr>
        </table>
    </div>

    <a href="#" class="btn-val-primary" style="display: inline-block;">DOWNLOAD FOR WINDOWS</a>
    <p style="margin-top: 1rem; color: rgba(255,255,255,0.6); font-size: 0.9rem;">By downloading, you agree to our <a href="/terms.html" style="color: #ff4655;">Terms of Service</a>.</p>
</div>
</main>'''

create_or_update_page('download.html', 'Download ValVoice | Valorant Text-to-Voice Game Chat Assistant', 'Download ValVoice, the Windows desktop application that converts Valorant text chat into spoken voice using OCR.', 'https://valvoice.vercel.app/download.html', download_content)

# 2. FAQ PAGE
faq_content = '''<main>
<div class="container" style="padding-top: 120px; padding-bottom: 80px; min-height: 80vh;">
    <h1 style="font-size: 3rem; margin-bottom: 2rem; color: #fff;">Frequently Asked Questions</h1>
    
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 2rem; margin-bottom: 3rem;">
        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">What is ValVoice?</h3>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1rem; line-height: 1.6;">ValVoice is a Windows desktop application that converts Valorant in-game text chat into spoken voice.</p>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 2rem; line-height: 1.6;">It uses screen OCR to recognize chat text and local text-to-speech to turn that text into audio, helping players communicate without reading chat manually.</p>

        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">How does ValVoice convert Valorant text chat into voice?</h3>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1rem; line-height: 1.6;">ValVoice reads visible Valorant text chat using screen OCR and converts the detected messages into speech.</p>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 2rem; line-height: 1.6;">The speech is generated locally and can be piped into a virtual audio cable, which Valorant uses as its microphone input. Your teammates hear the AI voice in real time.</p>

        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">Does ValVoice work on Windows?</h3>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1rem; line-height: 1.6;">Yes, ValVoice is exclusively a Windows desktop application.</p>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 2rem; line-height: 1.6;">Because Valorant is a Windows game, the software runs locally alongside the client.</p>

        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">Does ValVoice read Valorant text chat using OCR?</h3>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1rem; line-height: 1.6;">Yes, ValVoice strictly uses screen OCR to read chat.</p>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 2rem; line-height: 1.6;">It does not inject into game files or memory, making it a safe external accessibility tool.</p>

        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">Is ValVoice safe to use with Valorant?</h3>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1rem; line-height: 1.6;">Yes, ValVoice is safe to use as it relies entirely on local visual recognition.</p>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 2rem; line-height: 1.6;">Because it does not modify the Valorant client or its memory space, it operates safely alongside Vanguard.</p>

        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">What is VB-CABLE used for?</h3>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1rem; line-height: 1.6;">VB-CABLE is a virtual audio device used to route ValVoice's speech output directly into Valorant's microphone input.</p>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 2rem; line-height: 1.6;">It acts as a bridge, tricking the game into accepting the synthesized voice as your actual microphone.</p>
    </div>
</div>
</main>'''

create_or_update_page('faq.html', 'Frequently Asked Questions | ValVoice', 'Answers to common questions about how ValVoice works, safety, and audio routing for Valorant.', 'https://valvoice.vercel.app/faq.html', faq_content)

# 3. VB-CABLE SETUP PAGE
vbcable_content = '''<main>
<div class="container" style="padding-top: 120px; padding-bottom: 80px; min-height: 80vh;">
    <h1 style="font-size: 3rem; margin-bottom: 1rem; color: #fff;">VB-CABLE Setup Guide</h1>
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 2rem; margin-bottom: 3rem;">
        
        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">What is VB-CABLE?</h3>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1.5rem; line-height: 1.6;">VB-CABLE is a virtual audio device for routing audio between applications. It functions as a virtual hardware cable; any audio sent to the CABLE Input can be recorded from the CABLE Output.</p>
        
        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">Why does ValVoice use it?</h3>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1.5rem; line-height: 1.6;">ValVoice uses VB-CABLE to pipe the locally generated text-to-speech audio directly into Valorant without requiring a physical microphone. Valorant simply listens to the CABLE Output as if it were a real microphone.</p>
        
        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">How to set it up</h3>
        <ol style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1.5rem; line-height: 1.6; margin-left: 1.5rem;">
            <li>Download VB-CABLE from the <a href="https://vb-audio.com/Cable/" target="_blank" rel="noopener noreferrer" style="color: #ff4655;">official VB-Audio website</a>.</li>
            <li>Extract the downloaded ZIP file.</li>
            <li>Run the Setup program (e.g., VBCABLE_Setup_x64.exe) as Administrator.</li>
            <li>Click "Install Driver" and reboot your PC if prompted.</li>
            <li>Open ValVoice and ensure the audio output device is set to "CABLE Input".</li>
            <li>Open Valorant and set your Voice Chat input device to "CABLE Output".</li>
        </ol>

        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">Common problems</h3>
        <ul style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1.5rem; line-height: 1.6; margin-left: 1.5rem;">
            <li><strong>No sound in-game:</strong> Verify that Valorant is explicitly using "CABLE Output" and not "Default System Device".</li>
            <li><strong>Installation failed:</strong> Ensure you right-clicked the installer and selected "Run as Administrator".</li>
        </ul>

        <h3 style="color: #ff4655; margin-bottom: 0.5rem; font-size: 1.4rem;">Key Takeaways</h3>
        <ul style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1rem; line-height: 1.6; margin-left: 1.5rem;">
            <li>VB-CABLE routes audio from ValVoice to Valorant.</li>
            <li>It must be installed as Administrator.</li>
            <li>ValVoice outputs to "CABLE Input".</li>
            <li>Valorant listens to "CABLE Output".</li>
        </ul>
    </div>
</div>
</main>'''

create_or_update_page('docs/vb-cable-setup.html', 'VB-CABLE Setup Guide | ValVoice', 'Learn how to install and configure VB-CABLE to route ValVoice text-to-speech audio directly into Valorant.', 'https://valvoice.vercel.app/docs/vb-cable-setup.html', vbcable_content)

# 4. VALORANT AUDIO SETTINGS PAGE
audio_settings_content = '''<main>
<div class="container" style="padding-top: 120px; padding-bottom: 80px; min-height: 80vh;">
    <h1 style="font-size: 3rem; margin-bottom: 1rem; color: #fff;">Valorant Audio Settings</h1>
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 2rem; margin-bottom: 3rem;">
        
        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">How to configure Valorant audio for ValVoice</h3>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1.5rem; line-height: 1.6;">Once ValVoice and <a href="/docs/vb-cable-setup.html" style="color: #ff4655;">VB-CABLE</a> are installed, you must tell the Valorant game client to listen to the virtual audio cable instead of your physical microphone.</p>
        
        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">How to set it up</h3>
        <ol style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1.5rem; line-height: 1.6; margin-left: 1.5rem;">
            <li>Launch Valorant and open the Settings menu.</li>
            <li>Navigate to the <strong>Audio</strong> tab, then click on <strong>Voice Chat</strong>.</li>
            <li>Find the <strong>Input Device</strong> dropdown.</li>
            <li>Change the Input Device from "Default" to <strong>CABLE Output (VB-Audio Virtual Cable)</strong>.</li>
            <li>Leave your <strong>Output Device</strong> as your normal headphones/speakers so you can still hear the game.</li>
        </ol>

        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">Common configuration mistakes</h3>
        <ul style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1.5rem; line-height: 1.6; margin-left: 1.5rem;">
            <li><strong>Setting the game Output Device to CABLE:</strong> This will route game audio into your microphone. Always keep the Output Device set to your headphones.</li>
            <li><strong>Using Push-To-Talk:</strong> If Valorant requires push-to-talk, teammates won't hear ValVoice unless the key is held. Consider switching to Voice Activity, or holding your PTT key when ValVoice is speaking.</li>
        </ul>

        <h3 style="color: #ff4655; margin-bottom: 0.5rem; font-size: 1.4rem;">Key Takeaways</h3>
        <ul style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1rem; line-height: 1.6; margin-left: 1.5rem;">
            <li>Valorant Input Device must be "CABLE Output".</li>
            <li>Valorant Output Device must remain your normal headphones.</li>
            <li>Push-to-Talk settings may interrupt ValVoice playback if not managed correctly.</li>
        </ul>
    </div>
</div>
</main>'''

create_or_update_page('docs/valorant-audio-settings.html', 'Valorant Audio Settings | ValVoice', 'Learn how to configure Valorant in-game audio settings to work seamlessly with ValVoice and VB-CABLE.', 'https://valvoice.vercel.app/docs/valorant-audio-settings.html', audio_settings_content)

# 5. TROUBLESHOOTING PAGE
troubleshooting_content = '''<main>
<div class="container" style="padding-top: 120px; padding-bottom: 80px; min-height: 80vh;">
    <h1 style="font-size: 3rem; margin-bottom: 1rem; color: #fff;">Troubleshooting</h1>
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 2rem; margin-bottom: 3rem;">
        
        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">Valorant chat not being detected (OCR issues)</h3>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1.5rem; line-height: 1.6;">ValVoice uses screen OCR to read the chat. If it is not detecting text: ensure Valorant is running in Windowed Fullscreen or Fullscreen mode at a standard aspect ratio. Make sure the chat box is visible and not obscured by overlays.</p>
        
        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">No voice output in game</h3>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1.5rem; line-height: 1.6;">If the app detects the text but teammates hear nothing, verify your <a href="/docs/valorant-audio-settings.html" style="color: #ff4655;">Valorant audio settings</a>. Ensure the Input Device is set to "CABLE Output".</p>
        
        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">Voice engine not responding</h3>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1.5rem; line-height: 1.6;">The local XTTS engine requires resources. On first launch, it may take 60-90 seconds to load the models into memory. Please wait during the initial startup sequence.</p>

        <h3 style="color: #ff4655; margin-bottom: 0.5rem; font-size: 1.4rem;">Key Takeaways</h3>
        <ul style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1rem; line-height: 1.6; margin-left: 1.5rem;">
            <li>Screen OCR requires the chat box to be clearly visible on screen.</li>
            <li>Audio routing failures are usually resolved by verifying the VB-CABLE selection in Valorant settings.</li>
            <li>The local voice engine takes time to initialize on startup.</li>
        </ul>
    </div>
</div>
</main>'''

create_or_update_page('docs/troubleshooting.html', 'Troubleshooting | ValVoice', 'Fix common issues with ValVoice, including OCR detection failures, audio routing issues, and voice engine initialization.', 'https://valvoice.vercel.app/docs/troubleshooting.html', troubleshooting_content)

# Update internal links in ALL files
htmlFiles = []
for root, _, files in os.walk('.'):
    for f in files:
        if f.endswith('.html'):
            htmlFiles.append(os.path.join(root, f))

for file in htmlFiles:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Example updating footer or nav links to point to the new pages properly
    # Ensure they are linking to /docs/vb-cable-setup.html
    # This was partly handled in previous steps, but we can ensure Docs index links are correct
    if file.endswith('docs\\index.html') or file.endswith('docs/index.html'):
        docs_nav = '''<h1 style="font-size: 3rem; margin-bottom: 2rem; color: #fff;">ValVoice Documentation</h1>
<ul style="font-size: 1.2rem; color: #ff4655; line-height: 2;">
    <li><a href="/docs/installation.html" style="color: #ff4655;">Installation Guide</a></li>
    <li><a href="/docs/vb-cable-setup.html" style="color: #ff4655;">VB-CABLE Setup Guide</a></li>
    <li><a href="/docs/valorant-audio-settings.html" style="color: #ff4655;">Valorant Audio Settings</a></li>
    <li><a href="/docs/troubleshooting.html" style="color: #ff4655;">Troubleshooting</a></li>
</ul>'''
        content = re.sub(r'(?s)<main>.*?</main>', f'<main><div class="container" style="padding-top: 120px; padding-bottom: 80px; min-height: 80vh;">{docs_nav}</div></main>', content)
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)

# Update sitemap
sitemap_content = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
   <url><loc>https://valvoice.vercel.app/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
   <url><loc>https://valvoice.vercel.app/download.html</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
   <url><loc>https://valvoice.vercel.app/about.html</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
   <url><loc>https://valvoice.vercel.app/faq.html</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
   <url><loc>https://valvoice.vercel.app/privacy.html</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>
   <url><loc>https://valvoice.vercel.app/terms.html</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>
   <url><loc>https://valvoice.vercel.app/refund-policy.html</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>
   <url><loc>https://valvoice.vercel.app/cookie-policy.html</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>
   <url><loc>https://valvoice.vercel.app/docs/index.html</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
   <url><loc>https://valvoice.vercel.app/docs/installation.html</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
   <url><loc>https://valvoice.vercel.app/docs/vb-cable-setup.html</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
   <url><loc>https://valvoice.vercel.app/docs/valorant-audio-settings.html</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
   <url><loc>https://valvoice.vercel.app/docs/troubleshooting.html</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
</urlset>'''

with open('sitemap.xml', 'w', encoding='utf-8') as f:
    f.write(sitemap_content)
print("Updated sitemap")
