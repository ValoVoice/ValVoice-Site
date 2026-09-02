import os
import re

files_to_fix = [
    ("about.html", "About ValVoice | ValVoice", "Learn about ValVoice, the Windows desktop application for converting Valorant text chat into spoken voice."),
    ("faq.html", "Frequently Asked Questions | ValVoice", "Answers to common questions about how ValVoice works, safety, and audio routing for Valorant."),
    ("privacy.html", "Privacy Policy | ValVoice", "Privacy policy for ValVoice. We process your data locally using OCR."),
    ("terms.html", "Terms of Service | ValVoice", "Terms of service for using the ValVoice application."),
    ("refund-policy.html", "Refund Policy | ValVoice", "Refund policy for ValVoice."),
    ("cookie-policy.html", "Cookie Policy | ValVoice", "Cookie policy for the ValVoice website."),
    ("docs/index.html", "Documentation | ValVoice", "Official documentation and guides for installing and configuring ValVoice for Valorant."),
    ("docs/installation.html", "Installation Guide | ValVoice", "Step-by-step guide on how to install ValVoice and set up VB-CABLE for Valorant.")
]

def fix_metadata(filepath, title, desc, url_path):
    if not os.path.exists(filepath):
        print(f"Skipping {filepath}, does not exist")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace Title
    content = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', content)
    
    # Replace Description
    content = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{desc}">', content)
    content = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{desc}">', content)
    content = re.sub(r'<meta property="twitter:description" content="[^"]*">', f'<meta property="twitter:description" content="{desc}">', content)
    
    # Replace OG Title
    content = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{title}">', content)
    content = re.sub(r'<meta property="twitter:title" content="[^"]*">', f'<meta property="twitter:title" content="{title}">', content)
    
    # Replace URLs
    full_url = f"https://valvoice.vercel.app/{url_path}"
    content = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{full_url}">', content)
    content = re.sub(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{full_url}">', content)
    content = re.sub(r'<meta property="twitter:url" content="[^"]*">', f'<meta property="twitter:url" content="{full_url}">', content)
    
    # Remove all structured data from these subpages to prevent entity dilution
    content = re.sub(r'<!-- Structured Data -->.*?</script>', '', content, flags=re.DOTALL)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Fixed {filepath}")

for filepath, title, desc in files_to_fix:
    url_path = filepath
    if filepath.endswith("index.html"):
        url_path = filepath[:-10]
    fix_metadata(filepath, title, desc, url_path)
