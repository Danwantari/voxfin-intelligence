# VoxFin Intelligence - Phase 1 (MVP)

A production-grade Voice-of-Customer intelligence system that converts fintech app reviews into actionable weekly pulses, powered by Claude, with automated Jira ticketing and stakeholder email delivery.

📖 **[Full product walkthrough with screenshots, and the engineering journal of every bug found & fixed](docs/WALKTHROUGH.md)**

## Repository Structure
```text
/phase1
  /ingestion      # Normalization (Title removal, deduplication)
  /preprocessing  # Cleaning (PII removal, Word-count & Language filtering)
  /llm_pipeline   # Claude orchestration (Themes, quotes, action items)
  /output         # Stored reports
  main.py         # Entry point
  config.yaml     # Configuration
## Phase 2: Production Pipeline
The production-grade system features service-oriented architecture, persistent storage, and automated scheduling.

### **Gmail SMTP Setup (Required for Email)**
To enable automated email delivery, follow these steps to generate a secure **App Password**:
1. **Go to Google Account**: [https://myaccount.google.com/](https://myaccount.google.com/)
2. **Security**: Ensure **2-Step Verification** is enabled.
3. **App Passwords**: Search for "App Passwords" in the search bar.
4. **Create**: 
   - App: **Mail**
   - Device: **Other (Custom Name)** (e.g., "INDMoney Pulse")
5. **Copy**: Save the 16-character password (e.g., `xxxx xxxx xxxx xxxx`).

### **Environment Configuration (.env)**
Ensure your `.env` file contains the following:
```env
ANTHROPIC_API_KEY=your_anthropic_key
GEMINI_API_KEY=your_gemini_key

# Email Settings
EMAIL_SENDER=your_email@gmail.com
EMAIL_PASSWORD=your_16_char_app_password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# Jira Settings
JIRA_SITE_URL=yourcompany.atlassian.net
JIRA_USER_EMAIL=your_email@example.com
JIRA_API_TOKEN=your_jira_token
JIRA_PROJECT_KEY=PROD
```

### **Key Services**
- **Ingestion Service**: Handles local data loading and raw storage.
- **Preprocessing Service**: Enforces high-signal filtering and PII scrubbing.
- **LLM Service**: Orchestrates Claude (Haiku 4.5) analysis with representative sampling.
- **Report & Email Services**: Handles artifact finalization and distribution.

### **Running Phase 2**
1. **Navigate to root**: `cd voxfin-intelligence`
2. **Launch Server**:
   ```bash
   python3 phase2/main.py
   ```
3. **Access Dashboard**: `http://localhost:8001`

### **Running Tests**
```bash
python3 -m pytest phase2/tests/test_production.py
```

## Phase 1 Constraints
- **Ingestion Limit**: Maximum of **1,000 reviews** per run.
  - If more than 1,000 reviews are available, the system prioritizes the **latest 1,000** based on the review date.
  - If fewer than 1,000 are available, all reviews are processed.
- **Theme Limit**: Maximum of 5 distinct themes.
- **Summary Length**: ≤ 250 words.
- **PII Policy**: Strict zero-PII leakage via automated scrubbing.

## Setup
1. **API Key**: `export ANTHROPIC_API_KEY='your_key_here'`
2. **Data**: Place CSV/JSON reviews in `data/raw/`.
3. **Run**: 
   ```bash
   python3 phase1/main.py
   ```
   Open `http://localhost:8000` to trigger the pulse.
