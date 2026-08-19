import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';

const IP = '192.168.1.105';
const publicDir = path.join(__dirname, '../../public');

async function generateAllQRCodes() {
  console.log(`Generating fresh QR codes for host IP: ${IP}...`);

  const links = [
    {
      name: 'Customer iPad / Mobile Ordering',
      url: `http://${IP}:3000/`,
      filename: 'qr_customer_menu.png',
      desc: 'Customer Self-Ordering iPad & Mobile Menu'
    },
    {
      name: 'Staff & Admin Management Portal',
      url: `http://${IP}:3000/admin`,
      filename: 'qr_admin_portal.png',
      desc: 'Staff Shift Clock-In & Executive Admin Dashboard'
    },
    {
      name: 'Expo Go Mobile App',
      url: `exp://${IP}:8081`,
      filename: 'app_qr.png',
      desc: 'Expo Go Native Mobile / iPad App'
    },
    {
      name: 'Payment Device Terminal',
      url: `http://${IP}:3000/payment-device`,
      filename: 'qr_payment_device.png',
      desc: 'Dedicated Card / Payment Terminal'
    },
    {
      name: 'Vite React Web App',
      url: `http://${IP}:5173/`,
      filename: 'qr_vite_app.png',
      desc: 'Standalone React Vite Web Application'
    }
  ];

  for (const item of links) {
    const filePath = path.join(publicDir, item.filename);
    await QRCode.toFile(filePath, item.url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    console.log(`✅ Generated: ${item.filename} -> ${item.url}`);
  }

  // Also build an all-in-one interactive QR Code Dashboard in public/qrs.html
  const hubHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Benzin — Live Services & QR Code Hub</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0B0806;
      --card: #16100D;
      --card2: #211814;
      --gold: #E5B13A;
      --orange: #FF5A1F;
      --cream: #F8F1EA;
      --muted: #948375;
      --line: #2E2018;
      --success: #22C55E;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--cream);
      font-family: 'Outfit', sans-serif;
      padding: 30px 20px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .header {
      text-align: center;
      max-width: 700px;
      margin-bottom: 36px;
    }
    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: rgba(229,177,58,0.12);
      border: 1px solid var(--gold);
      border-radius: 99px;
      color: var(--gold);
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    h1 {
      font-family: 'Playfair Display', serif;
      font-size: 36px;
      color: var(--cream);
      margin: 0 0 8px 0;
    }
    h1 span { color: var(--gold); }
    .subtitle {
      color: var(--muted);
      font-size: 15px;
      margin: 0;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 24px;
      width: 100%;
      max-width: 1180px;
    }
    .qr-card {
      background: var(--card);
      border: 1.5px solid var(--line);
      border-radius: 24px;
      padding: 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      position: relative;
      transition: all 0.25s ease;
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    }
    .qr-card:hover {
      transform: translateY(-4px);
      border-color: var(--gold);
      box-shadow: 0 20px 50px rgba(229,177,58,0.12);
    }
    .qr-badge {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 8px;
      margin-bottom: 12px;
      background: rgba(255,255,255,0.06);
      color: var(--muted);
    }
    .qr-card h2 {
      font-size: 20px;
      color: var(--cream);
      margin: 0 0 6px 0;
    }
    .qr-card p {
      font-size: 13px;
      color: var(--muted);
      margin: 0 0 20px 0;
      min-height: 38px;
    }
    .qr-wrapper {
      background: #FFFFFF;
      padding: 14px;
      border-radius: 18px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.6);
      margin-bottom: 20px;
      display: inline-block;
    }
    .qr-wrapper img {
      width: 220px;
      height: 220px;
      display: block;
    }
    .url-input-wrap {
      width: 100%;
      display: flex;
      gap: 8px;
      margin-top: auto;
    }
    .url-text {
      flex: 1;
      background: var(--card2);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
      color: var(--gold);
      font-size: 13px;
      font-weight: 700;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-decoration: none;
    }
    .url-text:hover {
      text-decoration: underline;
    }
    .btn {
      background: var(--gold);
      color: #000;
      border: none;
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.85; }
    .status-dot {
      width: 8px;
      height: 8px;
      background: var(--success);
      border-radius: 50%;
      display: inline-block;
      box-shadow: 0 0 8px var(--success);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand-badge">
      <span class="status-dot"></span> All Servers Active &amp; Online
    </div>
    <h1>Benzin <span>Live Access Hub</span></h1>
    <p class="subtitle">Scan QR codes directly with your iPad / iPhone camera or click links to open.</p>
  </div>

  <div class="grid">
    <!-- Card 1: Customer iPad Menu -->
    <div class="qr-card">
      <div class="qr-badge" style="background: rgba(34,197,94,0.15); color: var(--success); border: 1px solid var(--success);">🍽️ Table Ordering</div>
      <h2>Customer iPad / Mobile Menu</h2>
      <p>Self-service guest ordering interface with live cart, modifiers, and shisha builder.</p>
      <div class="qr-wrapper">
        <img src="/qr_customer_menu.png" alt="Customer Menu QR" />
      </div>
      <div class="url-input-wrap">
        <a href="http://${IP}:3000/" target="_blank" class="url-text">http://${IP}:3000/</a>
        <button class="btn" onclick="navigator.clipboard.writeText('http://${IP}:3000/'); alert('Copied link!');">Copy</button>
      </div>
    </div>

    <!-- Card 2: Staff & Admin Portal -->
    <div class="qr-card">
      <div class="qr-badge" style="background: rgba(229,177,58,0.15); color: var(--gold); border: 1px solid var(--gold);">⚡ Staff &amp; Management</div>
      <h2>Staff Shift Clock &amp; Admin Portal</h2>
      <p>8-digit fast floor login, live shift timer, KDS displays, devices, payroll &amp; analytics.</p>
      <div class="qr-wrapper">
        <img src="/qr_admin_portal.png" alt="Admin Portal QR" />
      </div>
      <div class="url-input-wrap">
        <a href="http://${IP}:3000/admin" target="_blank" class="url-text">http://${IP}:3000/admin</a>
        <button class="btn" onclick="navigator.clipboard.writeText('http://${IP}:3000/admin'); alert('Copied link!');">Copy</button>
      </div>
    </div>

    <!-- Card 3: Expo Mobile App -->
    <div class="qr-card">
      <div class="qr-badge" style="background: rgba(255,90,31,0.15); color: var(--orange); border: 1px solid var(--orange);">📱 Native App</div>
      <h2>Expo Go Mobile App (iOS / Android)</h2>
      <p>Scan with Camera (iOS) or Expo Go app (Android) to load native mobile interface.</p>
      <div class="qr-wrapper">
        <img src="/app_qr.png" alt="Expo App QR" />
      </div>
      <div class="url-input-wrap">
        <a href="exp://${IP}:8081" class="url-text">exp://${IP}:8081</a>
        <button class="btn" onclick="navigator.clipboard.writeText('exp://${IP}:8081'); alert('Copied link!');">Copy</button>
      </div>
    </div>

    <!-- Card 4: Payment Device Terminal -->
    <div class="qr-card">
      <div class="qr-badge" style="background: rgba(20,184,166,0.15); color: #14B8A6; border: 1px solid #14B8A6;">💳 Payment Terminal</div>
      <h2>Payment Terminal Screen</h2>
      <p>Dedicated payment hardware simulation screen for customer checkout &amp; tips.</p>
      <div class="qr-wrapper">
        <img src="/qr_payment_device.png" alt="Payment Device QR" />
      </div>
      <div class="url-input-wrap">
        <a href="http://${IP}:3000/payment-device" target="_blank" class="url-text">http://${IP}:3000/payment-device</a>
        <button class="btn" onclick="navigator.clipboard.writeText('http://${IP}:3000/payment-device'); alert('Copied link!');">Copy</button>
      </div>
    </div>

    <!-- Card 5: Vite React Web App -->
    <div class="qr-card">
      <div class="qr-badge" style="background: rgba(168,85,247,0.15); color: #A855F7; border: 1px solid #A855F7;">⚛️ React Vite App</div>
      <h2>Standalone Vite Web App</h2>
      <p>Vite development client with hot module reloading on port 5173.</p>
      <div class="qr-wrapper">
        <img src="/qr_vite_app.png" alt="Vite App QR" />
      </div>
      <div class="url-input-wrap">
        <a href="http://${IP}:5173/" target="_blank" class="url-text">http://${IP}:5173/</a>
        <button class="btn" onclick="navigator.clipboard.writeText('http://${IP}:5173/'); alert('Copied link!');">Copy</button>
      </div>
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(publicDir, 'qrs.html'), hubHtml);
  fs.writeFileSync(path.join(publicDir, 'app_qr.html'), hubHtml);
  console.log(`✅ Generated live QR Code Hub: public/qrs.html & public/app_qr.html`);
}

generateAllQRCodes().catch(err => {
  console.error('QR generation failed:', err);
});
