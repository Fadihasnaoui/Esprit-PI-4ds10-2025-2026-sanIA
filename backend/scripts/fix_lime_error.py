import json
import os

file_path = r'g:/HP/ProjetPi/ProjetPi/notebooks/treatment_recommendation.ipynb'

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
            
            # Check for the LIME cell where idx = 0 is defined
            if any('idx = 0' in line for line in source) and any('explain_instance' in line for line in source):
                print(f"Found LIME cell at index {i}")
                
                # We need to construct the new source with correct index access
                # The issue is X_test.iloc[idx] might be failing if X_test has non-integer index or if idx=0 doesn't exist?
                # Actually, X_test is usually a DataFrame. iloc[0] gets the first row regardless of index.
                # However, the error is KeyError: 0. This implies .loc[0] was used or .iloc on something weird?
                # The code says X_test.iloc[idx].
                # Wait, if X_test is a numpy array, .iloc doesn't exist.
                # If X_test is a DataFrame, .iloc[0] is valid.
                
                # Ah, the error might be in y_test[idx]. y_test might be a Series with non-sequential index.
                # If y_test was split standardly, its index is shuffled.
                # So y_test[0] tries to find label with INDEX 0, which might not be in the test set.
                # We should use y_test.iloc[idx] if it's a series, or just make sure we access strictly by position.
                
                # Standard fix: explicitly cast to numpy array or use .iloc for pandas objects.
                # But y_test is usually a numpy array if it came from label encoder fit_transform?
                # Let's check Phase 2 code.
                # y = target_le.fit_transform(y) -> y is numpy array.
                # then train_test_split.
                # So y_test is a numpy array. Accessing [0] is fine.
                
                # What about X_test?
                # X_test comes from DataFrame.
                
                # Wait, the traceback says: pandas/core/indexes/base.py ... get_loc(key) ... KeyError: 0
                # This usually happens with .loc[0] when 0 is not in index.
                # But the code says .iloc[idx].
                
                # Let's verify the user code in the snippet provided:
                # "exp = lime_explainer.explain_instance(X_test.iloc[idx], ...)"
                
                # Maybe the user modified it to .loc? Or X_test is something else?
                # Let's modify the code to be robust. 
                # We will use .iloc[0] for X_test (which is correct for DF)
                # And ensure y_test access is safe.
                
                # WAIT! If the user ran the cell multiple times or modified X_test?
                
                # Let's just fix the y_test access just in case it was converted to Series elsewhere?
                # Or maybe X_test became an array? If array, .iloc fails with AttributeError, not KeyError.
                
                # The traceback "KeyError: 0" in pandas index usually points to label-based access failure.
                # Does `lime_explainer.explain_instance` do something internally?
                # It calls something that triggers this.
                
                # Actually, look at the error again.
                # "File c:\...\pandas\core\indexes\base.py... get_loc(key)... KeyError: 0"
                # This confirms we are looking for label '0' and not finding it.
                
                # If X_test is a DataFrame, lime might be trying to access it.
                # Lime handles numpy arrays best.
                # In the previous cell (Phase 2), X was a DataFrame.
                # lime definition: training_data=np.array(X_train) -> Numpy array.
                # explain_instance(X_test.iloc[idx], ...) -> DataFrame Row (Series).
                
                # If we pass a Series to explain_instance, LIME might convert it or use its index.
                # If LIME tries to access feature names from the Series and fails?
                
                # Safest bet: Convert input to numpy array `.values`.
                
                new_source = [
                    "lime_explainer = lime.lime_tabular.LimeTabularExplainer(\n",
                    "    training_data=np.array(X_train),\n",
                    "    feature_names=features,\n",
                    "    class_names=target_le.classes_,\n",
                    "    mode='classification'\n",
                    ")\n",
                    "\n",
                    "# Explain the 1st test instance\n",
                    "idx = 0\n",
                    "# Use .values to pass a numpy array to avoid pandas indexing issues\n",
                    "exp = lime_explainer.explain_instance(X_test.iloc[idx].values, best_model.predict_proba, num_features=5)\n",
                    "\n",
                    "# Ensure y_test access is robust (handle if it's series or array)\n",
                    "true_label = y_test[idx] if isinstance(y_test, np.ndarray) else y_test.iloc[idx]\n",
                    "print(f\"True Label: {target_le.inverse_transform([true_label])[0]}\")\n",
                    "exp.show_in_notebook(show_table=True)"
                ]
                
                cell['source'] = new_source
                modified = True
                print("Replaced LIME cell content with robust indexing.")
                break

    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=1)
        print("Notebook updated successfully.")
    else:
        print("No matching LIME cell found.")

except Exception as e:
    print(f"Error processing notebook: {e}")
