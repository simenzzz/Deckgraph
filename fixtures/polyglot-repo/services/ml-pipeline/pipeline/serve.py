from fastapi import FastAPI
import numpy as np

app = FastAPI(title="ML Pipeline")

@app.post("/predict")
async def predict(features: list[float]):
    arr = np.array(features).reshape(1, -1)
    # Model prediction would go here
    return {"prediction": arr.tolist()}

@app.get("/health")
async def health():
    return {"status": "ok"}
