# ml/featurize.py
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Dict, List, Tuple

# -------------------------
# Normalization (matches extension/core/utils/text.ts)
# -------------------------

_RE_LEADING = re.compile(r'^[\s"\'`“”‘’.,!?():;\[\]{}]+')
_RE_TRAILING = re.compile(r'[\s"\'`“”‘’.,!?():;\[\]{}]+$')
_RE_SPACES = re.compile(r"\s+")


def normalize(text: str) -> str:
    """
    Normalization rules (keep in lockstep with TS):
    - NFKC unicode normalize
    - lowercase + trim
    - remove apostrophes (what's -> whats)
    - collapse whitespace
    - strip leading/trailing punctuation, keep internal punctuation
    """
    if not text:
        return ""

    t = unicodedata.normalize("NFKC", text)
    t = t.lower().strip()
    t = re.sub(r"['’]+", "", t)
    t = _RE_SPACES.sub(" ", t)
    t = _RE_LEADING.sub("", t)
    t = _RE_TRAILING.sub("", t)
    return t



def tokenize(norm: str) -> List[str]:
    """
    Tokenization must match the extension:
    - split on spaces after normalization
    """
    if not norm:
        return []
    return norm.split(" ")


# -------------------------
# Feature extraction
# -------------------------

@dataclass
class Features:
    # Core
    lenTokens: int

    # Factual-ish
    startsWithWh: int
    hasDefine: int
    hasDatePattern: int

    # Reasoning-ish
    hasCodeTokens: int
    hasErrorWords: int
    hasCompareWords: int
    hasBuildVerbs: int

    # Added for ML lift on lookup prompts
    hasLookupPhrase: int
    isStrongLookupStart: int

    def to_vector(self) -> List[float]:
        # IMPORTANT: Must match the order used by featureVector() in factualOrNot.ts
        return [
            float(self.lenTokens),
            float(self.startsWithWh),
            float(self.hasDefine),
            float(self.hasDatePattern),
            float(self.hasCodeTokens),
            float(self.hasErrorWords),
            float(self.hasCompareWords),
            float(self.hasBuildVerbs),
            float(self.hasLookupPhrase),
            float(self.isStrongLookupStart),
        ]


# These regexes should be kept in lock-step with extension/core/classify/features.ts
_RE_WH_START = re.compile(r"^(what|whats|who|whos|when|whens|where|wheres|why|whys|how|hows)\b", re.I)
_RE_DEFINE = re.compile(r"\b(define|definition|meaning|synonym)\b", re.I)
_RE_YEAR = re.compile(r"\b(19\d{2}|20\d{2})\b")

# Matches TS RE_CODE (includes punctuation/code fences)
_RE_CODE = re.compile(
    r"(```|`|=>|[{}\(\)\[\];]|</?[a-z][\s\S]*?>|\b(const|let|var|function|class|import|export|return|def)\b)",
    re.I,
)

_RE_ERROR = re.compile(
    r"\b(error|exception|traceback|stack trace|typeerror|referenceerror|nullpointer|segfault|crash|failed|failing|bug)\b",
    re.I,
)

_RE_COMPARE = re.compile(r"\b(compare|vs\.?|versus|difference|tradeoffs?|pros and cons)\b", re.I)
_RE_BUILD = re.compile(
    r"\b(implement|design|debug|fix|optimize|refactor|build|write|create|generate|architect)\b",
    re.I,
)

_RE_LOOKUP_PHRASE = re.compile(
    r"\b(meaning|definition|timezone|capital|population|height|age|birthday|release date|syntax|version|ports?)\b",
    re.I,
)

_RE_STRONG_LOOKUP_START = re.compile(
    r"^(timezone of|population of|capital of|definition of|meaning of|syntax for|release date of)\b",
    re.I,
)


def extract_features(text: str) -> Tuple[str, Features]:
    """
    Returns (normalized_text, Features)
    """
    norm = normalize(text)
    toks = tokenize(norm)

    f = Features(
        lenTokens=len(toks),

        startsWithWh=1 if _RE_WH_START.search(norm) else 0,
        hasDefine=1 if _RE_DEFINE.search(norm) else 0,
        hasDatePattern=1 if _RE_YEAR.search(norm) else 0,

        hasCodeTokens=1 if _RE_CODE.search(norm) else 0,
        hasErrorWords=1 if _RE_ERROR.search(norm) else 0,
        hasCompareWords=1 if _RE_COMPARE.search(norm) else 0,
        hasBuildVerbs=1 if _RE_BUILD.search(norm) else 0,

        hasLookupPhrase=1 if _RE_LOOKUP_PHRASE.search(norm) else 0,
        isStrongLookupStart=1 if _RE_STRONG_LOOKUP_START.search(norm) else 0,
    )

    return norm, f


def featurize_batch(prompts: List[str]) -> Tuple[List[str], List[List[float]]]:
    norms: List[str] = []
    X: List[List[float]] = []
    for p in prompts:
        norm, f = extract_features(p)
        norms.append(norm)
        X.append(f.to_vector())
    return norms, X
