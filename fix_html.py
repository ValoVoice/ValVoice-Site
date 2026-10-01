import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# I want to replace the entire how-it-works section
# from <section class="how-it-works" id="how-it-works"> to its closing </section>
# But wait, there is also the Video Guides section right after it.
# Let's just use string replacement or clear regex.

new_how_it_works = '''    <section class="how-it-works" id="how-it-works">
        <div class="container">
            <div class="section-title reveal">
                <h2>How It Works</h2>
                <p>Get ValVoice running in four simple steps</p>
            </div>
            
            <div class="steps">
                <a href="https://youtu.be/sB6JChWjnRE?si=GAAZB_zuDboeIRnQ" target="_blank" rel="noopener noreferrer" class="step reveal clickable-step" aria-label="Watch the ValVoice Installation Guide">
                    <div class="step-number">1</div>
                    <h4>Download & Install ValVoice</h4>
                    <p>Download ValVoice from the website and complete the installation.</p>
                </a>
                
                <div class="step reveal">
                    <div class="step-number">2</div>
                    <h4>Install VB-CABLE</h4>
                    <p>Install the free VB-CABLE virtual audio driver so ValVoice can route voice into Valorant.</p>
                </div>
                
                <div class="step reveal">
                    <div class="step-number">3</div>
                    <h4>Launch ValVoice</h4>
                    <p>Open ValVoice and let it initialize before launching Valorant.</p>
                </div>

                <a href="https://youtu.be/_U9fVLhjnaw?si=VVDTX0Qft6fwXUAZ" target="_blank" rel="noopener noreferrer" class="step reveal clickable-step" aria-label="Watch the ValVoice Setup Guide">
                    <div class="step-number">4</div>
                    <h4>Configure Valorant & Play</h4>
                    <p>In Valorant, set Input Device to "CABLE Output," match your PTT key, and start playing.</p>
                </a>
            </div>
        </div>
    </section>'''

# Let's find the start of how-it-works and the start of video-guides
start_idx = html.find('<section class="how-it-works" id="how-it-works">')
end_idx = html.find('<!-- Video Guides -->')

if start_idx != -1 and end_idx != -1:
    html = html[:start_idx] + new_how_it_works + '\n\n    ' + html[end_idx:]
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("Replaced successfully")
else:
    print("Could not find sections")
