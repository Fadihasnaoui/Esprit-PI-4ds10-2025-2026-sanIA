import os
import sys
import urllib.request
import subprocess
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# URL du modèle GGUF (Labess-7b - excellent pour la Darija tunisienne)
MODEL_URL = "https://huggingface.co/linagora/Labess-7b-chat-gguf/resolve/main/unsloth.Q4_K_M.gguf"
MODEL_FILENAME = "unsloth.Q4_K_M.gguf"
OLLAMA_MODEL_NAME = "llama3-darija"

def download_file(url: str, dest_path: Path):
    if dest_path.exists():
        logger.info(f"Le fichier {dest_path.name} existe déjà. Téléchargement ignoré.")
        return

    logger.info(f"Téléchargement du modèle depuis HuggingFace (~4GB). Cela peut prendre du temps...")
    # Progress hook function
    def report_hook(count, block_size, total_size):
        percent = int(count * block_size * 100 / total_size)
        sys.stdout.write(f"\rTéléchargement en cours... {percent}%")
        sys.stdout.flush()

    try:
        urllib.request.urlretrieve(url, filename=dest_path, reporthook=report_hook)
        print("\nTéléchargement terminé !")
    except Exception as e:
        logger.error(f"Erreur lors du téléchargement : {e}")
        sys.exit(1)

def create_ollama_model(gguf_path: Path):
    modelfile_path = Path("Modelfile_Darija")
    
    # Création du Modelfile avec les instructions appropriées pour le Tunisien
    modelfile_content = f"""FROM ./{gguf_path.name}

# Paramètres du modèle
PARAMETER temperature 0.3
PARAMETER top_p 0.9

# Prompt système de base pour forcer le dialecte tunisien
SYSTEM \"\"\"أنت مساعد زراعي ذكي لمنصة Sania AgriSmart في تونس. 
يجب عليك دائماً الإجابة باللهجة التونسية (الدارجة) بوضوح واحترافية. 
لا تستخدم لغة أخرى إلا إذا سألك المستخدم بوضوح بلغة أخرى.\"\"\"
"""
    modelfile_path.write_text(modelfile_content, encoding="utf-8")
    logger.info(f"Fichier {modelfile_path.name} créé.")

    logger.info(f"Création du modèle Ollama '{OLLAMA_MODEL_NAME}' ...")
    try:
        # Exécution de la commande 'ollama create'
        result = subprocess.run(
            ["ollama", "create", OLLAMA_MODEL_NAME, "-f", str(modelfile_path)],
            check=True,
            capture_output=True,
            text=True
        )
        logger.info("Modèle créé avec succès dans Ollama !")
        logger.info(result.stdout)
    except subprocess.CalledProcessError as e:
        logger.error(f"Erreur lors de la création du modèle Ollama : {e.stderr}")
    except FileNotFoundError:
        logger.error("La commande 'ollama' est introuvable. Veuillez vous assurer qu'Ollama est installé et ajouté au PATH.")

if __name__ == "__main__":
    logger.info("=== Préparation du Modèle Darija ===")
    downloads_dir = Path(__file__).parent.parent / "models"
    downloads_dir.mkdir(exist_ok=True, parents=True)
    
    gguf_path = downloads_dir / MODEL_FILENAME
    
    # 1. Téléchargement
    download_file(MODEL_URL, gguf_path)
    
    # 2. Création et import dans Ollama
    # On se déplace dans le dossier contenant le modèle pour que 'ollama create' trouve le fichier relatif
    os.chdir(downloads_dir)
    create_ollama_model(gguf_path)
    
    logger.info(f"Terminé. Vous pouvez maintenant utiliser '{OLLAMA_MODEL_NAME}' dans votre application.")