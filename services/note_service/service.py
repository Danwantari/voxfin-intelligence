import os
import json
import requests
import anthropic
from tenacity import retry, stop_after_attempt, wait_exponential
from services.anthropic_client import CLAUDE_MODEL, chat_json

class NoteService:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self.gemini_key = os.environ.get("GEMINI_API_KEY")
        self.client = anthropic.Anthropic(api_key=self.api_key) if self.api_key else None
        self.model = CLAUDE_MODEL

    @retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=4, max=10))
    def generate_note(self, themes: list, reviews: list) -> dict:
        # Take a few representative reviews for quotes
        context = "\n".join([f"- {r['review_text']}" for r in reviews[:50]])
        
        prompt = f"""
        Generate a Weekly Review Pulse based on these themes: {themes}.
        Use these reviews for context: {context}
        
        CONSTRAINTS:
        1. Summary <= 250 words.
        2. Exactly 3 anonymized quotes.
        3. Exactly 3 action items.
        
        Return JSON: {{
            "summary": "...",
            "quotes": ["...", "...", "..."],
            "action_items": ["...", "...", "..."]
        }}
        """
        
        # Try Claude First
        if self.client:
            try:
                return chat_json(self.client, messages=[{"role": "user", "content": prompt}], max_tokens=1536)
            except Exception as e:
                print(f"Claude note generation failed, trying Gemini: {e}")
                if "rate_limit" not in str(e).lower() and "429" not in str(e):
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
                    
                    # Parse JSON from Gemini text
                    if "```json" in text:
                        text = text.split("```json")[1].split("```")[0].strip()
                    elif "```" in text:
                        text = text.split("```")[1].split("```")[0].strip()
                    
                    return json.loads(text)
                else:
                    print(f"Gemini REST Note Failed: {response.text}")
            except Exception as e:
                print(f"Gemini note generation failed: {e}")

        return {
            "summary": "AI Synthesis Failed. Both Claude and Gemini limits exceeded.",
            "quotes": [],
            "action_items": []
        }
