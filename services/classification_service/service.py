import os
import anthropic
import json
from services.anthropic_client import CLAUDE_MODEL, chat_json

class ClassificationService:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self.client = anthropic.Anthropic(api_key=self.api_key) if self.api_key else None
        self.model = CLAUDE_MODEL

    def classify_themes(self, signals: list) -> dict:
        if not self.client:
            return {"themes": [{"name": "AI Client Initialization Failed. ANTHROPIC_API_KEY is missing from GitHub Secrets.", "percentage": 100}]}
        
        prompt = f"""
        Group these raw signals into 3-5 high-level actionable themes for a product team.
        For each theme, estimate its distribution percentage (%) based on the frequency of similar signals.
        SIGNALS:
        {signals}
        
        Return JSON format: {{"themes": [{{"name": "Theme Name", "percentage": 45}}, ...]}}
        """
        
        try:
            return chat_json(self.client, messages=[{"role": "user", "content": prompt}], max_tokens=1536)
        except Exception as e:
            print(f"Classification error: {e}")
            return {"themes": [{"name": f"AI Error: {str(e)}", "percentage": 100}]}

    def detect_sentiment(self, text: str) -> str:
        """Fast heuristic-based sentiment detection for high-volume pulses."""
        text = str(text).lower()
        
        positive_cues = ["best", "good", "great", "excellent", "love", "smooth", "easy", "perfect", "fast", "thanks", "wow", "amazing", "reliable"]
        negative_cues = ["bad", "worst", "slow", "error", "fail", "poor", "issue", "problem", "bug", "broken", "expensive", "hidden", "delay", "fraud"]
        
        pos_score = sum(1 for word in positive_cues if word in text)
        neg_score = sum(1 for word in negative_cues if word in text)
        
        if pos_score > neg_score:
            return "Positive"
        elif neg_score > pos_score:
            return "Negative"
        else:
            return "Neutral"
