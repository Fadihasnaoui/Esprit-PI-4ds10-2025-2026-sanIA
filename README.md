# Sania AgriSmart – Precision Agriculture Platform

## Overview
This project was developed as part of the PIDEV – 4th Year Engineering Program at **Esprit School of Engineering** (Academic Year 2025–2026).
It consists of an integrated AI-powered platform for precision agriculture, featuring automated crop disease detection, irrigation forecasting, and a digital twin monitor to help Tunisian farmers optimize yield and reduce losses.

## Features
- **🌿 Crop Disease Detection:** Real-time identification of 15+ plant diseases using Deep Learning (CNNs), deployable offline via TFLite.
- **📊 TDSP Pipeline:** Full data science lifecycle following the Team Data Science Process (Business Understanding to Deployment).
- **💧 Irrigation Forecasting:** Predictive analytics for water management based on environmental data.
- **🏗️ Digital Twin:** Interactive visualization of farm health and livestock monitoring.
- **📱 Multi-platform Deployment:** REST API for web access and lightweight models for mobile edge devices.

## Tech Stack
### Frontend
- React.js
- TypeScript
- Tailwind CSS
- Recharts & Leaflet (Mapping)

### Backend
- FastAPI (Python)
- PostgreSQL
- SQLAlchemy (ORM)
- Docker & Docker Compose

### AI & Data Science
- TensorFlow / Keras
- MobileNetV3, EfficientNet, ResNet
- Pandas, NumPy, Scikit-learn
- Seaborn & Matplotlib

## Architecture
```text
ProjetPi/
│
├── 🌿 crop_disease_detection/      ← AI DSO: Crop Disease Detection
│   ├── TDSP_Crop_Disease_Detection.ipynb  ← MAIN NOTEBOOK (5 TDSP phases)
│   ├── src/                       ← Python source (models, trainer, config)
│   ├── models/                    ← Trained model artifacts (.keras, .tflite)
│   └── reports/figures/           ← Auto-generated analysis plots
│
├── backend/                        ← FastAPI REST API
├── website/                        ← React Frontend
├── Data/                           ← Shared datasets (Raw, Processed)
├── DigitalTwin/                    ← Digital Twin module
├── docker-compose.yml              ← Full-stack orchestration
└── README.md                       ← This file
```

## Contributors
- **4DS10 AI/ML Team** — Esprit School of Engineering

## Academic Context
Developed at **Esprit School of Engineering – Tunisia**
PIDEV – 4A | 2025–2026

## Acknowledgments
- Supervisors and Faculty at **Esprit School of Engineering**.
- The open-source community for providing the underlying deep learning and web frameworks.
