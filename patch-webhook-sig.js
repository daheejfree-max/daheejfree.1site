import fs from 'fs';

let serverCode = fs.readFileSync('server.ts', 'utf8');

const regex = /\/\/ Verify X-Signature-V2 or X-Signature[\s\S]*?\/\/ Return 2xx ASAP/g;

const replacement = `// Verify X-Signature (Raw Bytes)
      if (!isValid && signatureV1) {
        const expectedSig = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawBody)
          .digest('hex');
        if (signatureV1.length === expectedSig.length) {
          isValid = crypto.timingSafeEqual(Buffer.from(signatureV1 as string), Buffer.from(expectedSig));
        }
      }

      // Verify X-Signature-V2 (If raw body happens to be canonical)
      if (!isValid && signatureV2) {
        const expectedSig = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawBody)
          .digest('hex');
        if (signatureV2.length === expectedSig.length) {
          isValid = crypto.timingSafeEqual(Buffer.from(signatureV2 as string), Buffer.from(expectedSig));
        }
      }
      
      // Fallback to X-Signature-Simple
      if (!isValid && signatureSimple && timestampHeader) {
        const payload = req.body || {};
        const sessionId = payload.session_id || payload.id || '';
        const status = payload.status || '';
        const webhookType = payload.webhook_type || '';
        
        const dataToSign = \`\${timestampHeader}:\${sessionId}:\${status}:\${webhookType}\`;
        const expectedSig = crypto
          .createHmac('sha256', webhookSecret)
          .update(dataToSign)
          .digest('hex');
          
        if (signatureSimple.length === expectedSig.length) {
          isValid = crypto.timingSafeEqual(Buffer.from(signatureSimple as string), Buffer.from(expectedSig));
        }
      }

      if (!isValid && (signatureV1 || signatureV2 || signatureSimple)) {
        console.warn('[Didit Webhook] Signature mismatch. Raw body:', rawBody);
        return res.status(401).json({ error: 'Invalid signature' });
      } else if (!isValid) {
         console.warn('[Didit Webhook] No signature headers found');
         return res.status(401).json({ error: 'Missing signature headers' });
      }
    }

    // Return 2xx ASAP`;

if (!serverCode.match(regex)) {
  console.error("Could not find signature block");
  process.exit(1);
}

serverCode = serverCode.replace(regex, replacement);
fs.writeFileSync('server.ts', serverCode);
console.log("Successfully patched signature block");
