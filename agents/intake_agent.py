# agents/intake_agent.py
import torch
from transformers import AutoProcessor, AutoModelForVision2Seq

class IntakeAgent:
    def __init__(self, model_name="liuhaotian/llava-v1.6-vicuna-7b"):
        print("[IntakeAgent] Loading LLaVA model...")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.processor = AutoProcessor.from_pretrained(model_name)
        self.model = AutoModelForVision2Seq.from_pretrained(model_name).to(self.device)
        print("[IntakeAgent] Model loaded successfully.")

    def analyze_image(self, image_path: str) -> dict:
        print(f"[IntakeAgent] Analyzing: {image_path}")
        inputs = self.processor(images=image_path, text="Describe this image.", return_tensors="pt").to(self.device)
        output = self.model.generate(**inputs, max_new_tokens=100)
        caption = self.processor.batch_decode(output, skip_special_tokens=True)[0]

        # Generate follow-up question
        question = f"What would you like to do with this space? ({caption})"

        return {
            "caption": caption,
            "question": question
        }
