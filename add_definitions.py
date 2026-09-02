import re

with open('faq.html', 'r', encoding='utf-8') as f:
    content = f.read()

definitions = '''
        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">What is screen OCR?</h3>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1rem; line-height: 1.6;">Screen OCR (Optical Character Recognition) is a technology that recognizes text visible on the screen and extracts it into digital text.</p>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 2rem; line-height: 1.6;">ValVoice uses this to safely read chat without touching the game files.</p>

        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.5rem;">What is Valorant text-to-voice?</h3>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 1rem; line-height: 1.6;">Valorant text-to-voice refers to the process of instantly converting in-game text messages typed by players into spoken audio, allowing teammates to hear the chat rather than reading it.</p>
        <p style="font-size: 1.1rem; color: rgba(255,255,255,0.8); margin-bottom: 2rem; line-height: 1.6;">ValVoice performs this automatically during gameplay.</p>
'''

# Find the spot right after "Does ValVoice work on Windows?" section
pattern = r'(Does ValVoice work on Windows\?</h3\>.*?)(<h3)'
replacement = r'\1' + definitions + r'\2'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('faq.html', 'w', encoding='utf-8') as f:
    f.write(content)
