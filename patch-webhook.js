import fs from 'fs';
import crypto from 'crypto';

let serverCode = fs.readFileSync('server.ts', 'utf8');

const webhookStart = "app.post(['/api/kyc/webhook', '/api/webhooks/didit'], async (req, res) => {";
const webhookEndMarker = "});\n\n// ==============================================================================";

const startIndex = serverCode.indexOf(webhookStart);
if (startIndex === -1) {
  console.error("Could not find webhook start");
  process.exit(1);
}

const endIndex = serverCode.indexOf(webhookEndMarker, startIndex);
if (endIndex === -1) {
  console.error("Could not find webhook end");
  process.exit(1);
}

const before = serverCode.substring(0, startIndex);
const after = serverCode.substring(endIndex + webhookEndMarker.length);

const newWebhook = `app.post(['/api/kyc/webhook', '/api/webhooks/didit'], async (req: any, res) => {
  try {
    const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET;
    
    // 1. Signature Verification
    if (webhookSecret) {
      const timestampHeader = req.headers['x-timestamp'];
      const signatureV2 = req.headers['x-signature-v2'];
      const signatureV1 = req.headers['x-signature'];
      const signatureSimple = req.headers['x-signature-simple'];

      // Validate timestamp is fresh (within 5 minutes)
      if (timestampHeader) {
        const timestamp = parseInt(timestampHeader as string, 10);
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - timestamp) > 300) {
          console.warn('[Didit Webhook] Stale timestamp:', timestampHeader);
          return res.status(400).json({ error: 'Stale timestamp' });
        }
      }

      let isValid = false;
      
      const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);

      // Verify X-Signature-V2 or X-Signature
      if (signatureV2 || signatureV1) {
        const sigToVerify = signatureV2 || signatureV1;
        const expectedSig = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawBody)
          .digest('hex');
          
        if (sigToVerify && sigToVerify.length === expectedSig.length) {
          isValid = crypto.timingSafeEqual(Buffer.from(sigToVerify as string), Buffer.from(expectedSig));
        }
      } 
      // Fallback to X-Signature-Simple
      else if (signatureSimple && timestampHeader) {
        const payload = req.body || {};
        const sessionId = payload.session_id || payload.id || '';
        const status = payload.status || '';
        const webhookType = payload.webhook_type || '';
        
        const dataToSign = \`\${timestampHeader}:\${sessionId}:\${status}:\${webhookType}\`;
        const expectedSig = crypto
          .createHmac('sha256', webhookSecret)
          .update(dataToSign)
          .digest('hex');
          
        if (signatureSimple && signatureSimple.length === expectedSig.length) {
          isValid = crypto.timingSafeEqual(Buffer.from(signatureSimple as string), Buffer.from(expectedSig));
        }
      } else {
         console.warn('[Didit Webhook] No signature headers found');
         return res.status(401).json({ error: 'Missing signature headers' });
      }

      if (!isValid) {
        console.warn('[Didit Webhook] Signature mismatch. Raw body:', rawBody);
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Return 2xx ASAP
    res.status(200).json({ received: true });

    // Process asynchronously
    (async () => {
      try {
        const payload = req.body || {};
        const webhookType = payload.webhook_type;
        const status = payload.status || payload.decision || payload.event || '';
        const profileId = payload.vendor_data || payload.profile_id || payload.user_id || payload.metadata?.profileId;
        const sessionId = payload.session_id || payload.id;

        console.info(\`[Didit Webhook Async] Type: \${webhookType}, Status: \${status}, Profile: \${profileId}\`);

        if (!profileId) return;

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !serviceRoleKey) return;

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
        
        let kycStatus = 'pending';
        let isVerified = false;

        switch (status) {
          case 'Approved':
          case 'approved':
          case 'verified':
            kycStatus = 'verified';
            isVerified = true;
            break;
          case 'Declined':
          case 'declined':
          case 'rejected':
            kycStatus = 'declined';
            break;
          case 'In Review':
          case 'in_review':
            kycStatus = 'pending_review';
            break;
          case 'In Progress':
          case 'in_progress':
            kycStatus = 'in_progress';
            break;
          case 'Resubmitted':
          case 'resubmitted':
            kycStatus = 'resubmitted';
            break;
          case 'Abandoned':
          case 'abandoned':
            kycStatus = 'abandoned';
            break;
          case 'Expired':
          case 'KYC Expired':
          case 'expired':
            kycStatus = 'expired';
            break;
          default:
            kycStatus = status.toLowerCase() || 'pending';
        }

        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            kyc_status: kycStatus,
            kyc_verified: isVerified,
            ...(isVerified ? { is_verified: true } : {}),
            kyc_session_id: sessionId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profileId);

        if (updateError) {
          console.error('[Didit Webhook Async] Profile update error:', updateError);
        } else {
          console.info(\`[Didit Webhook Async] Updated profile \${profileId} -> \${kycStatus}\`);
        }
      } catch (asyncErr) {
        console.error('[Didit Webhook Async] Error processing:', asyncErr);
      }
    })();
  } catch (err) {
    console.error('[Didit Webhook Exception]:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});

// ==============================================================================`;

fs.writeFileSync('server.ts', before + newWebhook + after);
console.log("Successfully patched server.ts");
