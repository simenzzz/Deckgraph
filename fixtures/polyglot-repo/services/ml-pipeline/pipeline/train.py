import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

def train_model(data: np.ndarray, labels: np.ndarray):
    X_train, X_test, y_train, y_test = train_test_split(
        data, labels, test_size=0.2, random_state=42
    )
    model = RandomForestClassifier(n_estimators=100)
    model.fit(X_train, y_train)
    score = model.score(X_test, y_test)
    return model, score
