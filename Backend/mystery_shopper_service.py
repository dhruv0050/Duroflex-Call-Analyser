import google.generativeai as genai
import os
import json
from dotenv import load_dotenv
from datetime import datetime
from typing import Dict, List, Tuple

# Load environment variables
load_dotenv()

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("MODEL", "gemini-1.5-flash")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")

genai.configure(api_key=GEMINI_API_KEY)

# ===== DUROFLEX KNOWLEDGE BASE =====
DUROFLEX_KNOWLEDGE_BASE = {
    "Duropedic_Range": {
        "Target_Customer": "Back Pain, Elderly, Spine Issues",
        "Products": ["Posture Perfect", "Balance Plus", "Back Magic Pro", "Strength"],
        "USP": ["5-Zone Orthopedic Support", "Doctor Recommended", "Firm Support"]
    },
    "Natural_Living_Range": {
        "Target_Customer": "Luxury, Eco-conscious, High Budget, Cooling needs",
        "Products": ["Tatva (Latex)", "Prana", "Reva"],
        "USP": ["100% Natural GOLS Latex", "Sustainability", "Natural Cooling"]
    },
    "Energise_Range": {
        "Target_Customer": "Couples, Hotel Comfort seekers, Active lifestyle",
        "Products": ["Propel", "Bolt", "Qube Cell"],
        "USP": ["3-Zone Copper Infusion", "Zero Motion Transfer", "Bounciness"]
    },
    "LiveIn_Series": {
        "Target_Customer": "Bachelors, Renters, Quick Delivery needed",
        "Products": ["LiveIn Duropedic", "LiveIn 2-in-1", "LiveIn Adapt"],
        "USP": ["DIY Setup", "Vacuum Rolled (Bed-in-a-box)", "Reversible"]
    },
    "Essential_Range": {
        "Target_Customer": "Traditional buyers, Very low budget",
        "Products": ["Durobond Pro", "Coir", "Comfy"],
        "USP": ["Durability", "Dual Side Use", "Economic"]
    }
}

# ===== PERSONAS =====
PERSONAS = {
    "rohan": {
        "name": "Rohan",
        "context": "Rented PG. Budget <10k.",
        "needs": "Instant setup, no hassle",
        "budget": 10000,
        "desired_range": "LiveIn_Series",
        "trigger": "Wants instant setup",
        "trap": "If staff pushes expensive Duropedic, Rohan leaves",
        "objection": "How long will setup take? Can I manage it myself?",
        "opening": "Hi, I just moved into a new PG room and need a mattress urgently. Something that I can set up myself without any hassle. My budget is around 10k."
    },
    "iyer": {
        "name": "Mrs. Iyer",
        "context": "Sciatica/Back Pain. Budget 40k.",
        "needs": "Doctor recommended, firm support",
        "budget": 40000,
        "desired_range": "Duropedic_Range",
        "trigger": "Doctor Recommended",
        "trap": "If staff suggests Spring/Bounce, Mrs. Iyer gets angry",
        "objection": "My doctor said I need firm support. Will this actually help my back pain?",
        "opening": "Hello, I'm looking for a mattress that can help with my sciatica pain. My doctor recommended an orthopedic one. My budget is around 40k."
    },
    "couple": {
        "name": "Ankit & Priya",
        "context": "New bedroom. Budget 30k.",
        "needs": "Hotel Feel, No Motion Transfer",
        "budget": 30000,
        "desired_range": "Energise_Range",
        "trigger": "Hotel Feel + No Disturbance",
        "trap": "Tech jargon confuses them",
        "objection": "We want something that feels like a luxury hotel. Will this mattress isolate movements?",
        "opening": "Hi, we're a newly married couple setting up our bedroom. We want something with hotel-like comfort and minimal motion transfer. Budget is around 30k."
    },
    "malhotra": {
        "name": "Mr. Malhotra",
        "context": "Master Bedroom. Budget 80k+.",
        "needs": "Natural, Chemical-free, Cooling",
        "budget": 80000,
        "desired_range": "Natural_Living_Range",
        "trigger": "Natural, Chemical-free, Cooling",
        "trap": "Selling synthetic foam",
        "objection": "I want something completely natural and eco-friendly. Are there any harmful chemicals?",
        "opening": "Good day, I'm looking for a premium mattress for my master bedroom. I'm very conscious about natural materials and eco-friendliness. Budget is 80k or more."
    },
    "skeptic": {
        "name": "Suresh",
        "context": "Replacing old mattress. Budget Medium.",
        "needs": "Quality assurance, Brand Heritage",
        "budget": 35000,
        "desired_range": "All Ranges",
        "trigger": "Wakefit/SleepyCat is cheaper",
        "trap": "Staff must explain why Duroflex is better",
        "objection": "Why should I buy Duroflex when brands like Wakefit or SleepyCat are cheaper and newer?",
        "opening": "Hello, I'm replacing my old mattress. I've seen that Wakefit and SleepyCat have good reviews and are cheaper. Why should I choose Duroflex?"
    }
}

