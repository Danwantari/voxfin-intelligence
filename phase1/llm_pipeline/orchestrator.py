import os
import re
import json
import anthropic

class GroqOrchestrator:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self.client = anthropic.Anthropic(api_key=self.api_key) if self.api_key else None
        self.model = "claude-haiku-4-5"

    def generate_report(self, reviews: list) -> dict:
        if not self.client:
            return {"error": "ANTHROPIC_API_KEY not configured."}

        review_context = "\n".join([
            f"- [Rating: {r['rating']}] {r['review_text']}"
            for r in reviews[:200] # Representative sample for Phase 1 tokens
        ])

        system_prompt = """
        You are a Product Analyst at INDMoney. Analyze app reviews and generate a Weekly Pulse.
        
        STRICT CONSTRAINTS:
        1. Identify 3-5 distinct, actionable themes.
        2. Provide 3 representative user quotes (anonymized).
        3. Provide 3 actionable recommendations.
        4. Summary MUST be ≤ 250 words.
        5. NO PII (emails, phones, etc.) in output.
        6. Output MUST be valid JSON with keys: 'summary', 'themes', 'quotes', 'action_items', 'email_draft'.
        """

        user_prompt = f"REVIEWS:\n{review_context}\n\nGenerate report JSON:"

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            text = "".join(b.text for b in response.content if b.type == "text").strip()
            if text.startswith("```"):
                text = re.sub(r"^```(json)?", "", text).rsplit("```", 1)[0].strip()
            return json.loads(text)
        except Exception as e:
            return {"error": str(e)}
