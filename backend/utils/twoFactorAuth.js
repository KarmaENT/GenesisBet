const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

class TwoFactorAuth {
  /**
   * Generate a new 2FA secret for a user
   * @param {string} userEmail - User's email address
   * @param {string} serviceName - Name of the service (e.g., "GenesisBet")
   * @returns {Object} Secret and QR code data
   */
  static generateSecret(userEmail, serviceName = 'GenesisBet') {
    const secret = speakeasy.generateSecret({
      name: userEmail,
      issuer: serviceName,
      length: 32
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      qrCodeUrl: null // Will be generated separately
    };
  }

  /**
   * Generate QR code for 2FA setup
   * @param {string} otpauthUrl - OTP auth URL from generateSecret
   * @returns {Promise<string>} Base64 encoded QR code image
   */
  static async generateQRCode(otpauthUrl) {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      return qrCodeDataUrl;
    } catch (error) {
      throw new Error('Failed to generate QR code: ' + error.message);
    }
  }

  /**
   * Verify a 2FA token
   * @param {string} token - 6-digit token from authenticator app
   * @param {string} secret - User's 2FA secret
   * @param {number} window - Time window for token validation (default: 2)
   * @returns {boolean} True if token is valid
   */
  static verifyToken(token, secret, window = 2) {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: window
    });
  }

  /**
   * Generate backup codes for 2FA recovery
   * @param {number} count - Number of backup codes to generate (default: 10)
   * @returns {Array<string>} Array of backup codes
   */
  static generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Hash backup codes for secure storage
   * @param {Array<string>} codes - Array of backup codes
   * @returns {Array<string>} Array of hashed backup codes
   */
  static hashBackupCodes(codes) {
    return codes.map(code => 
      crypto.createHash('sha256').update(code).digest('hex')
    );
  }

  /**
   * Verify a backup code
   * @param {string} code - Backup code to verify
   * @param {Array<string>} hashedCodes - Array of hashed backup codes
   * @returns {boolean} True if code is valid
   */
  static verifyBackupCode(code, hashedCodes) {
    const hashedCode = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
    return hashedCodes.includes(hashedCode);
  }

  /**
   * Remove used backup code from the list
   * @param {string} code - Used backup code
   * @param {Array<string>} hashedCodes - Array of hashed backup codes
   * @returns {Array<string>} Updated array without the used code
   */
  static removeBackupCode(code, hashedCodes) {
    const hashedCode = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
    return hashedCodes.filter(hash => hash !== hashedCode);
  }
}

module.exports = TwoFactorAuth;

