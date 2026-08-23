import os
import json
import anthropic
from services.anthropic_client import CLAUDE_MODEL, chat_json

class LLMService:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self.client = anthropic.Anthropic(api_key=self.api_key) if self.api_key else None
        self.model = CLAUDE_MODEL

    def _chunk_reviews(self, reviews: list, chunk_size: int = 200):
        for i in range(0, len(reviews), chunk_size):
            yield reviews[i:i + chunk_size]

    def analyze_reviews(self, reviews: list) -> dict:
        if not self.client:
            return {"error": "ANTHROPIC_API_KEY missing"}

        # 1. Map Phase: Extract themes from all batches
        all_batch_themes = []
        all_batch_quotes = []
        
        for chunk in self._chunk_reviews(reviews, chunk_size=200):
            context = "\n".join([f"- [Rating: {r['rating']}] {r['review_text']}" for r in chunk])
            
            prompt = f"""
            Analyze these reviews and return a JSON with:
            - themes: list of top 3 themes in this batch
            - quotes: 2 representative quotes
            
            REVIEWS:
            {context}
            """
            
            try:
                res = chat_json(self.client, messages=[{"role": "user", "content": prompt}], max_tokens=1024)
                all_batch_themes.extend(res.get('themes', []))
                all_batch_quotes.extend(res.get('quotes', []))
            except Exception as e:
                print(f"Error in batch processing: {e}")

        # 2. Reduce Phase: Consolidate into final report
        system_prompt = """
        You are a Lead Product Analyst at INDMoney. 
        You will be given a list of themes and quotes collected from 1,000 user reviews.
        Your task is to synthesize them into one final master report.
        
        STRICT CONSTRAINTS:
        1. Max 5 global themes.
        2. Exactly 3 anonymized quotes (pick the most impactful).
        3. Exactly 3 actionable recommendations.
        4. Summary length: 150-250 words.
        5. Output JSON only.
        """

        reduction_prompt = f"""
        CONSOLIDATED DATA FROM ALL REVIEWS:
        THEMES: {all_batch_themes}
        QUOTES: {all_batch_quotes}
        
        Generate the final Weekly Pulse JSON:
        """

        try:
            return chat_json(
                self.client,
                messages=[{"role": "user", "content": reduction_prompt}],
                system=system_prompt,
                max_tokens=2048,
            )
        except Exception as e:
            return {"error": f"Synthesis failed: {str(e)}"}
