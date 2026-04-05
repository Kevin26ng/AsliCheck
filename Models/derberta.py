from transformers import pipeline
import torch

print("Loading DeBERTa model...")

classifier = pipeline(
    "zero-shot-classification",
    model="cross-encoder/nli-deberta-v3-small",
    device=0 if torch.cuda.is_available() else -1
)

LABELS = ["factual and accurate", "suspicious or misleading"]

def is_suspicious(text: str) -> tuple[bool, float]:
    result = classifier(text, LABELS)
    scores = dict(zip(result["labels"], result["scores"]))
    suspicion_score = scores["suspicious or misleading"]
    is_sus = suspicion_score > 0.45
    return is_sus, suspicion_score