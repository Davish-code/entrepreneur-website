from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import os
import json
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Virtual Interview API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key = os.getenv("GROQ_API_KEY", "")
client = OpenAI(
    api_key=api_key,
    base_url="https://api.groq.com/openai/v1",
)

class PromptRequest(BaseModel):
    subject: str
    analysis_report: str

class SandboxEvalRequest(BaseModel):
    code: str
    task_title: str
    task_desc: str
    subject: str

@app.post("/api/generate-interview")
async def generate_interview(request: PromptRequest):
    """
    Generates the dynamic targeted interrogation prompt based on the CAT report using Groq.
    """
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
        
    system_prompt = (
        "You are a supportive, conversational academic tutor. The student has struggled with a specific concept on their exam. "
        "Based on the provided exam report, identify one core concept they failed, and ask them a single, straightforward, "
        "conceptual question to test their understanding. The question must be realistic for a student to answer verbally. "
        "Avoid asking them to do complex math, list exact memory addresses, or dictate code verbally. "
        "Keep your question extremely concise, friendly, and under 2 sentences."
    )
    
    try:
        response = client.chat.completions.create(
            model="groq/compound-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Subject: {request.subject}\nReport:\n{request.analysis_report}"}
            ]
        )
        ai_text = response.choices[0].message.content
        
        # Groq does not have a native TTS API yet, so we return the text and let the frontend use native browser TTS.
        return {
            "prompt_text": ai_text,
            "audio_base64": None
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/evaluate-interview")
async def evaluate_interview(
    audio: UploadFile = File(...),
    subject: str = Form(...),
    original_prompt: str = Form(...)
):
    """
    Accepts the audio blob, transcribes it via Whisper on Groq, evaluates it, and decides whether to drop a sandbox.
    """
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
        
    # Transcribe Audio
    try:
        # Save temporary file since Groq Whisper API needs a file with extension
        # Using .webm because frontend sends webm
        temp_file_path = f"temp_{audio.filename}"
        with open(temp_file_path, "wb") as buffer:
            buffer.write(await audio.read())
            
        with open(temp_file_path, "rb") as f:
            transcript = client.audio.transcriptions.create(
                model="whisper-large-v3", 
                file=(temp_file_path, f.read())
            )
            
        os.remove(temp_file_path)
        transcribed_text = transcript.text
        
    except Exception as e:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    # Evaluate Transcription
    system_prompt = (
        "You are an encouraging academic tutor evaluating a student's verbal answer to a conceptual question. "
        "Evaluate the transcript based on whether they demonstrate a solid core understanding of the topic. "
        "Do not penalize them for minor misspeaks or lack of exact numbers if the main idea is correct. "
        "2. Did they sound hesitant or use excessive filler words (um, uh, like)? "
        "Output ONLY a valid JSON object with these exact keys: "
        "\"score\" (integer 0-100), "
        "\"deploy_sandbox\" (boolean, true if score < 70), "
        "\"ai_voice_response\" (string, strict feedback to the user), "
        "\"sandbox_task_title\" (string, a short title for a hands-on coding task based on what they failed, or null if passed), "
        "\"sandbox_task_desc\" (string, a 1-sentence instruction for a coding task based on what they failed, or null if passed)."
    )
    
    try:
        response = client.chat.completions.create(
            model="groq/compound-mini",
            response_format={ "type": "json_object" },
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Prompt asked: {original_prompt}\nSubject: {subject}\nCandidate's response: {transcribed_text}"}
            ]
        )
        
        result_json = json.loads(response.choices[0].message.content)
        result_json["transcription"] = transcribed_text
        result_json["audio_base64"] = None
        
        return result_json
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")

@app.post("/api/evaluate-sandbox-code")
async def evaluate_sandbox_code(request: SandboxEvalRequest):
    """
    Evaluates the code submitted by the user in the sandbox based on the assigned task.
    """
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
        
    system_prompt = (
        "You are an expert technical evaluator. The user was assigned a coding task in a sandbox. "
        "Analyze the provided code and determine if it correctly and securely fulfills the task requirements. "
        "Be lenient on syntax unless it is fundamentally broken, focus on the core logic and security (e.g. parameterized queries). "
        "Output ONLY a valid JSON object with these exact keys: "
        "\"passed\" (boolean, true if the code fulfills the task reasonably well), "
        "\"feedback\" (string, 1-2 sentences of feedback explaining why they passed or failed, or what could be improved)."
    )
    
    try:
        response = client.chat.completions.create(
            model="groq/compound-mini",
            response_format={ "type": "json_object" },
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Task Title: {request.task_title}\nTask Description: {request.task_desc}\nUser's Code:\n{request.code}"}
            ]
        )
        
        result_json = json.loads(response.choices[0].message.content)
        return result_json
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code evaluation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
