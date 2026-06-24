import { authenticator } from 'otplib';
import QRCode from 'qrcode';

// Configure authenticator
authenticator.options = {
  window: 1, // Allow 1 step before/after for clock drift
};

export function generateSecret(): string {
  return authenticator.generateSecret(20);
}

export async function generateQrUri(secret: string, email: string): Promise<string> {
  const appName = 'Habibazar';
  const otpAuthUrl = authenticator.keyuri(email, appName, secret);
  const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);
  return qrDataUrl;
}

export function verifyToken(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}