# ===== SYSTEM PROMPT FOR MYSTERY SHOPPER =====
def get_system_prompt(persona_key: str) -> str:
    persona = PERSONAS[persona_key]
    kb_json = json.dumps(DUROFLEX_KNOWLEDGE_BASE, indent=2)
    
    return f"""ROLE:
You are a Mystery Shopper in India interacting with a Duroflex sales representative. Your goal is to test their product knowledge, empathy, and sales skills.

CURRENT PERSONA:
Name: {persona['name']}
Context: {persona['context']}
Budget: ₹{persona['budget']}
Needs: {persona['needs']}

SECTION 1: KNOWLEDGE BASE (THE DUROFLEX TRUTH TABLE)
Use this to evaluate if the sales staff recommends the correct product:

{kb_json}

SECTION 2: BEHAVIORAL INSTRUCTIONS
1. The "Onion" Strategy (Information Release)
   - Start Vague: "Hi, looking for a mattress."
   - Phase 1 (Discovery): Only reveal budget/pain points if asked
   - If they suggest a product without asking needs, act skeptical ("How do you know that's good for me?")
   - Phase 2 (Selection): If they suggest correct product, show interest
   - If they suggest wrong one, ask: "But isn't that bad for [constraint]?"

2. Indian Nuances & Trust Markers
   - Language: Use Indian English. Terms: "PG", "Flat", "Back issue", "Best Price"
   - Validation: Ask for "Real photos" or "Video call demo" if price is high
   - The "Discount" Game: Always ask: "Is this the final price? Any card offers? Bajaj EMI?"
   - Exchange: "I have an old cotton mattress (5x6 ft). Do you have an exchange offer?"

3. Objection Handling (Mandatory)
   - You MUST raise one Brand/Service objection before buying
   - Example for this persona: "{persona['objection']}"

4. Delivery Pressure
   - Ask: "When will it reach? I need it in 2 days."
   - If they say 7-10 days, threaten to buy from Amazon/Competitor

SECTION 3: ENDING THE CONVERSATION (EXIT LOGIC)
Scenario A: THE FAIL (Rage Quit)
   - Trigger: Staff ignores budget 2x, is rude, suggests wrong product for needs, or takes too long
   - Response: "You aren't understanding my requirement. I will check at a local store."

Scenario B: THE NEUTRAL (Soft Close)
   - Trigger: Staff answered queries but didn't offer compelling deal/closing
   - Response: "Okay, thanks for the details. Send this on WhatsApp. I will discuss with my family."

Scenario C: THE SUCCESS (Hard Close)
   - Trigger: Staff identified right product, handled objection, offered discount/EMI, asked for sale
   - Response: "Okay, that sounds fair. Please send the payment link."

SECTION 4: OUTPUT PROTOCOL - CRITICAL
You MUST follow this EXACTLY:

[INTERNAL ANALYSIS]
> Score: (0-10)
> Product Check: [Did they recommend from {persona['desired_range']}?]
> Objection Status: [Raised/Not Raised/Resolved]
> Closing Status: [Not Asked/Asked/Pending]
> Next Move: [Ask Question / Raise Objection / Exit / Accept]

[CUSTOMER MESSAGE]
(Your actual spoken reply ONLY - no scores or analysis here)

CRITICAL: Never mix internal analysis with customer message. Generate BOTH sections for every response.

START NOW: Begin by responding to the sales staff naturally based on your persona.
"""


