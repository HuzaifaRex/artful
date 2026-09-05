"""Layered smart search: normalization, fuzzy correction, synonyms, intent, budget."""
import re

# Built-in synonym seeds (admin can extend via DB)
BASE_SYNONYMS = {
    "present": "gift", "gifts": "gift", "bday": "birthday", "mom": "mother",
    "mum": "mother", "custom": "personalized", "personalised": "personalized",
    "handcrafted": "handmade", "decor": "decor", "notebook": "journal",
    "gf": "girlfriend", "bf": "boyfriend", "anniversery": "anniversary",
    "jewelery": "jewellery", "jwellery": "jewellery", "statinary": "stationery",
    "stationary": "stationery", "candel": "candle", "candell": "candle",
    "persnalized": "personalized", "wedding": "wedding", "hubby": "husband",
}

RECIPIENTS = ["her", "him", "mother", "father", "wife", "husband", "girlfriend",
              "boyfriend", "couple", "couples", "colleague", "friend", "kids", "baby"]
OCCASIONS = ["birthday", "anniversary", "wedding", "housewarming", "festive",
             "corporate", "valentine", "diwali", "christmas"]


def normalize(text: str) -> str:
    text = (text or "").lower().strip()
    text = re.sub(r"[_\-]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def singularize(word: str) -> str:
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"
    if len(word) > 3 and word.endswith("es"):
        return word[:-2]
    if len(word) > 3 and word.endswith("s"):
        return word[:-1]
    return word


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def closest(word: str, vocab, max_dist=2):
    best, best_d = None, max_dist + 1
    for v in vocab:
        if abs(len(v) - len(word)) > max_dist:
            continue
        d = levenshtein(word, v)
        if d < best_d:
            best, best_d = v, d
    return best if best_d <= max_dist else None


def extract_budget(text: str):
    """Return (min_price, max_price) if a budget phrase is present."""
    t = re.sub(r"\brs\.?\b|₹", " ", text).replace(",", "")
    m = re.search(r"between\s+(\d+)\s+(?:and|to|-)\s+(\d+)", t)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.search(r"(?:under|below|less than|upto|up to|within)\s+(\d+)", t)
    if m:
        return None, int(m.group(1))
    m = re.search(r"(?:above|over|more than)\s+(\d+)", t)
    if m:
        return int(m.group(1)), None
    return None, None


class SearchEngine:
    def __init__(self, synonyms: dict, corrections: dict, vocab: set):
        self.synonyms = {**BASE_SYNONYMS, **(synonyms or {})}
        self.corrections = corrections or {}
        self.vocab = vocab or set()

    def process(self, raw_query: str):
        original = raw_query
        norm = normalize(raw_query)
        min_p, max_p = extract_budget(norm)
        # strip budget words for token matching
        norm_clean = re.sub(r"(between\s+\d+\s+(?:and|to|-)\s+\d+|(?:under|below|less than|upto|up to|within|above|over|more than)\s+\d+|₹|\brs\.?\b)", " ", norm)
        norm_clean = re.sub(r"\bfor\b|\bgift\b|\bunder\b", " ", norm_clean)
        tokens = [w for w in re.split(r"\s+", norm_clean) if w]

        recipient = next((r for r in RECIPIENTS if r in tokens), None)
        occasion = next((o for o in OCCASIONS if o in norm), None)

        corrected_tokens, changed = [], False
        for w in tokens:
            cw = w
            if cw in self.corrections:
                cw = self.corrections[cw]; changed = True
            elif cw in self.synonyms:
                cw = self.synonyms[cw]; changed = True
            elif cw not in self.vocab and len(cw) > 3:
                c = closest(cw, self.vocab)
                if c and c != cw:
                    cw = c; changed = True
            corrected_tokens.append(cw)

        expanded = set()
        for w in corrected_tokens:
            expanded.add(w)
            expanded.add(singularize(w))
            if w in self.synonyms:
                expanded.add(self.synonyms[w])
        expanded = {w for w in expanded if w and w not in ("gift", "for")}

        corrected_query = " ".join(corrected_tokens).strip()
        return {
            "original_query": original,
            "corrected_query": corrected_query if changed else None,
            "tokens": list(expanded),
            "recipient": recipient,
            "occasion": occasion,
            "min_price": min_p,
            "max_price": max_p,
        }

    def score(self, product: dict, tokens, recipient, occasion):
        if not tokens and not recipient and not occasion:
            return 1
        haystack = " ".join([
            product.get("name", ""), product.get("short_description", ""),
            product.get("description", ""), product.get("category_slug", ""),
            " ".join(product.get("tags", [])), " ".join(product.get("collections", [])),
            product.get("material", "") or "", product.get("color", "") or "",
            " ".join(product.get("occasion", [])), " ".join(product.get("recipient", [])),
        ]).lower()
        haystack_norm = normalize(haystack)
        score = 0
        name = normalize(product.get("name", ""))
        for t in tokens:
            if not t:
                continue
            if t in name:
                score += 5
            elif t in haystack_norm:
                score += 2
            else:
                for hw in set(haystack_norm.split()):
                    if len(hw) > 3 and levenshtein(t, hw) <= 1:
                        score += 1
                        break
        if recipient and recipient in haystack_norm:
            score += 3
        if occasion and occasion in haystack_norm:
            score += 3
        return score
