from ultralytics import YOLO
import sys

print("Téléchargement de YOLOv8 Medium (Haute Précision)...")
model = YOLO("yolov8m.pt")
print("Exportation vers ONNX...")
model.export(format="onnx", imgsz=640)
print("Succès ! yolov8m.onnx prêt.")
