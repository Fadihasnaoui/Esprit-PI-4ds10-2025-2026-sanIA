import os
import io
import asyncio
import base64
from typing import List, Dict, Any, AsyncGenerator
from PIL import Image
from pypdf import PdfReader
from langchain_ollama import ChatOllama
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

class AIService:
    def __init__(self):
        print("🤖 Initializing AIService with Ollama (Llava)...")
        self.model_name = "llava"
        self.chat_model = ChatOllama(model=self.model_name)
        
        print("📥 Loading local embeddings (HuggingFace)... This may take a moment on first run.")
        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        print("✅ AIService initialized successfully.")
        
        self.user_knowledge_bases: Dict[str, FAISS] = {}
        self.user_documents: Dict[str, List[str]] = {}
        self.user_images: Dict[str, List[Dict[str, Any]]] = {}

    def _get_b64_image(self, image_path: str) -> str:
        with open(image_path, "rb") as img_file:
            return base64.b64encode(img_file.read()).decode('utf-8')

    async def process_document(self, file_path: str, user_id: str):
        file_ext = os.path.splitext(file_path)[1].lower()
        if file_ext == ".pdf":
            await self._process_pdf(file_path, user_id)
        elif file_ext in [".jpg", ".jpeg", ".png"]:
            await self._process_image(file_path, user_id)


    async def _process_pdf(self, file_path: str, user_id: str):
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
        chunks = text_splitter.split_text(text)
        
        if user_id not in self.user_knowledge_bases:
            self.user_knowledge_bases[user_id] = FAISS.from_texts(chunks, self.embeddings)
        else:
            self.user_knowledge_bases[user_id].add_texts(chunks)
            
        if user_id not in self.user_documents:
            self.user_documents[user_id] = []
        self.user_documents[user_id].append(os.path.basename(file_path))

    async def _process_image(self, file_path: str, user_id: str):
        # For local Ollama, we ask Llava to describe the image
        img_b64 = self._get_b64_image(file_path)
        
        msg = HumanMessage(
            content=[
                {"type": "text", "text": "Describe this agricultural image in detail for a farmer, identifying any potential issues, livestock health, or crop state."},
                {"type": "image_url", "image_url": f"data:image/jpeg;base64,{img_b64}"}
            ]
        )
        
        response = self.chat_model.invoke([msg])
        description = response.content
        
        if user_id not in self.user_knowledge_bases:
            self.user_knowledge_bases[user_id] = FAISS.from_texts([description], self.embeddings, metadatas=[{"source": file_path, "type": "image"}])
        else:
            self.user_knowledge_bases[user_id].add_texts([description], metadatas=[{"source": file_path, "type": "image"}])
            
        if user_id not in self.user_images:
            self.user_images[user_id] = []
        self.user_images[user_id].append({"filename": os.path.basename(file_path), "path": file_path})

    async def get_chat_response_stream(self, message: str, history: List[Dict[str, str]], user_id: str) -> AsyncGenerator[str, None]:
        context = ""
        if user_id in self.user_knowledge_bases:
            docs = self.user_knowledge_bases[user_id].similarity_search(message, k=3)
            context = "\n".join([doc.page_content for doc in docs])
        
        system_msg = f"""You are an advanced AI Agri-Advisor and Livestock Expert. 
Analyze the farmer's questions based on the provided context and your knowledge.
Context from uploaded documents:
{context}
"""
        
        # Build message history for Ollama
        msgs = [SystemMessage(content=system_msg)]
        for h in history:
            if h['role'] == 'user':
                msgs.append(HumanMessage(content=h['content']))
            else:
                msgs.append(AIMessage(content=h['content']))
        
        msgs.append(HumanMessage(content=message))
        
        try:
            # Note: Streaming in LangChain Ollama
            async for chunk in self.chat_model.astream(msgs):
                if chunk.content:
                    yield chunk.content
        except Exception as e:
            yield f"\nERROR (Ollama): {str(e)}. Make sure Ollama is running with 'llava' model."

    def get_user_context_info(self, user_id: str) -> Dict[str, Any]:
        return {
            "documents": self.user_documents.get(user_id, []),
            "images_indexed": len(self.user_images.get(user_id, [])),
            "kb_active": user_id in self.user_knowledge_bases,
            "local_model": self.model_name
        }

    def clear_user_context(self, user_id: str):
        self.user_knowledge_bases.pop(user_id, None)
        self.user_documents.pop(user_id, None)
        self.user_images.pop(user_id, None)
