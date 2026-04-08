import json
import os

nb_path = r'c:\Users\bouda\Desktop\ProjetPi 5\ProjetPi 4\ProjetPi\irrigation\Smart_Irrigation_v3_1_Final_Benchmark.ipynb'
with open(nb_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# The base path for the current user
base_path = r'c:/Users/bouda/Desktop/ProjetPi 5/ProjetPi 4/ProjetPi'

found = 0
for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        new_source = []
        for line in cell['source']:
            original_line = line
            # Replace the old hardcoded machine path with the current user's absolute path
            if 'c:/Users/21658/Desktop/ProjetPi' in line:
                line = line.replace('c:/Users/21658/Desktop/ProjetPi', base_path)
            
            # Also catch the relative paths I might have introduced partially
            if 'Path("../Data/' in line:
                line = line.replace('../Data/', base_path + '/Data/')
            if 'Path("../Models/' in line:
                line = line.replace('../Models/', base_path + '/Models/')
                
            if line != original_line:
                found += 1
            new_source.append(line)
        cell['source'] = new_source

if found > 0:
    with open(nb_path, 'w', encoding='utf-8') as f:
        json.dump(nb, f, indent=1)
    print(f"Successfully replaced {found} occurrences.")
else:
    print("No paths found for replacement.")
