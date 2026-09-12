import pandas as pd
import joblib

states_to_check = ["Maharashtra", "JandK", "UP", "Punjab"]

for state in states_to_check:
    df = pd.read_csv(f"data/processed_{state}.csv", parse_dates=["timestamp"])
    feats = [c for c in df.columns if c.startswith("lag_") or c.startswith("roll_")] + \
            ["temperature_c", "humidity", "is_holiday", "dow_sin", "dow_cos",
             "month_sin", "month_cos", "doy_sin", "doy_cos", "is_weekend"]

    model = joblib.load(f"models/{state}_target_next_1d_XGBoost.pkl")
    latest = df.iloc[[-1]]
    pred = model.predict(latest[feats])[0]
    actual_last = latest["consumption_mu"].values[0]
    as_of_date = latest["timestamp"].dt.date.values[0]

    print(f"{state:15s} | as_of={as_of_date} | last_actual={actual_last:8.2f} MU | predicted_next={pred:8.2f} MU")