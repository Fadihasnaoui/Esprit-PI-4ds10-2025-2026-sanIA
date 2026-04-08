import json
import os

nb_path = r'c:\Users\bouda\Desktop\ProjetPi 5\ProjetPi 4\ProjetPi\irrigation\Smart_Irrigation_v3_1_Final_Benchmark.ipynb'
with open(nb_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

old_real = 'REAL_DATA_PATH = Path(r"c:/Users/21658/Desktop/ProjetPi/Data/irrigation/irrigation_dataset_2_years(in).csv")'
new_real = 'REAL_DATA_PATH = Path("../Data/irrigation/irrigation_dataset_2_years(in).csv")'

old_syn = 'SYN_DATA_PATH  = Path(r"c:/Users/21658/Desktop/ProjetPi/Data/tunisia_dataset.csv")'
new_syn = 'SYN_DATA_PATH  = Path("../Data/tunisia_dataset.csv")'

old_art = 'ARTIFACT_DIR   = Path(r"c:/Users/21658/Desktop/ProjetPi/Models/irrigation")'
new_art = 'ARTIFACT_DIR   = Path("../Models/irrigation")'

found = 0
for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        for i, line in enumerate(cell['source']):
            if old_real in line:
                cell['source'][i] = line.replace(old_real, new_real)
                found += 1
            if old_syn in line:
                cell['source'][i] = line.replace(old_syn, new_syn)
                found += 1
            if old_art in line:
                cell['source'][i] = line.replace(old_art, new_art)
                found += 1

if found > 0:
    with open(nb_path, 'w', encoding='utf-8') as f:
        json.dump(nb, f, indent=1)
    print(f"Successfully replaced {found} paths.")
else:
    print("No paths found for replacement.")
