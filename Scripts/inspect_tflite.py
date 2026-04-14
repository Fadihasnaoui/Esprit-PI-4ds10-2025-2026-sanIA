import tensorflow as tf

def inspect_model(model_path):
    try:
        interpreter = tf.lite.Interpreter(model_path=model_path)
        interpreter.allocate_tensors()

        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()

        print(f"Input Shape: {input_details[0]['shape']}")
        print(f"Input Type: {input_details[0]['dtype']}")
        print(f"Output Shape: {output_details[0]['shape']}")
        print(f"Output Type: {output_details[0]['dtype']}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_model("c:/Users/fadih/Desktop/ProjetPi/crop_disease_detection/models/best_model_fixed.tflite")
