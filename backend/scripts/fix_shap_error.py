import json
import os

file_path = r'c:/Users/21658/Desktop/ProjetPi/notebooks/treatment_recommendation.ipynb'

if not os.path.exists(file_path):
    print(f"Error: File not found at {file_path}")
    exit(1)

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    modified = False
    for i, cell in enumerate(data['cells']):
        if cell.get('cell_type') == 'code':
            source = cell.get('source', [])
            # Convert list of strings to single string for easier matching if needed, 
            # but comparing line by line is safer for JSON structure preservation.
            
            # Check if this is the SHAP cell
            if any('shap.TreeExplainer(best_model)' in line for line in source):
                print(f"Found SHAP cell at index {i}")
                
                new_source = [
                    "# TreeExplainer does not support multi-class GradientBoostingClassifier, so we use KernelExplainer\n",
                    "# We summarize the background data using k-means to speed up computation\n",
                    "X_train_summary = shap.kmeans(X_train, 10)\n",
                    "explainer = shap.KernelExplainer(best_model.predict_proba, X_train_summary)\n",
                    "shap_values = explainer.shap_values(X_test)\n",
                    "\n",
                    "# Summary Plot\n",
                    "plt.figure(figsize=(10, 6))\n",
                    "shap.summary_plot(shap_values, X_test, feature_names=features, plot_type=\"bar\")"
                ]
                
                cell['source'] = new_source
                modified = True
                print("Replaced SHAP cell content.")
                # We can stop after finding the first match
                break

    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=1)
        print("Notebook updated successfully.")
    else:
        print("No matching SHAP cell found.")

except Exception as e:
    print(f"Error processing notebook: {e}")
