import os
import json
import anthropic
from datetime import datetime
from dotenv import load_dotenv
from services.anthropic_client import CLAUDE_MODEL, chat_json

class FeeExplainerService:
    def __init__(self, api_key: str = None):
        load_dotenv()
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self.client = anthropic.Anthropic(api_key=self.api_key) if self.api_key else None
        self.model = CLAUDE_MODEL
        
        # Scenario Reference Data (Restricted to provided links)
        self.official_links = [
            "https://www.indmoney.com/mutual-funds/sbi-psu-direct-growth-3465",
            "https://www.indmoney.com/mutual-funds/aditya-birla-sun-life-psu-equity-fund-direct-growth-1005251",
            "https://www.indmoney.com/mutual-funds/icici-prudential-infrastructure-fund-direct-plan-growth-3333",
            "https://www.indmoney.com/mutual-funds/nippon-india-power-infra-fund-direct-plan-growth-3422"
        ]
        
        self.scenarios = {
            "exit_load": {"name": "Mutual Fund Exit Load", "links": self.official_links[0:2]},
            "brokerage_fee": {"name": "Brokerage Fee", "links": self.official_links[2:4]}
        }

    def generate_explanation(self, fee_type: str) -> dict:
        if fee_type not in self.scenarios:
            return None
            
        scenario = self.scenarios[fee_type]
        
        prompt = f"""
        Provide a concise, factual explanation for the following fee type: {scenario['name']}.
        
        Constraints:
        1. Max 6 bullet points.
        2. Neutral, facts-only tone.
        3. No recommendations or comparisons.
        
        Return JSON format: 
        {{
            "type": "{fee_type}",
            "scenario_name": "{scenario['name']}",
            "explanation_bullets": ["Bullet 1", "Bullet 2", ...],
            "source_links": {json.dumps(scenario['links'])}
        }}
        """
        
        try:
            result = chat_json(self.client, messages=[{"role": "user", "content": prompt}], max_tokens=1024)

            # Force Strict Compliance
            result["type"] = fee_type
            result["scenario_name"] = scenario["name"]
            result["source_links"] = scenario["links"]
            result["last_checked"] = datetime.now().strftime("%Y-%m-%d")
            
            return result
        except Exception as e:
            print(f"Fee Explainer Error: {e}")
            return None

    def explain_multiple(self, fee_types: list = None) -> list:
        if not fee_types:
            fee_types = ["exit_load"] # Default
            
        results = []
        for f_type in fee_types:
            expl = self.generate_explanation(f_type)
            if expl:
                results.append(expl)
        return results
