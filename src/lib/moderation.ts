// ==============================================================================
// MODERATION ENGINE: REALTIME INTERCEPTION OF NSFW & DOWRY DEMANDS
// ==============================================================================

export interface ModerationResult {
  isClean: boolean;
  isNSFW: boolean;
  isDowryDemand: boolean;
  matchedCategories: string[];
  sanitizedText: string;
  rejectionReason?: string;
}

// Banned Dowry & Extortion Keywords (English, Hindi/Urdu, Transliterated)
const DOWRY_PROHIBITED_PATTERNS: RegExp[] = [
  /\b(daheej|dahej|jahez|dowry|dowery|jahez-e-fatimi)\b/i,
  /\b(cash demand|cash demanded|gold demand|car demand|flat demand|plot demand)\b/i,
  /\b(salami|barat cost|baraat expense|wedding expense share)\b/i,
  /\b(kitna paisa|kitna sona|shadi ka kharcha|humein chahiye)\b/i,
  /\b(heavy demands|furnishing demand|furniture package|ac demand)\b/i,
  /\b(reverse dowry|extortion|bribing for nikah)\b/i,
];

// Banned NSFW & Explicit Interaction Terms
const NSFW_PROHIBITED_PATTERNS: RegExp[] = [
  /\b(nude|nudes|nsfw|naked|send pic|sexy|porn|xxx|cam sex)\b/i,
  /\b(hookup|one night stand|casual sex|dating only|friends with benefits|fwb)\b/i,
  /\b(boobs|vagina|penis|dick|horny|lust|erotic)\b/i,
  /\b(video call nude|show body|strip)\b/i,
];

/**
 * Evaluates outbound messages, bio statements, and chat submissions.
 * Blocks insertion if NSFW or dowry demands are detected.
 */
export function moderateTextContent(rawContent: string): ModerationResult {
  const normalized = rawContent.trim().toLowerCase();
  let isNSFW = false;
  let isDowryDemand = false;
  const matchedCategories: string[] = [];

  // 1. Check for Dowry & Financial Demands
  for (const pattern of DOWRY_PROHIBITED_PATTERNS) {
    if (pattern.test(normalized)) {
      isDowryDemand = true;
      matchedCategories.push('DOWRY_VIOLATION');
      break;
    }
  }

  // 2. Check for NSFW / Inappropriate Sexual Content
  for (const pattern of NSFW_PROHIBITED_PATTERNS) {
    if (pattern.test(normalized)) {
      isNSFW = true;
      matchedCategories.push('NSFW_VIOLATION');
      break;
    }
  }

  const isClean = !isNSFW && !isDowryDemand;
  let rejectionReason: string | undefined;

  if (isDowryDemand) {
    rejectionReason =
      'Message blocked: Solicitations or discussions regarding dowry (Daheej/Jahez) violate our Islamic Anti-Dowry Charter.';
  } else if (isNSFW) {
    rejectionReason =
      'Message blocked: Inappropriate, explicit, or non-Shariah compliant language is strictly prohibited.';
  }

  return {
    isClean,
    isNSFW,
    isDowryDemand,
    matchedCategories,
    sanitizedText: isClean ? rawContent : '[BLOCKED BY SHARIAH MODERATION SYSTEM]',
    rejectionReason,
  };
}

export default moderateTextContent;
