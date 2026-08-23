import os
import time
import json
import requests
import anthropic
from tenacity import retry, stop_after_attempt, wait_exponential
from services.anthropic_client import CLAUDE_MODEL

class DiscoveryService:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self.gemini_key = os.environ.get("GEMINI_API_KEY")
        self.client = anthropic.Anthropic(api_key=self.api_key) if self.api_key else None
        self.model = CLAUDE_MODEL

    @retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=4, max=10))
    def discover_signals(self, reviews: list) -> list:
        # Limit context to stay within TPM limits (80 reviews max for safety)
        context = "\n".join([f"- {r['review_text']}" for r in reviews[:80]])
        prompt = f"""
        Extract the top 10 raw signals (topics, bugs, or feature requests) from these reviews.
        REVIEWS:
        {context}
        
        Return a simple list of signals.
        """
        
        # Try Claude First
        if self.client:
            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=1024,
                    messages=[{"role": "user", "content": prompt}],
                )
                text = "".join(b.text for b in response.content if b.type == "text")
                signals = text.strip().split('\n')
                return [s.strip('- ').strip() for s in signals if s.strip()]
            except Exception as e:
                print(f"Claude failed, trying Gemini fallback: {e}")
                if "rate_limit" not in str(e).lower() and "429" not in str(e):
                    # If it's NOT a rate limit, don't fallback yet, let retry handle it
                    if "client" not in str(e).lower(): raise e

        # Fallback to Gemini
        if self.gemini_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key={self.gemini_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}]
                }
                response = requests.post(url, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    text = data['candidates'][0]['content']['parts'][0]['text']
                    signals = text.strip().split('\n')
                    return [s.strip('- ').strip() for s in signals if s.strip()]
                else:
                    print(f"Gemini REST Failed: {response.text}")
            except Exception as e:
                print(f"Gemini also failed: {e}")
        
        return ["AI Synthesis Failed. Both Claude (Rate Limited) and Gemini (Fallback) failed."]
