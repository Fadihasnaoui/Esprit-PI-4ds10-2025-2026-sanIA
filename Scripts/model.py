import tensorflow as tf
import logging
from config import *
from data_loader import build_balanced_train_loader, build_standard_evaluation_loader

# Logging configuration
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def build_mobilenet_model(num_classes):
    """
    Constructs a MobileNetV3Large model optimized for deployment.
    """
    base_model = tf.keras.applications.MobileNetV3Large(
        input_shape=INPUT_SHAPE,
        include_top=False,
        weights='imagenet'
    )
    
    base_model.trainable = False
    
    inputs = tf.keras.Input(shape=INPUT_SHAPE)
    x = tf.keras.applications.mobilenet_v3.preprocess_input(inputs)
    x = base_model(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(num_classes, activation='softmax')(x)
    
    model = tf.keras.Model(inputs, outputs)
    
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=PHASE_1_LR),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(),
        metrics=['accuracy']
    )
    
    return model, base_model

if __name__ == "__main__":
    logging.info("--- 1. LOADING DATA ---")
    train_loader, classes = build_balanced_train_loader(TRAIN_DIR, batch_size=BATCH_SIZE)
    val_loader = build_standard_evaluation_loader(VAL_DIR, batch_size=BATCH_SIZE)
    
    logging.info(f"Discovered {len(classes)} distinct classes.")
    
    logging.info("--- 2. BUILDING MOBILENETV3 ---")
    model, base_model = build_mobilenet_model(num_classes=NUM_CLASSES)
    
    logging.info("--- 3. STARTING PHASE 1 TRAINING ---")
    model.fit(
        train_loader,
        steps_per_epoch=STEPS_PER_EPOCH,
        validation_data=val_loader,
        epochs=PHASE_1_EPOCHS
    )
    
    logging.info("--- 4. STARTING PHASE 2: FINE-TUNING ---")
    base_model.trainable = True
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=PHASE_2_LR),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(),
        metrics=['accuracy']
    )
    
    model.fit(
        train_loader,
        steps_per_epoch=STEPS_PER_EPOCH,
        validation_data=val_loader,
        epochs=PHASE_2_EPOCHS
    )

    logging.info("--- 5. SAVING THE MODEL ---")
    keras_path = MODELS_DIR / "plant_disease_model.keras"
    model.save(keras_path)
    logging.info(f"Model saved to: {keras_path}")
    
    # TFLite Conversion
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    tflite_model = converter.convert()
    tflite_path = MODELS_DIR / "plant_disease_model.tflite"
    with open(tflite_path, 'wb') as f:
        f.write(tflite_model)
    logging.info(f"TFLite model saved to: {tflite_path}")
