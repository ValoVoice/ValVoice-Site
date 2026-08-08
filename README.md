<div align="center">
  <img src="logo.png" alt="ValVoice Logo" width="180"/>
  <h1>🎙️ ValVoice: The Ultimate Game Chat Assistant</h1>
  <p><strong>Transform your Valorant experience with real-time text-to-voice conversion for in-game chat.</strong></p>
  
  [![Official Website](https://img.shields.io/badge/🌐_Official-Website-brightgreen.svg?style=for-the-badge)](https://valvoice.vercel.app/)
  [![Download ValVoice](https://img.shields.io/badge/⬇️_Download-ValVoice-blue.svg?style=for-the-badge)](https://valvoice.vercel.app/)
  [![Discord](https://img.shields.io/discord/1234567890?color=7289da&label=Discord&logo=discord&logoColor=white&style=for-the-badge)](https://discord.gg/nzHKWXU9TD)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](#)
</div>

<br/>

## 📖 What is ValVoice?

**ValVoice** is a revolutionary, 100% safe, and fully local accessibility and communication tool designed specifically for Valorant players. It acts as a bridge between players who prefer to type (text chat) and players who rely on voice comms. 

Whenever you type a message in Valorant's text chat (Party, Team, or All chat), ValVoice instantly reads the screen, processes the text, and synthesizes it into highly realistic spoken audio using an advanced local AI engine. This audio is then routed directly into your microphone input, allowing your teammates to hear your text messages as if you were speaking them aloud.

### Why use ValVoice?
- **Toxicity & Anxiety:** Communicate crucial game information without needing to speak on the microphone.
- **Accessibility:** Perfect for players who are non-verbal, have speech impediments, or play in noisy environments.
- **Immersion:** Sound exactly like your favorite Valorant agent using our AI voice cloning engine.

---

## 🎯 Key Features

- **⚡ Instant Text-to-Speech (TTS):** Millisecond-latency screen reading ensures your messages are broadcasted exactly when you hit enter.
- **🤖 Advanced AI Voice Cloning:** Powered by a customized Coqui XTTS v2 engine, providing access to over 30+ highly realistic, emotion-rich agent voices.
- **🛡️ 100% Anti-Cheat Safe (Vanguard Approved):** ValVoice uses pure Screen OCR (Optical Character Recognition). It **does not** inject into the game, read memory, intercept network packets, or modify game files.
- **🔒 Privacy First & Fully Local:** Your game chat and credentials never leave your PC. All AI processing happens completely offline on your local CPU/GPU.
- **🎛️ Smart Audio Routing:** Intelligently routes audio directly into the game via VB-CABLE, ensuring your desktop audio or game sounds don't echo into your mic.

---

## 🏗️ Technical Architecture

Understanding how ValVoice operates under the hood:

1. **OCR Pipeline (C# / .NET 8):** A highly optimized background sidecar (`ValVoiceOCR.exe`) continuously scans a designated anchor region of your screen using Windows Graphics Capture (WGC) and the native Windows OCR API.
2. **Backend Engine (Java 23 / JavaFX):** The core application that handles UI, filters chat, and manages game state tracking. It receives JSON payloads from the OCR pipeline.
3. **AI Synthesizer (Python / PyTorch):** A FastAPI server running Coqui XTTS v2 processes the filtered text and reference `.wav` files to synthesize realistic audio.
4. **Audio Router (Windows SAPI / VB-CABLE):** The synthesized audio is played specifically through a virtual audio cable, which Valorant recognizes as your microphone.

---

## 💻 About This Repository (ValVoice-Site)

This repository contains the source code for the **official ValVoice landing page and promotional website**. It is designed to convert visitors into users with a premium, sleek, and modern aesthetic that matches the gaming ecosystem.

### Tech Stack
- **HTML5:** Semantic structure and accessibility.
- **Vanilla CSS3:** Custom design system, glassmorphism UI, micro-animations, and responsive layouts.
- **Vanilla JavaScript:** Smooth scrolling, dynamic reveals, and mobile navigation.

### Local Development Setup

If you want to contribute to the website's design or content:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ValoVoice/ValVoice-Site.git
   cd ValVoice-Site
   ```
2. **Serve the site locally:**
   Since this is a static site, you can use any local web server. 
   - *Using Python:* `python -m http.server 8000`
   - *Using Node.js:* `npx serve .`
   - *Using VS Code:* Install the "Live Server" extension and click "Go Live".
3. **View the site:**
   Open your browser and navigate to `http://localhost:8000`.

---

## 🤝 Contributing to the Website

We welcome all contributions! Whether it's fixing a typo, improving SEO, or completely revamping a section with new CSS animations:

1. Fork this repository.
2. Create a new branch (`git checkout -b feature/AmazingDesign`).
3. Commit your changes (`git commit -m 'Add some AmazingDesign'`).
4. Push to the branch (`git push origin feature/AmazingDesign`).
5. Open a Pull Request.

---

<div align="center">
  <p><strong>Transform the way you communicate.</strong></p>
  <p>Built with ❤️ by the ValVoice Team.</p>
</div>
