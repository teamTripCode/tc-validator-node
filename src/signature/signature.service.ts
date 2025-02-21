import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SignatureService handles cryptographic operations such as key management,
 * signing messages, and verifying signatures.
 */
@Injectable()
export class SignatureService {
  private privateKey: string; // Private key used for signing messages
  private publicKey: string;  // Public key used for verifying signatures

  /**
   * Constructor initializes the service and loads cryptographic keys.
   */
  constructor() {
    this.loadKeys();
  }

  /**
   * Loads private and public keys from the /certs directory.
   * Throws an error if the keys are not found.
   */
  private loadKeys() {
    const privateKeyPath = path.join(process.cwd(), 'certs', 'private-key.pem');
    const publicKeyPath = path.join(process.cwd(), 'certs', 'public-key.pem');

    if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
      this.privateKey = fs.readFileSync(privateKeyPath, 'utf8');
      this.publicKey = fs.readFileSync(publicKeyPath, 'utf8');
    } else {
      throw new Error('Keys not found in /certs. Ensure they are generated using OpenSSL.');
    }
  }

  /**
   * Returns the public key of the node.
   * @returns The public key as a string.
   */
  getPublicKey(): string {
    return this.publicKey;
  }

  /**
   * Generates a unique address for the node by hashing its public key.
   * @returns The SHA-256 hash of the public key as a hexadecimal string.
   */
  getAddress(): string {
    return crypto.createHash('sha256').update(this.publicKey).digest('hex');
  }

  /**
   * Signs a message using the private key.
   * @param message - The message to sign.
   * @returns The signature as a hexadecimal string.
   */
  signMessage(message: string): string {
    const sign = crypto.createSign('SHA256'); // Create SHA-256 signer
    sign.update(message); // Add message to sign
    sign.end();
    return sign.sign(this.privateKey, 'hex');
  }

  /**
   * Verifies the signature of a message using the provided public key.
   * @param message - The original message.
   * @param signature - The signature to verify.
   * @param publicKey - The public key of the signer.
   * @returns True if the signature is valid, false otherwise.
   */
  verifySignature(message: string, signature: string, publicKey: string): boolean {
    const verify = crypto.createVerify('SHA256'); // Create SHA-256 verifier
    verify.update(message); // Add message to verify
    verify.end();
    return verify.verify(publicKey, signature, 'hex');
  }
}
