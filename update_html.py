import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

new_steps = '''            <div class="steps">
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
            </div>'''

# Replace steps block
html = re.sub(r'            <div class="steps">.*?            </div>', new_steps, html, flags=re.DOTALL)

video_guides = '''    </section>

    <!-- Video Guides -->
    <section class="video-guides" id="video-guides" style="background: rgba(255,255,255,0.02); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 80px; padding-bottom: 80px;">
        <div class="container" style="max-width: 900px;">
            <div class="section-title reveal">
                <h2>Video Guides</h2>
                <p>Follow the installation and setup guides to get ValVoice running.</p>
            </div>
            
            <div class="features-grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
                <div class="feature-card reveal" style="text-align: center;">
                    <div class="feature-icon">
                        <i class="fab fa-youtube"></i>
                    </div>
                    <h3>Installation Guide</h3>
                    <p style="margin-bottom: 20px;">Install ValVoice from download to first launch.</p>
                    <a href="https://youtu.be/sB6JChWjnRE?si=GAAZB_zuDboeIRnQ" target="_blank" rel="noopener noreferrer" class="btn-val-primary" style="display: inline-block;">Watch Installation Guide &rarr;</a>
                </div>
                
                <div class="feature-card reveal" style="text-align: center;">
                    <div class="feature-icon">
                        <i class="fab fa-youtube"></i>
                    </div>
                    <h3>Setup Guide</h3>
                    <p style="margin-bottom: 20px;">Configure ValVoice and Valorant for voice chat.</p>
                    <a href="https://youtu.be/_U9fVLhjnaw?si=VVDTX0Qft6fwXUAZ" target="_blank" rel="noopener noreferrer" class="btn-val-primary" style="display: inline-block;">Watch Setup Guide &rarr;</a>
                </div>
            </div>
        </div>
    </section>'''

# Inject Video Guides
html = html.replace('    </section>\n\n    <!-- Testimonials -->', video_guides + '\n\n    <!-- Testimonials -->')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
