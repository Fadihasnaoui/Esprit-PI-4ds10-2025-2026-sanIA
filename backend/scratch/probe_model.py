import onnxruntime as ort
import os

model_path = r"g:\HP\ProjetPi\ProjetPi\backend\app\ml_logic\notebooks\svi_farm_ready.onnx"

if not os.path.exists(model_path):
    print("Model not found")
else:
    session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    inputs = session.get_inputs()
    outputs = session.get_outputs()
    
    print(f"Input Node: {inputs[0].name}, Shape: {inputs[0].shape}")
    print(f"Output Node: {outputs[0].name}, Shape: {outputs[0].shape}")
