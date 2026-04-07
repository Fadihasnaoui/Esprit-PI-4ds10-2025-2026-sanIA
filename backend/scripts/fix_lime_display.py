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
            
            # Check for LIME visualization cell
            if any('exp.show_in_notebook' in line for line in source):
                print(f"Found LIME visualization cell at index {i}")
                
                # Replace the show_in_notebook call with direct display(HTML(...))
                # We need to import display and HTML from IPython.display instead of IPython.core.display
                
                new_source = []
                # Keep the setup part
                lime_setup_found = False
                for line in source:
                    if 'lime_explainer =' in line:
                         lime_setup_found = True
                    if 'exp.show_in_notebook' in line:
                        # Replace this line with the fix
                        new_source.append("# Fix for ImportError: cannot import name 'display' from 'IPython.core.display'\n")
                        new_source.append("from IPython.display import display, HTML\n")
                        new_source.append("display(HTML(exp.as_html(show_table=True)))\n")
                    else:
                        new_source.append(line)
                
                if lime_setup_found:
                     cell['source'] = new_source
                     modified = True
                     print("Replaced LIME visualization method.")
                     break

    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=1)
        print("Notebook updated successfully.")
    else:
        print("No matching LIME visualization cell found.")

except Exception as e:
    print(f"Error processing notebook: {e}")
