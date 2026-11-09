// Generates reliable portrait reference photos for biometric testing
export function createSyntheticPortrait(
  name: string,
  role: string,
  gender: 'm' | 'f',
  skinTone: string,
  hairColor: string,
  hasGlasses: boolean = false
): string {
  // If in browser with canvas support, generate canvas JPEG
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 380;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Background - Clean ID photo backdrop (maritime neutral navy/slate)
        const bgGrad = ctx.createLinearGradient(0, 0, 0, 380);
        bgGrad.addColorStop(0, '#1e293b');
        bgGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 320, 380);

        // Soft studio light behind head
        const radial = ctx.createRadialGradient(160, 160, 20, 160, 160, 140);
        radial.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
        radial.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = radial;
        ctx.fillRect(0, 0, 320, 380);

        // Shoulders & Uniform
        ctx.fillStyle = '#1e3a8a'; // Navy maritime uniform
        ctx.beginPath();
        ctx.moveTo(40, 380);
        ctx.lineTo(280, 380);
        ctx.lineTo(270, 290);
        ctx.quadraticCurveTo(160, 275, 50, 290);
        ctx.closePath();
        ctx.fill();

        // Uniform Collar & Gold Trim
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(100, 305, 120, 4);
        ctx.fillRect(110, 315, 100, 3);

        // White inner shirt collar
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(135, 280);
        ctx.lineTo(160, 310);
        ctx.lineTo(185, 280);
        ctx.closePath();
        ctx.fill();

        // Neck
        ctx.fillStyle = skinTone;
        ctx.fillRect(135, 220, 50, 70);

        // Head/Face shape
        ctx.beginPath();
        ctx.ellipse(160, 160, 65, 80, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ears
        ctx.beginPath();
        ctx.ellipse(92, 160, 10, 18, 0, 0, Math.PI * 2);
        ctx.ellipse(228, 160, 10, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hair
        ctx.fillStyle = hairColor;
        if (gender === 'f') {
          ctx.beginPath();
          ctx.arc(160, 140, 72, Math.PI * 0.8, Math.PI * 0.2, false);
          ctx.lineTo(240, 240);
          ctx.lineTo(220, 240);
          ctx.lineTo(215, 170);
          ctx.lineTo(105, 170);
          ctx.lineTo(100, 240);
          ctx.lineTo(80, 240);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(160, 135, 68, Math.PI, Math.PI * 2, false);
          ctx.lineTo(230, 165);
          ctx.quadraticCurveTo(160, 120, 90, 165);
          ctx.closePath();
          ctx.fill();
        }

        // Eyebrows
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(120, 135, 30, 4);
        ctx.fillRect(170, 135, 30, 4);

        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(135, 150, 10, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(185, 150, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Iris
        ctx.fillStyle = '#292524';
        ctx.beginPath();
        ctx.arc(135, 150, 4.5, 0, Math.PI * 2);
        ctx.arc(185, 150, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(160, 145);
        ctx.lineTo(158, 180);
        ctx.lineTo(168, 183);
        ctx.stroke();

        // Mouth
        ctx.strokeStyle = '#991b1b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(160, 198, 14, 0.15, Math.PI - 0.15);
        ctx.stroke();

        // Optional glasses
        if (hasGlasses) {
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 3;
          ctx.strokeRect(118, 140, 34, 22);
          ctx.strokeRect(168, 140, 34, 22);
          ctx.beginPath();
          ctx.moveTo(152, 148);
          ctx.lineTo(168, 148);
          ctx.stroke();
        }

        // ID overlay watermark badge at bottom
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(0, 340, 320, 40);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${name.toUpperCase()} - ${role.toUpperCase()}`, 160, 365);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        if (dataUrl && dataUrl.startsWith('data:image')) return dataUrl;
      }
    } catch (e) {
      console.warn('Canvas portrait generation warning:', e);
    }
  }

  // Guaranteed fallback SVG Data URI
  const glassesSvg = hasGlasses
    ? `<rect x="118" y="140" width="34" height="22" stroke="#0284c7" stroke-width="3" fill="none" rx="4"/>
       <rect x="168" y="140" width="34" height="22" stroke="#0284c7" stroke-width="3" fill="none" rx="4"/>
       <line x1="152" y1="148" x2="168" y2="148" stroke="#0284c7" stroke-width="3"/>`
    : '';

  const hairSvg =
    gender === 'f'
      ? `<path d="M100 240 L105 170 Q160 110 215 170 L220 240" fill="${hairColor}" stroke="${hairColor}" stroke-width="12"/>`
      : `<path d="M92 160 Q160 110 228 160 L230 150 Q160 115 90 150 Z" fill="${hairColor}"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="380" viewBox="0 0 320 380">
    <rect width="320" height="380" fill="#1e293b"/>
    <circle cx="160" cy="160" r="100" fill="#0f172a"/>
    <path d="M40 380 L280 380 L270 290 Q160 275 50 290 Z" fill="#1e3a8a"/>
    <rect x="100" y="305" width="120" height="4" fill="#f59e0b"/>
    <polygon points="135,280 160,310 185,280" fill="#ffffff"/>
    <rect x="135" y="220" width="50" height="70" fill="${skinTone}"/>
    <ellipse cx="160" cy="160" rx="65" ry="80" fill="${skinTone}"/>
    ${hairSvg}
    <ellipse cx="135" cy="150" rx="9" ry="6" fill="#ffffff"/>
    <circle cx="135" cy="150" r="4" fill="#292524"/>
    <ellipse cx="185" cy="150" rx="9" ry="6" fill="#ffffff"/>
    <circle cx="185" cy="150" r="4" fill="#292524"/>
    <path d="M160 145 L158 180 L168 183" stroke="rgba(0,0,0,0.3)" stroke-width="3" fill="none"/>
    <path d="M148 198 Q160 210 172 198" stroke="#991b1b" stroke-width="3" fill="none"/>
    ${glassesSvg}
    <rect x="0" y="340" width="320" height="40" fill="rgba(15,23,42,0.9)"/>
    <text x="160" y="365" font-family="sans-serif" font-size="12" font-weight="bold" fill="#e2e8f0" text-anchor="middle">${name.toUpperCase()} - ${role.toUpperCase()}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${typeof btoa === 'function' ? btoa(svg) : Buffer.from(svg).toString('base64')}`;
}
