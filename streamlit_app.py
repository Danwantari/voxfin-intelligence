import streamlit as st
import os
import sys
import traceback
import json
from datetime import datetime

# Standard Path setup
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

st.set_page_config(page_title="VoxFin Controller", page_icon="💎", layout="wide")

st.title("💎 VoxFin Strategic Intelligence")
st.caption("Backend Management Console | v10.0 (Clean Reset)")

# Diagnostic Import Area
try:
    # Root Imports
    from services.intelligence_orchestrator import IntelligenceOrchestrator
    from storage.db import DatabaseManager
    
    st.sidebar.success("✅ System Core v10.0 Loaded")
    
    # Sidebar Configuration
    st.sidebar.header("🕹️ Control Panel")
    fee_options = st.sidebar.multiselect(
        "Financial Education Targets",
        ["exit_load", "brokerage_fee"],
        default=["exit_load", "brokerage_fee"]
    )
    days_window = st.sidebar.slider("Rolling Window (Days)", 7, 360, 30)
    max_reviews = st.sidebar.number_input("Max Review Capacity", 100, 10000, 2000)

    if st.sidebar.button("🚀 TRIGGER EXECUTIVE PULSE"):
        with st.status("Initializing Strategic Synthesis...", expanded=True) as status:
            # Change DB Path for this session to avoid schema conflicts
            st.write("🔍 Layer 1-3: Ingesting & Deduplicating Reviews...")
            orchestrator = IntelligenceOrchestrator(db_path="data/pulse_v10.db")
            
            # Force a fresh ingestion if we have fewer than 10 reviews (ensures real data exists)
            st.write("📡 Checking Live Signal Strength...")
            db_v10 = DatabaseManager("data/pulse_v10.db")
            with db_v10._get_connection() as conn:
                count = conn.execute("SELECT COUNT(*) FROM raw_reviews").fetchone()[0]
                if count < 10:
                    st.write("📥 Database is hungry. Ingesting fresh App Store/Play Store signals...")
                    from services.ingestion_service.real_ingestor import RealIngestor
                    ingestor = RealIngestor(db_v10)
                    ingestor.fetch_reviews(limit=1000)
            
            st.write("🧠 Layer 4-5: LLM Theme Extraction & Synthesis...")
            report_id, combined_payload = orchestrator.run_pipeline(
                fee_types=",".join(fee_options),
                max_reviews=max_reviews,
                days=days_window
            )
            
            if report_id:
                st.write("📄 Layer 6-7: Generating Elite PDF & Education Sync...")
                
                # [NEW] Live Bridge: Save for Frontend and Auto-Push
                try:
                    # Get a sample of filtered reviews for the frontend
                    db_v10 = DatabaseManager("data/pulse_v10.db")
                    with db_v10._get_connection() as conn:
                        import pandas as pd
                        sample_reviews = pd.read_sql_query("SELECT user_name, review_text, rating, platform, review_date, category, sentiment FROM filtered_reviews ORDER BY review_date DESC LIMIT 5000", conn).to_dict('records')

                    latest_data = {
                        "report_id": report_id,
                        "generated_at": datetime.now().isoformat(),
                        "payload": combined_payload,
                        "reviews": sample_reviews
                    }
                    os.makedirs("data", exist_ok=True)
                    with open("data/latest_pulse.json", "w") as f:
                        json.dump(latest_data, f, indent=2)
                    
                    # [NEW] Sync the Reports Archive as well
                    reports_list = db_v10.get_all_reports()
                    archive_path = "data/reports_archive.json"
                    with open(archive_path, "w") as f:
                        json.dump(reports_list, f, indent=2)
                    
                    if GITHUB_TOKEN:
                        # 1. Sync latest_pulse.json
                        file_path = "data/latest_pulse.json"
                        url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{file_path}"
                        headers = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
                        r = requests.get(url, headers=headers)
                        sha = r.json().get("sha") if r.status_code == 200 else None
                        content_b64 = base64.b64encode(json.dumps(latest_data).encode()).decode()
                        payload = { "message": "System: Live Bridge Sync", "content": content_b64, "branch": "main" }
                        if sha: payload["sha"] = sha
                        requests.put(url, headers=headers, json=payload)

                        # 2. Sync reports_archive.json
                        archive_url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{archive_path}"
                        r_arch = requests.get(archive_url, headers=headers)
                        sha_arch = r_arch.json().get("sha") if r_arch.status_code == 200 else None
                        content_arch_b64 = base64.b64encode(json.dumps(reports_list).encode()).decode()
                        payload_arch = { "message": "System: Archive Sync", "content": content_arch_b64, "branch": "main" }
                        if sha_arch: payload_arch["sha"] = sha_arch
                        requests.put(archive_url, headers=headers, json=payload_arch)

                        st.sidebar.success("📡 Live Bridge & Archive Synchronized")
                    else:
                        st.sidebar.warning("💡 Missing GITHUB_TOKEN in Secrets")
                except Exception as sync_err:
                    st.sidebar.warning(f"📡 Sync Delayed: {sync_err}")

                status.update(label=f"✅ Pulse Generated! Report ID: {report_id}", state="complete")
                st.balloons()
                st.success(f"Pulse successfully synchronized across Email, PDF, and Google Workspace.")
            else:
                st.error("Pipeline finished with no results. Check logs for details.")

    # Main Dashboard
    col1, col2 = st.columns([2, 1])

    with col1:
        st.subheader("📊 Recent Strategic Pulses")
        try:
            # Check v10 DB
            db = DatabaseManager("data/pulse_v10.db")
            with db._get_connection() as conn:
                import pandas as pd
                try:
                    df = pd.read_sql_query("SELECT id, review_count, created_at FROM reports ORDER BY id DESC LIMIT 5", conn)
                except Exception:
                    df = pd.read_sql_query("SELECT id, review_count FROM reports ORDER BY id DESC LIMIT 5", conn)
                
                if not df.empty:
                    st.dataframe(df, use_container_width=True)
                else:
                    st.info("No pulses generated in this environment yet. Trigger your first report.")
        except Exception:
            st.info("Welcome to the Clean Environment! Trigger a Pulse to initialize the intelligence hub.")

    with col2:
        st.subheader("🏢 Stakeholder Archives")
        st.info("Live Strategic Doc sync is active.")

except Exception as e:
    st.error("🚨 CRITICAL BOOT ERROR")
    st.info("If you see this, copy the traceback below:")
    st.code(traceback.format_exc())
