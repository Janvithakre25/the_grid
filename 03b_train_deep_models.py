"""
STEP 3b — DEEP LEARNING MODELS (LSTM, GRU)
=============================================
NOTE: run this on Google Colab (free GPU) or your own machine.
Install first:  pip install torch --index-url https://download.pytorch.org/whl/cpu

Trains a sequence model on sliding windows of past consumption + weather
to predict next-hour load, for a single node (change NODE below).
"""
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error

NODE = "H1"
SEQ_LEN = 24          # lookback window: past 24 hours
BATCH_SIZE = 64
EPOCHS = 15
HIDDEN_SIZE = 64

df = pd.read_csv(f"data/processed_{NODE}.csv", parse_dates=["timestamp"])
FEATS = ["consumption_kwh", "temperature_c", "humidity", "is_holiday",
          "hour_sin", "hour_cos", "is_weekend"]

# time-based split (80/20), same principle as classical models
split_idx = int(len(df) * 0.8)
train_df, test_df = df.iloc[:split_idx], df.iloc[split_idx:]

scaler = StandardScaler().fit(train_df[FEATS])
train_scaled = scaler.transform(train_df[FEATS])
test_scaled = scaler.transform(test_df[FEATS])
target_idx = FEATS.index("consumption_kwh")


class SeqDataset(Dataset):
    def __init__(self, data, seq_len):
        self.data = data
        self.seq_len = seq_len

    def __len__(self):
        return len(self.data) - self.seq_len - 1

    def __getitem__(self, i):
        x = self.data[i:i + self.seq_len]
        y = self.data[i + self.seq_len, target_idx]   # next-hour consumption
        return torch.tensor(x, dtype=torch.float32), torch.tensor(y, dtype=torch.float32)


train_loader = DataLoader(SeqDataset(train_scaled, SEQ_LEN), batch_size=BATCH_SIZE, shuffle=True)
test_loader = DataLoader(SeqDataset(test_scaled, SEQ_LEN), batch_size=BATCH_SIZE, shuffle=False)


class RNNForecaster(nn.Module):
    def __init__(self, n_features, hidden_size, cell="lstm"):
        super().__init__()
        rnn_cls = nn.LSTM if cell == "lstm" else nn.GRU
        self.rnn = rnn_cls(n_features, hidden_size, batch_first=True, num_layers=2, dropout=0.2)
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x):
        out, _ = self.rnn(x)
        return self.fc(out[:, -1, :]).squeeze(-1)   # use last timestep


def train_and_eval(cell):
    model = RNNForecaster(len(FEATS), HIDDEN_SIZE, cell=cell)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = nn.MSELoss()

    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0
        for xb, yb in train_loader:
            opt.zero_grad()
            pred = model(xb)
            loss = loss_fn(pred, yb)
            loss.backward()
            opt.step()
            total_loss += loss.item() * len(xb)
        if (epoch + 1) % 5 == 0:
            print(f"[{cell.upper()}] epoch {epoch+1}/{EPOCHS}  train_MSE={total_loss/len(train_loader.dataset):.4f}")

    model.eval()
    preds, actuals = [], []
    with torch.no_grad():
        for xb, yb in test_loader:
            preds.extend(model(xb).numpy())
            actuals.extend(yb.numpy())

    mae = mean_absolute_error(actuals, preds)
    rmse = np.sqrt(mean_squared_error(actuals, preds))
    print(f"[{cell.upper()}] Test MAE={mae:.4f}  RMSE={rmse:.4f} (scaled units)")
    torch.save(model.state_dict(), f"models/{NODE}_{cell}.pt")
    return mae, rmse


if __name__ == "__main__":
    print("Training LSTM...")
    train_and_eval("lstm")
    print("\nTraining GRU...")
    train_and_eval("gru")
