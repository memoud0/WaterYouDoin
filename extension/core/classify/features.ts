import { tokenize } from "../utils/text";

export type Features = {
  lenTokens: number;

  startsWithWh: boolean;
  hasDefine: boolean;
  hasDatePattern: boolean;

  hasCodeTokens: boolean;
  hasErrorWords: boolean;

  hasCompareWords: boolean;
  hasBuildVerbs: boolean;

  // for ML
  hasLookupPhrase: boolean;
  isStrongLookupStart: boolean;
};

const RE_WH_START = /^(what|who|when|where|why|how)\b/i;
const RE_DEFINE = /\b(define|definition|meaning|synonym)\b/i;
const RE_YEAR = /\b(19\d{2}|20\d{2})\b/; // 1900-2099

// Code-ish: includes the word "function" which is why we need lookup phrase features for ML
const RE_CODE = /(```|`|=>|[{()}[\];]|<\/?[a-z][\s\S]*?>|\b(const|let|var|function|class|import|export|return|def)\b)/i;

const RE_ERROR =
  /\b(error|exception|traceback|stack trace|typeerror|referenceerror|nullpointer|segfault|crash|failed|failing|bug)\b/i;

const RE_COMPARE = /\b(compare|vs\.?|versus|difference|tradeoffs?|pros and cons)\b/i;
const RE_BUILD = /\b(implement|design|debug|fix|optimize|refactor|build|write|create|generate|architect)\b/i;

const RE_LOOKUP_PHRASE =
  /\b(meaning|definition|timezone|capital|population|height|age|birthday|release date|syntax|version|ports?)\b/i;

const RE_STRONG_LOOKUP_START =
  /^(timezone of|population of|capital of|definition of|meaning of|syntax for|release date of)\b/i;

export function extractFeatures(normalized: string): Features {
  const tokens = tokenize(normalized);

  return {
    lenTokens: tokens.length,

    startsWithWh: RE_WH_START.test(normalized),
    hasDefine: RE_DEFINE.test(normalized),
    hasDatePattern: RE_YEAR.test(normalized),

    hasCodeTokens: RE_CODE.test(normalized),
    hasErrorWords: RE_ERROR.test(normalized),

    hasCompareWords: RE_COMPARE.test(normalized),
    hasBuildVerbs: RE_BUILD.test(normalized),

    hasLookupPhrase: RE_LOOKUP_PHRASE.test(normalized),
    isStrongLookupStart: RE_STRONG_LOOKUP_START.test(normalized),
  };
}
