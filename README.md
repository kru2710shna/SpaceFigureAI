# 🪐 Space Designer – Agentic AI Interior & Framing Assistant

**Space Designer** is an **Agentic AI Interior & Framing Assistant** that autonomously transforms photos, blueprints, or room dimensions into personalized design layouts.

It combines **NVIDIA NIM Vision** and **Llama-3 reasoning models** on **AWS SageMaker** to understand spaces, retrieve matching furniture and décor, and justify every design choice using real architectural and aesthetic principles.

Users can iteratively refine results through feedback, enabling the system to adapt to personal taste, style, and budget.  
The system bridges **architecture**, **aesthetics**, and **AI autonomy**, offering an end-to-end experience — from space analysis to actionable design plans.

---

## 🌐 Core Workflow

**Step 1. User Input:**  
User uploads **360° or 180° room photos** or blueprints. The system analyzes spatial structure, lighting, and existing objects.

**Step 2. Multi-Agent Collaboration:**  
Each specialized agent performs one role — ensuring precision, modularity, and no redundant computation.

---

## 🧩 Agent Architecture

### 🧠 Designer Agent
- Responsible for **shopping, research, and trend analysis**.  
- Understands **user preferences** and retrieves both **new** and **classic** interior styles.  
- Blends **Gen-Z**, **contemporary**, **emerging**, and **traditional** furniture looks.  
- Asks **contextual questions** upfront and compiles user insights + aesthetic research.

---

### 🧭 Tour Guide Agent
- Examines the uploaded room.  
- Detects **room type**, **orientation (N/E/S/W)**, **ceiling height**, **flooring**, **lighting**, **fans**, and existing fixtures.  
- Uses **NVIDIA NIM Vision** for segmentation, depth analysis, and object recognition.  
- Produces a **room scan JSON** describing geometry and features.

---

### 🧮 Mathematical Agent
- Performs **precise spatial reasoning** and **unit conversions**.  
- Calculates **approximate measurements**, converts inches ↔ cm, and fills missing data where inferable.  
- Validates dimensional consistency and stores all metrics in a structured schema.  
- Provides quantitative foundations for layout mapping.

---

### 🗺️ Mapping Agent
- Combines **Tour Guide** geometry + **Mathematical** metrics + **Designer** aesthetics.  
- Generates a **canonical map** that the Architect Agent can interpret.  
- Leaves blanks for unknowns, auto-fills calculable fields, and structures data cleanly for reasoning models.  
- Acts as the bridge between spatial understanding and design execution.

---

### 🧰 Contractor Agent
- Retrieves all **compatible furniture and materials** from internal databases (S3 storage, DynamoDB, or vector search).  
- Uses **Designer Agent**’s style embedding to ensure aesthetic coherence.  
- Produces a **bill of materials (BOM)** with items, prices, dimensions, and supplier links.  
- Filters only items that **physically fit** and match the project’s constraints.

---

### 🏗️ Architect Agent
- Synthesizes the final **layout plan**.  
- Uses **Llama-3 reasoning** to interpret design goals, floor dimensions, and contractor items.  
- Builds structured placement logic while respecting **ergonomic and spatial codes** (clearances, door swings, traffic flow).  
- Outputs a detailed **architectural blueprint JSON** with rationale.

---

### 🧪 Validator Agent *(Added for precision)*
- Ensures layout feasibility:
  - Checks clearances, overlaps, and light distribution.
  - Recalculates dimensions via the Mathematical Agent.
  - Ensures total cost ≤ budget and aesthetic consistency.
- If issues are found, sends refinement feedback to the Architect Agent.

---

### 🎨 Pitcher Agent
- Converts architectural layouts into **3D visualizations** and **2D annotated blueprints**.  
- Uses **Three.js** or **Blender APIs** to produce interactive renders and moodboards.  
- Packages output into shareable URLs, PDFs, or dashboards.  
- Serves as the presentation layer of Space Designer.

---

### 🔁 Feedback Agent
- Gathers **user feedback** (“make it brighter”, “swap to Japandi style”, “add workspace”).  
- Routes deltas back to the **Designer** and **Architect Agents** for iterative refinement.  
- Maintains a **Preference Memory** for personalization in future sessions.

---

## 🧩 Extended Agents (Optional)
| Agent | Purpose |
|--------|----------|
| **Lighting Agent** | Optimizes natural/artificial light balance via HDR estimation. |
| **Sustainability Agent** | Computes eco-score and material recyclability for sourced items. |
| **Cost Optimizer Agent** | Minimizes total cost under design and delivery constraints. |

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-------------|
| **Model Hosting** | AWS SageMaker (Llama-3, NVIDIA NIM Vision) |
| **Data Storage** | Amazon S3, DynamoDB, OpenSearch Vector DB |
| **Backend** | Python (FastAPI / Lambda), Step Functions orchestration |
| **Frontend** | React or Next.js for Web; Three.js for visualization |
| **Retrieval Layer** | OpenSearch KNN + furniture metadata |
| **Logging / Monitoring** | CloudWatch + DynamoDB state tracker |

---

## 🧭 Workflow Overview

1. **User Upload →** 360° image or blueprint.  
2. **Tour Guide Agent →** Extract geometry + environment metadata.  
3. **Mathematical Agent →** Quantify dimensions and fill missing values.  
4. **Mapping Agent →** Combine structure + math + aesthetics.  
5. **Designer Agent →** Curate style and trend direction.  
6. **Contractor Agent →** Fetch fitting inventory.  
7. **Architect Agent →** Generate architectural layout.  
8. **Validator Agent →** Check feasibility & refine.  
9. **Pitcher Agent →** Render 3D/2D visuals.  
10. **Feedback Agent →** Learn from user refinements and update memory.

---

## 🧱 Repository Structure

```
SpaceFigureAI/
├── agents/
│   ├── intake_agent.py
│   ├── tour_guide_agent.py
│   ├── designer_agent.py
│   ├── mathematical_agent.py
│   ├── mapping_agent.py
│   ├── contractor_agent.py
│   ├── architect_agent.py
│   ├── validator_agent.py
│   ├── pitcher_agent.py
│   └── feedback_agent.py
│
├── core/
│   ├── agent_base.py
│   ├── orchestrator.py
│   ├── registry.py
│   ├── config.py
│   └── utils.py
│
├── data/
├── logs/
├── outputs/
├── tests/
├── main.py
└── requirements.txt
```

---

## 🚀 Future Enhancements
- Voice-based design feedback loop (“make this more cozy”).  
- Integration with AR/VR visualization tools.  
- Generative texture & color harmonization using diffusion models.  
- Multi-room project handling and automatic budget scaling.  
- Autonomous vendor integration for direct purchase or quotation.

---

## 🧩 Contributors
- **Krushna Thakkar** – Lead Developer & Architect  
- Agentic AI Unleashed Hackathon Team – AWS × NVIDIA

---

## 🪄 License
MIT License © 2025 Krushna Thakkar  
This project is developed for the **AWS × NVIDIA Agentic AI Hackathon** and will be expanded post-event for open research and design automation.
