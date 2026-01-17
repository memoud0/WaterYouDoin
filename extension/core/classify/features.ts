export type Features = {
  lenTokens: number;

  startsWithWh: boolean;
  hasDefine: boolean;
  hasDatePattern: boolean;

  hasCodeTokens: boolean;
  hasErrorWords: boolean;

  hasCompareWords: boolean;
  hasBuildVerbs: boolean;
};

const RE_WH_START = /^(what|who|when|where|why|how)\b/i;
const RE_DEFINE = /\b(define|definition|meaning|synonym)\b/i;
const RE_YEAR = /\b(19\d{2}|20\d{2})\b/; // 1900-2099

// Code-ish: backticks, braces, arrows, keywords, html tags, etc...
const RE_CODE = /(```|`|=>|[{()}[\];]|<\/?[a-z][\s\S]*?>|\b(const|let|var|function|class|import|export|return|def)\b)/i;

// Error-ish
const RE_ERROR = /\b(error|exception|traceback|stack trace|typeerror|referenceerror|nullpointer|segfault|crash|failed|failing|bug)\b/i;

const RE_COMPARE = /\b(compare|vs\.?|versus|difference|tradeoffs?|pros and cons)\b/i;
const RE_BUILD = /\b(implement|design|debug|fix|optimize|refactor|build|write|create|generate|architect)\b/i;

export function tokenize(normalized: string): string[] {
  return normalized.split(/\s+/).filter(Boolean);
}

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
  };
}
