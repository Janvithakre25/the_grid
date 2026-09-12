# Project Workflow — Energy Consumption Forecasting (India / POSOCO)

This is the full path from where you are right now to final submission.
Part A is what changes because of the India swap. Part B is everything
else, mapped to your synopsis's own 16-week plan.

---

## PART A — What you have to change right now

1. **Run `06_fetch_real_weather_india.py` on your own machine.**
   This is the only step that cannot run in a sandbox — it needs to
   reach Open-Meteo. Takes 1-2 minutes, no API key. Produces
   `data/energy_data_india_final.csv`.

2. **Re-run the pipeline from `02` onward** with real weather now merged:
   ```
   02_preprocess_india.py → 03_train_models_india.py →
   03b_train_deep_models_india.py (Colab) → 03c_train_prophet_india.py →
   04_shap_explain_india.py → 05_recommendation_engine_india.py
   ```
   The numbers I showed you earlier used placeholder weather just to
   prove the code runs — treat those as throwaway, not real results.

3. **Delete/replace every leftover UCI/France reference in your own
   notes, slides, or draft report.** Specifically check for:
   - "Sceaux, France" / "household in France" → now "33 Indian states"
   - `kWh` / hourly units → now `MU` (Mega Units) / daily
   - `F1_derived`, `S1_derived`, `UCI_H1` node names → now real state
     names (e.g. `Maharashtra`, `Punjab`)
   - "hourly forecast" language → "daily forecast" (short-term) and
     "weekly forecast" (medium-term)

4. **Rewrite the SHAP/recommendation demo talking points** — you'll be
   showing a state (Maharashtra by default) instead of a household.
   The story becomes "why did the model raise its forecast for
   Maharashtra on this day" instead of "why did this house use more
   electricity this hour."

5. **Update your synopsis's Section 6 (Technology, Tools and
   Platforms)** if your final report restates it — you're using
   `holidays` (Python package) for the Indian calendar and Open-Meteo
   instead of a paid weather API, which is worth noting as a
   cost-effective choice (ties into your own problem statement about
   "expensive enterprise solutions").

---

## PART B — Full workflow, mapped to your 16-week plan

### Weeks 1–3: Literature review & requirement analysis — mostly done
- [x] Literature review (in synopsis)
- [x] Research gap identified
- [ ] Add 1-2 papers specifically on **Indian grid load forecasting**
      to your references if you haven't — panel will expect
      India-specific citations now that your data is Indian (CEA/POSOCO
      technical reports count).

### Weeks 4–5: Design & methodology finalisation
- [ ] Finalize architecture diagram to reflect **state-level nodes**
      instead of household/feeder/substation (or reframe: state ≈
      substation-scale aggregate, household-level becomes a stated
      "future work" extension since no public Indian household smart-
      meter data exists)
- [ ] Decide dashboard scope: single-state view with a dropdown, or
      all-33-states map view (map view is more visually impressive for
      a panel demo but more dev time — pick based on time left)
- [ ] Sketch the FastAPI endpoint contract now, e.g.
      `GET /forecast/{state}?horizon=1d|7d` → JSON with prediction,
      SHAP top factors, recommendation

### Weeks 6–12: Implementation — where you are now
- [x] Data pipeline (build → weather → preprocess)
- [x] Multi-model training (RF, XGBoost, LSTM/GRU, Prophet) — scripts
      ready, need real run with real weather
- [x] SHAP explainability layer
- [x] Recommendation engine (rule-based)
- [ ] **Dashboard build** (not started) — this is your biggest
      remaining chunk of work:
  - [ ] FastAPI backend: load `.pkl` per state/horizon, expose
        `/forecast/{state}` and `/explain/{state}` endpoints
  - [ ] React frontend: state selector, forecast chart (recharts),
        SHAP factor list, recommendation banner, confidence interval
        display (use train-set residual std as a simple confidence
        band if you don't have time for proper quantile regression)
  - [ ] "Live" simulation: replay historical test-set rows on a timer
        to fake real-time updates — state this explicitly as a known
        simplification in your report
  - [ ] Anomaly alert logic: flag when actual (replayed) value deviates
        from forecast by more than N standard deviations — reuses your
        `05_recommendation_engine`'s threshold logic
- [ ] Continuous monitoring/retraining: even a simple script that
      re-runs `03_train_models_india.py` on a schedule and logs MAE
      over time satisfies this synopsis objective — doesn't need to be
      fully automated for a B.Tech deliverable, just demonstrable

### Weeks 13–14: Testing & evaluation
- [ ] Compile the final `model_comparison_india.csv` across all
      33 states × 2 horizons × 4 model types (RF, XGBoost, LSTM/GRU,
      Prophet) — this table is your core "objective 2: apply and
      compare" evidence
- [ ] Functional testing of the dashboard (does it load, does the
      dropdown work, does the SHAP plot render for every state)
- [ ] Sanity-check MAPE outliers — a few small states (Sikkim,
      Mizoram, etc.) may show high % error simply because their load
      is small in absolute terms; be ready to explain this if asked
- [ ] Write up explainability validation: pick 2-3 states, 2-3 example
      days each, and manually sanity-check that SHAP's top factors
      make physical sense (e.g. high temp → higher predicted load in
      summer states)

### Weeks 15–16: Documentation & final submission
- [ ] Final project report — restructure around what you actually
      built (India data, daily/weekly horizons, 33 states) rather than
      the original synopsis wording verbatim
- [ ] Research paper draft (per your synopsis's deliverables list)
- [ ] User manual for the dashboard
- [ ] Final presentation slides
- [ ] Rehearse the panel demo flow from the README's Section 5

---

## Quick answer to "is this done yet?"

**Built and tested (code-complete, needs real weather + real run):**
data pipeline, preprocessing, RF/XGBoost training, LSTM/GRU script,
Prophet script, SHAP explainability, recommendation engine.

**Not started:** dashboard (FastAPI + React), continuous
monitoring/retraining automation, final report/paper, user manual.

**Immediate next action:** run `06_fetch_real_weather_india.py`
locally, then re-run `02` through `05` for real numbers — everything
else in Part B depends on having real results to show.
