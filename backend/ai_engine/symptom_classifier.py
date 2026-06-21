"""
symptom_classifier.py — Rule-based NLP symptom triage classifier.

Given a free-text symptom description, returns:
  - priority:   "emergency" | "urgent" | "normal"
  - complexity: "complex" | "moderate" | "routine"
  - matched_keywords: list of matched signal words
  - confidence: 0.0 – 1.0

Design: Multi-tier keyword matching with priority escalation.
No external ML model needed — runs in-process, zero latency.
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field


# ── Keyword Banks ─────────────────────────────────────────────────────────────

EMERGENCY_KEYWORDS: list[str] = [
    # Cardiac
    "chest pain", "heart attack", "cardiac arrest", "myocardial", "angina",
    "palpitation", "chest tightness", "irregular heartbeat", "heart failure",
    # Respiratory
    "can't breathe", "cannot breathe", "difficulty breathing", "shortness of breath",
    "not breathing", "stopped breathing", "respiratory arrest", "choking",
    "severe asthma", "anaphylaxis", "anaphylactic",
    # Neurological
    "stroke", "sudden numbness", "facial drooping", "slurred speech",
    "sudden severe headache", "loss of consciousness", "unconscious", "fainted",
    "seizure", "convulsion", "fit",
    # Trauma
    "severe bleeding", "uncontrolled bleeding", "deep wound", "impalement",
    "fracture", "broken bone", "head injury", "spinal injury",
    "multiple trauma", "major accident", "road accident",
    # Shock / acute
    "anaphylaxis", "allergic reaction", "severe allergic", "epipen",
    "overdose", "poisoning", "toxic ingestion", "suicide attempt",
    "shock", "septic shock", "sepsis", "blood poisoning",
    # Pregnancy
    "eclampsia", "pre-eclampsia", "labour", "labor", "water broke", "premature birth",
]

URGENT_KEYWORDS: list[str] = [
    # Pain (high intensity)
    "severe pain", "extreme pain", "intense pain", "unbearable pain",
    "radiating pain", "throbbing pain", "crushing pain",
    # Fever / infection
    "high fever", "very high temperature", "fever above 39", "fever above 40",
    "rigors", "chills and fever",
    # Neurological (non-emergency)
    "migraine", "severe headache", "vision loss", "blurry vision", "double vision",
    "numbness", "tingling", "weakness in limb",
    # GI urgent
    "vomiting blood", "blood in stool", "rectal bleeding", "black stool",
    "severe abdominal pain", "appendicitis", "bowel obstruction",
    # Orthopedic
    "suspected fracture", "joint dislocation", "severe sprain",
    # Mental health
    "suicidal thoughts", "self harm", "panic attack",
    # Other
    "urinary retention", "kidney stone", "renal colic",
    "eye injury", "foreign body in eye",
]

COMPLEX_KEYWORDS: list[str] = [
    # Multi-system
    "diabetes", "hypertension", "heart disease", "chronic kidney",
    "liver disease", "autoimmune", "multiple sclerosis", "lupus", "rheumatoid",
    # Cancer / chronic
    "cancer", "tumour", "tumor", "chemotherapy", "radiation therapy",
    "hiv", "aids", "hepatitis b", "hepatitis c",
    # Neurological chronic
    "parkinson", "alzheimer", "dementia", "epilepsy",
    "multiple conditions", "comorbidity",
    # Post-surgical
    "post-operative", "post-op", "wound infection", "surgical complication",
    # Respiratory chronic
    "copd", "pulmonary fibrosis", "emphysema", "bronchiectasis",
]

MODERATE_KEYWORDS: list[str] = [
    # Common illness
    "fever", "temperature", "cough", "cold", "flu", "sore throat",
    "ear pain", "ear ache", "earache", "ear infection",
    "eye infection", "conjunctivitis", "pink eye",
    "urinary tract", "uti", "burning urination",
    # Musculoskeletal
    "back pain", "neck pain", "shoulder pain", "knee pain", "joint pain",
    "muscle ache", "sprain", "strain",
    # GI moderate
    "stomach pain", "abdominal pain", "nausea", "vomiting", "diarrhoea",
    "diarrhea", "constipation", "bloating", "indigestion", "acid reflux",
    # Skin
    "rash", "allergy", "hives", "eczema", "skin infection",
    "swelling", "inflammation",
    # Mental health
    "anxiety", "depression", "stress", "insomnia", "sleep disorder",
    # Dental
    "tooth pain", "toothache", "dental",
]


# ── Utility ───────────────────────────────────────────────────────────────────

def _normalise(text: str) -> str:
    """Lowercase and strip punctuation for consistent matching."""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _match_keywords(text: str, keywords: list[str]) -> list[str]:
    """Return all keyword phrases found in the text."""
    return [kw for kw in keywords if kw in text]


# ── Main Classifier ───────────────────────────────────────────────────────────

@dataclass
class SymptomClassification:
    priority: str           # emergency | urgent | normal
    complexity: str         # complex | moderate | routine
    matched_keywords: list[str] = field(default_factory=list)
    confidence: float = 0.5
    reasoning: str = ""


def classify_symptoms(symptom_text: str) -> SymptomClassification:
    """
    Classify free-text symptom description into triage levels.

    Args:
        symptom_text: Raw free-text input from the patient.

    Returns:
        SymptomClassification with priority, complexity, matched keywords, confidence, and reasoning.
    """
    if not symptom_text or not symptom_text.strip():
        return SymptomClassification(
            priority="normal",
            complexity="routine",
            matched_keywords=[],
            confidence=0.4,
            reasoning="No symptom description provided — defaulting to normal/routine.",
        )

    norm = _normalise(symptom_text)
    word_count = len(norm.split())

    # Match each tier
    emergency_hits = _match_keywords(norm, EMERGENCY_KEYWORDS)
    urgent_hits    = _match_keywords(norm, URGENT_KEYWORDS)
    complex_hits   = _match_keywords(norm, COMPLEX_KEYWORDS)
    moderate_hits  = _match_keywords(norm, MODERATE_KEYWORDS)

    all_hits = emergency_hits + urgent_hits + complex_hits + moderate_hits

    # ── Priority determination (highest tier wins) ──────────────────────────
    if emergency_hits:
        priority = "emergency"
        priority_conf = min(0.95, 0.75 + 0.05 * len(emergency_hits))
        reasoning = f"Emergency signals detected: {', '.join(emergency_hits[:3])}"
    elif urgent_hits:
        priority = "urgent"
        priority_conf = min(0.90, 0.65 + 0.05 * len(urgent_hits))
        reasoning = f"Urgent signals detected: {', '.join(urgent_hits[:3])}"
    else:
        priority = "normal"
        priority_conf = 0.70
        reasoning = "No high-priority signals found — normal triage."

    # ── Complexity determination ────────────────────────────────────────────
    if complex_hits or len(emergency_hits) >= 2:
        complexity = "complex"
        complexity_conf = min(0.90, 0.70 + 0.05 * len(complex_hits))
    elif moderate_hits or urgent_hits or len(emergency_hits) == 1:
        complexity = "moderate"
        complexity_conf = min(0.85, 0.60 + 0.05 * (len(moderate_hits) + len(urgent_hits)))
    else:
        complexity = "routine"
        complexity_conf = 0.65

    # ── Length heuristic: longer descriptions → higher complexity ───────────
    if word_count > 40 and complexity == "routine":
        complexity = "moderate"
        complexity_conf = 0.60
        reasoning += " (Detailed description suggests moderate complexity.)"
    elif word_count > 80 and complexity == "moderate":
        complexity = "complex"
        complexity_conf = 0.65
        reasoning += " (Very detailed description suggests complex case.)"

    # ── Overall confidence ──────────────────────────────────────────────────
    confidence = (priority_conf + complexity_conf) / 2

    return SymptomClassification(
        priority=priority,
        complexity=complexity,
        matched_keywords=all_hits[:10],   # cap output
        confidence=round(confidence, 2),
        reasoning=reasoning,
    )
