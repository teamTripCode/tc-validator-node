import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SignatureService {
  private privateKey: string;
  private publicKey: string;

  constructor() {
    this.loadKeys();
  }

  private loadKeys() {
    const privateKeyPath = path.join(process.cwd(), 'certs', 'private-key.pem');
    const publicKeyPath = path.join(process.cwd(), 'certs', 'public-key.pem');

    if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
      this.privateKey = fs.readFileSync(privateKeyPath, 'utf8');
      this.publicKey = fs.readFileSync(publicKeyPath, 'utf8');
    } else {
      throw new Error('Las claves no se encontraron en /certs. Asegúrate de generarlas con OpenSSL.');
    }
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  getAddress(): string {
    return crypto.createHash('sha256').update(this.publicKey).digest('hex');
  }

  signMessage(message: string): string {
    const sign = crypto.createSign('SHA256');
    sign.update(message);
    sign.end();
    return sign.sign(this.privateKey, 'hex');
  }

  verifySignature(message: string, signature: string, publicKey: string): boolean {
    const verify = crypto.createVerify('SHA256');
    verify.update(message);
    verify.end();
    return verify.verify(publicKey, signature, 'hex');
  }
}
