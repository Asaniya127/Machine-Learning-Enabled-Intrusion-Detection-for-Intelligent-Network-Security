# AI-Based Intrusion Detection System Web App

This project implements a real-time web-based intrusion detection system aligned with the research paper:
- Frontend: React + Vite
- Backend: Node.js + Express + Socket.IO
- ML Service: Python + Flask + scikit-learn
- Default deployed model: Random Forest
- Additional models: Logistic Regression and Linear SVM

## Features
- Predict whether network traffic is Normal or Attack
- Compare Logistic Regression, Linear SVM, and Random Forest
- Real-time dashboard updates using Socket.IO
- CSV upload for batch predictions
- Prediction history storage in memory
- Model metrics endpoint
- Clean architecture suitable for research/demo deployment

## Project Structure
```text
ai_ids_webapp/
├── client/
├── server/
├── ml-service/
├── dataset/
└── README.md
```

## 1) ML Service Setup
```bash
cd ml-service
pip install -r requirements.txt
python train_model.py
python app.py
```

## 2) Backend Setup
```bash
cd server
npm install
npm start
```

## 3) Frontend Setup
```bash
cd client
npm install
npm run dev
```

## API Ports
- ML Service: http://localhost:5000
- Backend: http://localhost:4000
- Frontend: http://localhost:5173

## Notes
- Put your NSL-KDD style dataset at `dataset/kdd_test.csv`
- Required columns include:
  - protocol_type
  - service
  - flag
  - labels
- The ML pipeline automatically handles one-hot encoding and scaling.