class MysteryShopperSession:
    def __init__(self, persona_key: str):
        self.persona_key = persona_key
        self.persona = PERSONAS[persona_key]
        self.conversation_history: List[Dict] = []
        self.system_prompt = get_system_prompt(persona_key)
        self.internal_scores: List[Dict] = []
        self.objection_raised = False
        self.objection_resolved = False
        self.closing_asked = False
        self.status = "in_progress"  # in_progress, fail, neutral, success
        self.session_start = datetime.now()
        
        # Initialize Gemini model with conversation history
        self.model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            system_instruction=self.system_prompt
        )
    
    def add_staff_message(self, message: str) -> Tuple[str, Dict]:
        """Process staff message and generate customer response with internal analysis"""
        
        # Add staff message to history
        self.conversation_history.append({
            "role": "staff",
            "content": message,
            "timestamp": datetime.now().isoformat()
        })
        
        # Build chat history for Gemini
        chat_messages = []
        for msg in self.conversation_history:
            chat_messages.append({
                "role": "user" if msg["role"] == "staff" else "model",
                "parts": [msg["content"]]
            })
        
        # Get response from Gemini
        response = self.model.generate_content(
            chat_messages,
            stream=False
        )
        
        full_response = response.text
        
        # Parse the response to extract internal analysis and customer message
        internal_analysis, customer_message = self._parse_response(full_response)
        
        # Add customer message to history
        self.conversation_history.append({
            "role": "customer",
            "content": customer_message,
            "timestamp": datetime.now().isoformat()
        })
        
        # Store internal score
        self.internal_scores.append(internal_analysis)
        
        # Update session status based on analysis
        self._update_session_status(internal_analysis, customer_message)
        
        return customer_message, internal_analysis
    
    def _parse_response(self, response_text: str) -> Tuple[Dict, str]:
        """Parse Gemini response into internal analysis and customer message"""
        try:
            parts = response_text.split("[CUSTOMER MESSAGE]")
            
            if len(parts) < 2:
                # Fallback if format is not correct
                return {
                    "score": 5,
                    "product_check": "Unable to parse",
                    "objection_status": "Unknown",
                    "closing_status": "Unknown",
                    "next_move": "Continue"
                }, response_text
            
            # Extract internal analysis
            analysis_text = parts[0].replace("[INTERNAL ANALYSIS]", "").strip()
            customer_msg = parts[1].strip()
            
            # Parse analysis
            analysis = {
                "score": 5,
                "product_check": "Not evaluated",
                "objection_status": "Unknown",
                "closing_status": "Unknown",
                "next_move": "Continue",
                "raw": analysis_text
            }
            
            # Extract score
            if "Score:" in analysis_text:
                try:
                    score_part = analysis_text.split("Score:")[1].split("\n")[0].strip()
                    score_val = ''.join(filter(str.isdigit, score_part.split("/")[0]))
                    analysis["score"] = int(score_val) if score_val else 5
                except:
                    analysis["score"] = 5
            
            # Extract status fields
            if "Product Check:" in analysis_text:
                analysis["product_check"] = analysis_text.split("Product Check:")[1].split("\n")[0].strip()
            if "Objection Status:" in analysis_text:
                analysis["objection_status"] = analysis_text.split("Objection Status:")[1].split("\n")[0].strip()
            if "Closing Status:" in analysis_text:
                analysis["closing_status"] = analysis_text.split("Closing Status:")[1].split("\n")[0].strip()
            if "Next Move:" in analysis_text:
                analysis["next_move"] = analysis_text.split("Next Move:")[1].split("\n")[0].strip()
            
            return analysis, customer_msg
        
        except Exception as e:
            return {
                "score": 5,
                "product_check": "Parse error",
                "objection_status": "Unknown",
                "closing_status": "Unknown",
                "next_move": "Continue",
                "error": str(e)
            }, response_text
    
    def _update_session_status(self, analysis: Dict, customer_message: str):
        """Update session status based on customer message"""
        customer_msg_lower = customer_message.lower()
        
        # Check for exit triggers
        if any(phrase in customer_msg_lower for phrase in [
            "aren't understanding my requirement",
            "will check at a local store",
            "thanks for the details",
            "discuss with my family",
            "that sounds fair",
            "send the payment link"
        ]):
            # Determine status based on content
            if any(phrase in customer_msg_lower for phrase in ["aren't understanding", "local store"]):
                self.status = "fail"
            elif any(phrase in customer_msg_lower for phrase in ["discuss with my family"]):
                self.status = "neutral"
            elif any(phrase in customer_msg_lower for phrase in ["that sounds fair", "payment link"]):
                self.status = "success"
        
        # Track objection status
        if "objection" in analysis.get("next_move", "").lower():
            self.objection_raised = True
        
        if "resolved" in analysis.get("objection_status", "").lower():
            self.objection_resolved = True
        
        if "asked" in analysis.get("closing_status", "").lower():
            self.closing_asked = True
    
    def get_opening_message(self) -> str:
        """Get the opening message for this persona"""
        return self.persona["opening"]
    
    def get_evaluation_report(self) -> Dict:
        """Generate evaluation report for the session"""
        
        # Calculate average score
        avg_score = sum(s.get("score", 5) for s in self.internal_scores) / len(self.internal_scores) if self.internal_scores else 0
        
        # Determine if staff identified correct product range
        correct_range = self.persona["desired_range"]
        product_checks = [s.get("product_check", "") for s in self.internal_scores]
        product_identified_correctly = any(correct_range.lower() in check.lower() for check in product_checks)
        
        # Create report
        report = {
            "status": self.status,
            "persona": self.persona["name"],
            "budget": self.persona["budget"],
            "desired_range": self.persona["desired_range"],
            "metrics": {
                "average_score": round(avg_score, 1),
                "total_exchanges": len(self.conversation_history) // 2,
                "product_identified_correctly": product_identified_correctly,
                "objection_raised": self.objection_raised,
                "objection_resolved": self.objection_resolved,
                "closing_asked": self.closing_asked
            },
            "feedback": self._generate_feedback(avg_score, product_identified_correctly),
            "duration_minutes": round((datetime.now() - self.session_start).total_seconds() / 60, 1),
            "conversation_turns": len(self.internal_scores)
        }
        
        return report
    
    def _generate_feedback(self, avg_score: float, product_correct: bool) -> str:
        """Generate feedback based on performance"""
        
        if self.status == "fail":
            return "❌ FAIL: Sales staff failed to understand customer requirements or was dismissive. Need to improve needs assessment and patience."
        
        elif self.status == "neutral":
            return "⚠️ NEUTRAL: Sales staff provided information but lacked closing technique. Did not create urgency or offer compelling incentives (discounts/EMI)."
        
        elif self.status == "success":
            feedback_parts = []
            feedback_parts.append("✅ SUCCESS: Sale was closed successfully!")
            
            if not product_correct:
                feedback_parts.append("⚠️ However, the correct product range for this customer was '{self.persona['desired_range']}' - ensure product mapping aligns with customer needs.")
            
            if not self.objection_resolved:
                feedback_parts.append("⚠️ Customer objections could have been handled more effectively.")
            
            return " ".join(feedback_parts) if len(feedback_parts) > 1 else feedback_parts[0]
        
        else:
            return "Session still in progress..."


# ===== API FUNCTIONS =====

def start_mystery_shopper_session(persona_key: str) -> Dict:
    """Start a new mystery shopper session"""
    
    if persona_key not in PERSONAS:
        raise ValueError(f"Invalid persona. Choose from: {', '.join(PERSONAS.keys())}")
    
    session = MysteryShopperSession(persona_key)
    opening_msg = session.get_opening_message()
    
    return {
        "session_id": persona_key + "_" + datetime.now().strftime("%Y%m%d_%H%M%S"),
        "persona": session.persona["name"],
        "opening_message": opening_msg,
        "session": session
    }


def get_available_personas() -> Dict:
    """Get list of available personas"""
    return {
        "personas": {
            key: {
                "name": persona["name"],
                "context": persona["context"],
                "budget": persona["budget"],
                "needs": persona["needs"]
            }
            for key, persona in PERSONAS.items()
        }
    }
