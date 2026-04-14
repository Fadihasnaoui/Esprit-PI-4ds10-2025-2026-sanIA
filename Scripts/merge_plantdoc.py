"""
merge_plantdoc.py
-----------------
Copies PlantDoc (archive (1)) images into the existing Split_Dataset
folder structure, split 80% train / 10% val / 10% test.
Renames files with a 'pd_' prefix to avoid collisions with PlantVillage files.
"""
import shutil
import random
from pathlib import Path

random.seed(42)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PLANTDOC_TRAIN = PROJECT_ROOT / "Data" / "archive (1)" / "train"
PLANTDOC_TEST  = PROJECT_ROOT / "Data" / "archive (1)" / "test"
SPLIT_DATASET  = PROJECT_ROOT / "Data" / "Processed" / "Split_Dataset"

# PlantDoc folder name → your Split_Dataset class name
MAPPING = {
    "Apple_Scab_Leaf":          "Apple___Apple_scab",
    "Apple_rust_leaf":          "Apple___Cedar_apple_rust",
    "Apple_leaf":               "Apple___healthy",
    "grape_leaf":               "Grape___healthy",
    "grape_leaf_black_rot":     "Grape___Black_rot",
    "Potato_leaf_early_blight": "Potato___Early_blight",
    "Potato_leaf_late_blight":  "Potato___Late_blight",
    "Tomato_Early_blight_leaf": "Tomato___Early_blight",
    "Tomato_leaf":              "Tomato___healthy",
    "Tomato_leaf_bacterial_spot": "Tomato___Bacterial_spot",
    "Tomato_leaf_late_blight":  "Tomato___Late_blight",
}

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}

def collect_images(plantdoc_class: str) -> list[Path]:
    """Gather all images for a class from both PlantDoc train and test splits."""
    images = []
    for base in [PLANTDOC_TRAIN, PLANTDOC_TEST]:
        cls_dir = base / plantdoc_class
        if cls_dir.exists():
            images += [f for f in cls_dir.iterdir() if f.suffix in IMAGE_EXTS]
    return images

def copy_split(images: list[Path], target_class: str, split: str, offset: int):
    dest_dir = SPLIT_DATASET / split / target_class
    dest_dir.mkdir(parents=True, exist_ok=True)
    for i, src in enumerate(images):
        dest = dest_dir / f"pd_{offset + i:04d}{src.suffix.lower()}"
        shutil.copy2(src, dest)
    return len(images)

total_added = {"train": 0, "val": 0, "test": 0}

print(f"{'Class':<45} {'Total':>6}  {'Train':>6}  {'Val':>5}  {'Test':>5}")
print("-" * 75)

for pd_class, target_class in MAPPING.items():
    images = collect_images(pd_class)
    if not images:
        print(f"  WARNING: no images found for {pd_class}")
        continue

    random.shuffle(images)
    n = len(images)
    n_val  = max(1, int(n * 0.10))
    n_test = max(1, int(n * 0.10))
    n_train = n - n_val - n_test

    train_imgs = images[:n_train]
    val_imgs   = images[n_train:n_train + n_val]
    test_imgs  = images[n_train + n_val:]

    # Use a large offset so filenames never clash with existing pd_ files
    offset = 9000
    copy_split(train_imgs, target_class, "train", offset)
    copy_split(val_imgs,   target_class, "val",   offset + n_train)
    copy_split(test_imgs,  target_class, "test",  offset + n_train + n_val)

    total_added["train"] += len(train_imgs)
    total_added["val"]   += len(val_imgs)
    total_added["test"]  += len(test_imgs)

    print(f"  {target_class:<43} {n:>6}  {len(train_imgs):>6}  {len(val_imgs):>5}  {len(test_imgs):>5}")

print("-" * 75)
print(f"  {'TOTAL ADDED':<43} {sum(total_added.values()):>6}  {total_added['train']:>6}  {total_added['val']:>5}  {total_added['test']:>5}")
print("\nDone. Recount train images to update STEPS_PER_EPOCH in config.py.")
