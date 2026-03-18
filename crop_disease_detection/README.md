# Crop Disease Detection — DSO

> **ESPRIT School of Engineering** · 4DS10 · 2025–2026  
> Methodology: **Team Data Science Process (TDSP)**

---

## 📁 DSO Directory Structure

```
crop_disease_detection/
│
├── 📓 TDSP_Crop_Disease_Detection.ipynb   ← MAIN NOTEBOOK (all 5 TDSP phases)
│
├── src/                                   ← Python modules (imported by notebook)
│   ├── config.py          · Centralized paths & hyperparameters
│   ├── data_loader.py     · Balanced train loader + eval loader
│   ├── model_factory.py   · CNN factory (MobileNetV3, EfficientNetB0, ResNet50V2)
│   ├── trainer.py         · Two-phase training loop + benchmark runner
│   └── split_dataset.py   · Train / Val / Test split utility
│
├── models/                                ← Model artifacts
│   ├── plant_disease_model.h5             · Keras full model (best)
│   ├── plant_disease_model.tflite         · Mobile-optimized export
│   └── benchmark/                         · Per-arch .h5 files from benchmark
│
├── reports/                               ← Auto-generated outputs
│   ├── figures/                           · All plots saved as PNG
│   │   ├── class_distribution.png
│   │   ├── sample_images.png
│   │   ├── augmented_batch.png
│   │   ├── image_resolution_dist.png
│   │   ├── learning_curves.png
│   │   ├── benchmark_comparison.png
│   │   ├── confusion_matrix.png
│   │   ├── per_class_accuracy.png
│   │   └── tflite_latency.png
│   ├── logs/                              · Timestamped training logs (.log)
│   └── final_model_comparison.csv        · Benchmark table (all architectures)
│
└── data/
    └── README_data.md                     · Dataset reference (→ Data/Processed/)
```

## 🚀 How to Run

```bash
cd crop_disease_detection
jupyter notebook TDSP_Crop_Disease_Detection.ipynb
```

Run the cells **top to bottom**. Each TDSP phase is clearly separated.

## 📊 TDSP Phases Covered

| Phase | Notebook Section | Key Outputs |
|---|---|---|
| 1 · Business Understanding | `Phase 1` | Project charter, KPI table |
| 2 · Data Acquisition & Understanding | `Phase 2` | Distribution plots, sample grid, augmented batch |
| 3 · Modeling | `Phase 3` | Learning curves, confusion matrix, benchmark table |
| 4 · Deployment | `Phase 4` | TFLite export, latency profile, inference validation |
| 5 · Customer Acceptance | `Phase 5` | KPI check, deliverables checklist |

## 🏗️ Architecture Decision

Three CNN backbones are benchmarked on the same dataset:

| Architecture | Strength |
|---|---|
| **MobileNetV3Large** | Ultra-lightweight, best for edge/mobile |
| **EfficientNetB0** | Best accuracy-to-parameter ratio |
| **ResNet50V2** | Deepest, strongest feature extractor |

The winning model is automatically selected by a **weighted deployment score**  
(Accuracy 60 % · Size 20 % · Latency 20 %) and exported to `.tflite`.
