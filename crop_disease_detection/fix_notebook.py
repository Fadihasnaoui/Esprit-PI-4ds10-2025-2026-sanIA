import json
from pathlib import Path

notebook_path = Path(r"c:\Users\fadih\Desktop\ProjetPi\crop_disease_detection\TDSP_Crop_Disease_Detection.ipynb")

with open(notebook_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Find the cell containing the SHAP code
target_string = "shap.image_plot(shap_values[pred_idx]"
for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        source = "".join(cell['source'])
        if target_string in source:
            print(f"Found cell {cell.get('id', 'unknown')}")
            
            # Prepare new source
            new_source = []
            for line in cell['source']:
                if "pred_idx = np.argmax(model.predict" in line:
                    new_source.append("    pred_idx = np.argmax(model.predict(test_image[np.newaxis, ...], verbose=0))\n")
                elif "shap.image_plot(shap_values[pred_idx]" in line:
                    new_source.append("    # Robust indexing for SHAP values (Keras 3 returns a single array with class as last dim)\n")
                    new_source.append("    if isinstance(shap_values, list):\n")
                    new_source.append("        current_shap = shap_values[pred_idx]\n")
                    new_source.append("    else:\n")
                    new_source.append("        current_shap = shap_values[..., pred_idx]\n")
                    new_source.append("\n")
                    new_source.append("    shap.image_plot(current_shap, test_image[np.newaxis, ...], show=False)\n")
                elif "ax[1].imshow(np.abs(shap_values[pred_idx][0])" in line:
                    new_source.append("    ax[1].imshow(np.abs(current_shap[0]).sum(axis=-1), cmap='hot')\n")
                else:
                    new_source.append(line)
            
            cell['source'] = new_source
            break

with open(notebook_path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print("Notebook updated successfully.")
