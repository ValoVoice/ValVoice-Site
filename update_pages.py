import re

def update_content(filepath, new_content):
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()
    
    # Replace everything inside the container div inside main
    pattern = r'(<div class="container"[^>]*>).*?(</div>\s*</main>)'
    replacement = r'\1' + new_content + r'\2'
    
    new_html = re.sub(pattern, replacement, html, flags=re.DOTALL)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_html)

faq_content = '''
<h1 style="font-size: 3rem; margin-bottom: 2rem; color: #fff;">Frequently Asked Questions</h1>
<div style="color: rgba(255,255,255,0.8); line-height: 1.8; font-size: 1.1rem; margin-bottom: 2rem;">
    <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">What is ValVoice?</h3>
    <p style="margin-bottom: 1rem;">ValVoice is a Windows desktop application that converts Valorant in-game text chat into spoken voice using screen OCR and text-to-speech.</p>
    <p style="margin-bottom: 2rem;">It is designed for players who prefer typing, cannot use a microphone, or simply want hands-free awareness of team chat without looking away from the crosshair.</p>

    <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">How does ValVoice work?</h3>
    <p style="margin-bottom: 1rem;">ValVoice reads visible Valorant text chat using screen OCR, converts detected messages into speech, and routes the generated audio through a virtual audio device.</p>
    <p style="margin-bottom: 2rem;">The speech output is piped into a virtual audio cable (VB-CABLE), which Valorant is configured to use as its microphone input. This allows your teammates to hear the AI-generated voice in real time.</p>

    <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">Is ValVoice safe to use with Valorant?</h3>
    <p style="margin-bottom: 1rem;">Yes, ValVoice is completely safe to use. It operates entirely locally using screen OCR to read chat.</p>
    <p style="margin-bottom: 2rem;">It does not touch game files, does not inject anything into the Valorant client, and operates as an external accessibility tool, making it a safe, non-invasive method.</p>

    <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">Does ValVoice use a local AI voice engine?</h3>
    <p style="margin-bottom: 1rem;">Yes. ValVoice runs a powerful AI voice engine (XTTS) locally on your PC to provide realistic voices.</p>
    <p style="margin-bottom: 2rem;">By running locally, no chat logs or data are sent to the cloud, ensuring your privacy and achieving zero network latency for voice generation.</p>
</div>
'''

install_content = '''
<h1 style="font-size: 3rem; margin-bottom: 2rem; color: #fff;">Installation Guide</h1>
<div style="color: rgba(255,255,255,0.8); line-height: 1.8; font-size: 1.1rem; margin-bottom: 2rem;">
    <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">How do I install ValVoice?</h3>
    <p style="margin-bottom: 1rem;">Installing ValVoice requires downloading the Windows application and setting up a virtual audio cable.</p>
    <p style="margin-bottom: 1rem;">Follow these steps to complete the installation:</p>
    <ol style="margin-left: 2rem; margin-bottom: 2rem;">
        <li style="margin-bottom: 0.5rem;">Download the ValVoice installer for Windows from the <a href="/download.html" style="color: #ff4655;">official download page</a>.</li>
        <li style="margin-bottom: 0.5rem;">Run the installer and follow the on-screen prompts.</li>
        <li style="margin-bottom: 0.5rem;">Install the free VB-CABLE virtual audio device.</li>
        <li style="margin-bottom: 0.5rem;">Configure your Valorant Voice Chat Input Device to use "CABLE Output".</li>
    </ol>
</div>
'''

update_content('faq.html', faq_content)
update_content('docs/installation.html', install_content)
