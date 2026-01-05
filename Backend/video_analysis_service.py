import google.generativeai as genai
import os
import json
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv
from typing import List, Dict
import re
from pymongo import MongoClient

# Load environment variables
load_dotenv()

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("MODEL", "gemini-1.5-flash")
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_NAME = os.getenv("MONGODB_NAME", "Duroflex")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")

genai.configure(api_key=GEMINI_API_KEY)

# Video analysis data storage
VIDEO_ANALYSIS_DIR = Path("video_analysis")
VIDEO_ANALYSIS_DIR.mkdir(exist_ok=True)
VIDEO_ANALYSIS_FILE = VIDEO_ANALYSIS_DIR / "video_reports.json"

# Mongo helpers
_mongo_client = None


def get_video_collection():
  """Return Mongo collection for video analyses, or None if unavailable."""
  global _mongo_client
  if not MONGODB_URI:
    return None
  try:
    if _mongo_client is None:
      _mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
      # Trigger a lightweight ping to validate connectivity
      _mongo_client.admin.command("ping")
    db = _mongo_client[MONGODB_NAME]
    return db["video_reports"]
  except Exception as exc:  # Fallback silently to file storage if Mongo is not reachable
    print(f"MongoDB not available, falling back to JSON file storage: {exc}")
    return None


# The exact prompt from user
EXACT_ANALYSIS_PROMPT = """{
  "role": "You are an expert Assisted Sales Call Analyst.",
  "context": "You are analyzing a video-recorded sales interaction between a Duroflex sales agent and a potential customer. Duroflex is an omnichannel B2C brand specializing in mattresses and furniture. Your analysis will be used for agent coaching and quality assurance.",
  "objective": "To meticulously evaluate the agent's performance against a predefined framework, identifying strengths and areas for improvement in their sales technique, technical execution, and ability to convert inquiries into sales or store visits.",
  "input": {
    "videoUrl": "{video_url}"
  },
  "taskFramework": {
    "instructions": {
      "ratingScale": {
        "1": "Poor / Not Attempted",
        "2": "Below Average",
        "3": "Average / Met Minimum Standard",
        "4": "Good / Effective",
        "5": "Excellent / Exemplary"
      },
      "feedback": "For all 'Reasons for Rating' fields, provide 2-3 concise, bulleted points of actionable feedback that justify your score."
    },
    "sections": {
      "Functional": {
        "Call_ID": "Unique identifier for the call being analyzed.",
        "Call_Time": "Timestamp of when the call took place (e.g., 2025-10-21 14:35 IST).",
        "Customer_Name": "Name of the customer (if mentioned in call).",
        "Agent_Name": "Name of the sales agent (as per video or introduction).",
        "Store_Location": "Store location from which the video call is happening.",
        "Agent_Presentability": {
          "Score": "1 to 5",
          "Reason_for_Score": "Reason for how presentable the sales agent appeared (looks, tidiness, grooming, being presentation ready)."
        },
        "Agent_Video_Quality_Rating": "Score: 1 to 5",
        "Agent_Audio_Quality_Rating": "Score: 1 to 5",
        "Customer_Audio_Quality_Rating": "Score: 1 to 5",
        "Call_Objective_Theme": "Summarize the main purpose: e.g., 'Stock Check', 'Price Inquiry', 'Location/Hours', 'Complaint/Service', 'General Product Info'."
      },
      "Customer_Information": {
        "Type_of_Call": "Was this a Sales Call (Pre-purchase) or a Service Call (Post-purchase)?",
        "Interest_Category": "Category of interest (Mattress, Sofa, Bed, Accessories).",
        "Specific_Product_Inquiry": "Did the customer ask about a specific model? List the product name extracted from the conversation or 'General'.",
        "Primary_Questions_Asked": "List the top 3-4 specific questions asked by the user (e.g., 'Is this available in 6 inch?', 'Do you have exchange offer?').",
        "Timeline_to_Purchase": {
          "value": "Short/Medium/Long",
          "criteria": {
            "Short": "Immediate need (Today/This Week).",
            "Medium": "Planning phase (2-4 Weeks).",
            "Long": "Research phase (> 1 Month)."
          }
        },
        "Customer_Stage_AIDA": {
          "value": "Awareness/Interest/Desire/Action",
          "criteria": {
            "Awareness": "General inquiry.",
            "Interest": "Specific feature questions.",
            "Desire": "Comparing/Asking for deals.",
            "Action": "Ready to visit/buy."
          }
        },
        "Intent_to_Visit_Rating": {
          "question": "How likely is the customer to visit the store for a physical trial? (High/Med/Low)",
          "criteria": {
            "HIGH": "Explicit confirmation/Ask for location.",
            "MEDIUM": "Tentative interest in trying the mattress.",
            "LOW": "No commitment/Refusal."
          }
        },
        "Intent_to_Purchase_Rating": {
          "question": "Urgency to buy? (High/Med/Low)",
          "criteria": {
            "HIGH": "Transactional Language: High frequency of questions about price, discounts, payment options.",
            "MEDIUM": "Comparison/Validation Language: Focus on specific product features, materials, pros/cons.",
            "LOW": "Exploratory/Educational Language: Asks broad, open-ended questions about general mattress types."
          }
        },
        "Barriers_to_Conversion": "If Intent is Low/Medium, what is the primary reason? (e.g., 'Price too high', 'Stock Unavailable', 'Location too far', 'Just Researching', 'Bad Agent Handling', 'N/A').",
        "Customer_Satisfaction_Score": {
          "question": "On a scale of 1 to 5, how would the customer rate the agent interaction based on their overall experience?",
          "criteria": {
            "5": "Excellent: Customer expresses explicit satisfaction.",
            "3": "Average: Neutral tone, transactional.",
            "1": "Poor: Explicit frustration or ends call abruptly."
          }
        }
      },
      "Agent_Areas": {
        "Product_Demonstration": {
          "Done": "Was a product demonstration performed? (Yes/No)",
          "Quality_Rating": "Rate the effectiveness of the demonstration. (Rating 1-5)",
          "Quality_Reasons": "Reasons for Quality Rating",
          "Relevance_Rating": {
            "score": "1-5",
            "criteria": "Did the agent choose to demonstrate features directly relevant to the customer's stated problem?"
          },
          "Video_Audio_Quality": {
            "score": "1-5",
            "criteria": "Was the lighting and camera angle sufficient? Were all props visible? Was audio clear?"
          },
          "Effectiveness": {
            "score": "1-5",
            "criteria": "Did the agent effectively translate an intangible feature (comfort, support) into a clear visual action?"
          },
          "Customer_Engagement": {
            "score": "1-5",
            "criteria": "Did the agent pause to solicit feedback? Was the customer prompted to engage with the visual content?"
          }
        },
        "The_Invitation_to_Visit": {
          "Attempted": "Yes/No",
          "Quality_Rating": {
            "score": "1-5",
            "criteria": "Did the agent explicitly invite the customer to the store if the online sale wasn't closed? Did they share the location?"
          },
          "Reasons": "Reasons for Rating"
        },
        "RELAX_Framework": {
          "R_Reach_Out": {
            "title": "Greeting & Rapport",
            "rating": "1-5",
            "reasons": "Reasons for Rating"
          },
          "E_Explore_Needs": {
            "title": "Discovery & Understanding",
            "rating": "1-5",
            "reasons": "Reasons for Rating"
          },
          "L_Link_Demo": {
            "title": "Connecting Needs to Product Features via Demo",
            "rating": "1-5",
            "reasons": "Reasons for Rating"
          },
          "A_Add_Value": {
            "title": "Cross-Selling & Upselling",
            "rating": "1-5",
            "reasons": "Reasons for Rating"
          },
          "X_Express_Offers": {
            "title": "Closing & Next Steps",
            "rating": "1-5",
            "reasons": "Reasons for Rating"
          }
        },
        "SoftSkills_Rating": {
          "Active_Listening": {
            "score": "1-5",
            "criteria": "Assesses the agent's focus. Did the agent interrupt? Did they repeat pain points?"
          },
          "Empathy_Rapport": {
            "score": "1-5",
            "criteria": "Assesses emotional connection. Did the agent validate feelings or concerns?"
          },
          "Clarity_Confidence": {
            "score": "1-5",
            "criteria": "Were explanations easy to understand? Was the tone confident and positive?"
          },
          "Objection_Handling": {
            "score": "1-5",
            "criteria": "Did the agent acknowledge concerns before responding? Was the response framed as a benefit?"
          },
          "Hold_and_Dead_Air_Management": {
            "score": "1-5",
            "criteria": "Did the agent manage time effectively when checking stock/moving product? Did they keep the customer engaged or leave them looking at a blank screen?"
          },
          "Agent_Language_Fluency_Score": {
            "score": "1-5",
            "criteria": "Did the agent communicate clearly in the customer's preferred language? (5=Fluent/Native, 1=Struggled/Language Barrier)."
          }
        },
        "Top_3_Improvement_Areas": "List the top three areas where the agent scored lowest, providing specific, actionable advice for coaching."
      },
      "Overall_Summary": {
        "Chronological_Call_Summary": "Provide a brief, step-by-step summary of how the call unfolded from start to finish.",
        "Agent_Handling_Summary": "Summarize the agent's overall performance, highlighting key strengths and weaknesses.",
        "Customer_Satisfaction_Summary": "Describe the customer's journey and overall experience during the call.",
        "Next_Action": "What is the specific next step defined? (e.g., 'Customer buying online', 'Customer visiting at 5PM', 'Agent sending WhatsApp Location', 'No Action')."
      }
    }
  },
  "outputFormat": {
    "instruction": "Present your complete analysis as a single, well-structured JSON object. Do not include any text, headers, or explanations outside the JSON block. All numerical ratings (1-5) must be stored as integers. All feedback points (Reasons for Rating) must be stored as arrays of strings. Boolean values (Yes/No, Attempted?) must be stored as true/false (Booleans).",
    "schema": {
      "Functional": {
        "Call_ID": "",
        "Call_Time": "",
        "Customer_Name": "",
        "Agent_Name": "",
        "Store_Location": "",
        "Agent_Presentability": {
          "Score": 0,
          "Reason_for_Score": ""
        },
        "Agent_Video_Quality_Rating": 0,
        "Agent_Audio_Quality_Rating": 0,
        "Customer_Audio_Quality_Rating": 0,
        "Call_Objective_Theme": ""
      },
      "Customer_Information": {
        "Type_of_Call": "",
        "Interest_Category": "",
        "Specific_Product_Inquiry": "",
        "Primary_Questions_Asked": [
          ""
        ],
        "Timeline_to_Purchase": "",
        "Customer_Stage_AIDA": "",
        "Intent_to_Visit_Rating": "",
        "Intent_to_Visit_Rating_Reasons": [
          ""
        ],
        "Intent_to_Purchase_Rating": "",
        "Intent_to_Purchase_Rating_Reasons": [
          ""
        ],
        "Barriers_to_Conversion": "",
        "Customer_Satisfaction_Score": 0,
        "Customer_Satisfaction_Score_Reasons": [
          ""
        ]
      },
      "Agent_Areas": {
        "Product_Demonstration": {
          "Done": false,
          "Quality_Rating": 0,
          "Quality_Reasons": [
            ""
          ],
          "Relevance_Rating": 0,
          "Relevance_Rating_Reason": "",
          "Video_Audio_Quality_Rating": 0,
          "Video_Audio_Quality_Reason": "",
          "Effectiveness_Rating": 0,
          "Effectiveness_Rating_Reason": "",
          "Customer_Engagement_Rating": 0,
          "Customer_Engagement_Reason": ""
        },
        "The_Invitation_to_Visit": {
          "Attempted": false,
          "Quality_Rating": 0,
          "Reasons": [
            ""
          ]
        },
        "RELAX_Framework": {
          "R_Reach_Out": {
            "Rating": 0,
            "Reasons": [
              ""
            ]
          },
          "E_Explore_Needs": {
            "Rating": 0,
            "Reasons": [
              ""
            ]
          },
          "L_Link_Demo": {
            "Rating": 0,
            "Reasons": [
              ""
            ]
          },
          "A_Add_Value": {
            "Rating": 0,
            "Reasons": [
              ""
            ]
          },
          "X_Express_Offers": {
            "Rating": 0,
            "Reasons": [
              ""
            ]
          }
        },
        "SoftSkills": {
          "Active_Listening_Rating": 0,
          "Active_Listening_Reasons": [
            ""
          ],
          "Empathy_Rapport_Rating": 0,
          "Empathy_Rapport_Reasons": [
            ""
          ],
          "Clarity_Confidence_Rating": 0,
          "Clarity_Confidence_Reasons": [
            ""
          ],
          "Objection_Handling_Rating": 0,
          "Objection_Handling_Reasons": [
            ""
          ],
          "Hold_and_Dead_Air_Management_Rating": 0,
          "Hold_and_Dead_Air_Management_Reasons": [
            ""
          ],
          "Agent_Language_Fluency_Score": 0,
          "Top_3_Improvement_Areas": [
            ""
          ]
        }
      },
      "Overall_Summary": {
        "Chronological_Call_Summary": "",
        "Agent_Handling_Summary": "",
        "Customer_Satisfaction_Summary": "",
        "Next_Action": ""
      },
      "Transcript_Log": [
        {
          "Speaker": "Agent/Customer",
          "Text": "...",
          "Timestamp": "00:00"
        }
      ]
    }
  }
}"""


def load_video_csv():
    """Load the video calls CSV file"""
    csv_path = Path("video calls input call analyzer.csv")
    if not csv_path.exists():
        return pd.DataFrame()
    return pd.read_csv(csv_path)


def save_video_analysis(report_id: str, analysis_data: dict):
  """Save video analysis to MongoDB if available; otherwise JSON file."""
  collection = get_video_collection()

  if collection is not None:
    try:
      collection.update_one(
        {"report_id": report_id},
        {"$set": {"report_id": report_id, "analysis": analysis_data}},
        upsert=True,
      )
      return True
    except Exception as exc:
      print(f"Error saving video analysis to MongoDB, falling back to file: {exc}")

  # Fallback: JSON file storage
  try:
    if VIDEO_ANALYSIS_FILE.exists():
      with open(VIDEO_ANALYSIS_FILE, 'r', encoding='utf-8') as f:
        reports = json.load(f)
    else:
      reports = {}

    reports[report_id] = analysis_data

    with open(VIDEO_ANALYSIS_FILE, 'w', encoding='utf-8') as f:
      json.dump(reports, f, indent=2, ensure_ascii=False)

    return True
  except Exception as e:
    print(f"Error saving video analysis: {e}")
    return False


def load_all_video_analyses():
    """Load all video analyses from MongoDB if available, else JSON file."""
    collection = get_video_collection()

    if collection is not None:
        try:
            docs = list(collection.find({}))
            if docs:
                return {doc["report_id"]: doc.get("analysis", {}) for doc in docs}
            # If Mongo is reachable but empty, fall back to file seed
            print("MongoDB video_reports collection is empty; using JSON file fallback")
        except Exception as exc:
            print(f"Error loading video analyses from MongoDB, falling back to file: {exc}")

    if not VIDEO_ANALYSIS_FILE.exists():
        return {}

    try:
        with open(VIDEO_ANALYSIS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading video analyses: {e}")
        return {}


def get_video_analysis_by_id(report_id: str):
  """Get a specific video analysis by ID"""
  collection = get_video_collection()

  if collection is not None:
    try:
      doc = collection.find_one({"report_id": report_id})
      if doc:
        return doc.get("analysis")
    except Exception as exc:
      print(f"Error fetching analysis from MongoDB, falling back to file: {exc}")

  all_analyses = load_all_video_analyses()
  return all_analyses.get(report_id)


def analyze_video_with_gemini(video_url: str, store_name: str = "Unknown Store") -> dict:
    """
    Analyze a video using Gemini API with the exact provided prompt
    """
    try:
        print(f"Analyzing video from {video_url}")
        
        # Prepare the prompt with the video URL
        prompt_text = EXACT_ANALYSIS_PROMPT.format(video_url=video_url)
        
        # Create the model instance
        model = genai.GenerativeModel(MODEL_NAME)
        
        # Upload the video file to Gemini (if it's a local path)
        # For URLs, we'll pass them directly in the prompt
        try:
            # Try to upload as file if it's a local path
            if video_url.startswith(('http://', 'https://')):
                # For URLs, use them directly in the prompt
                response = model.generate_content(
                    [prompt_text],
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.7,
                        max_output_tokens=4000,
                    )
                )
            else:
                # For local files
                file = genai.upload_file(video_url)
                response = model.generate_content(
                    [prompt_text, file],
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.7,
                        max_output_tokens=4000,
                    )
                )
        except Exception as e:
            print(f"Note: Could not upload file directly, using URL in prompt: {e}")
            response = model.generate_content(
                [prompt_text],
                generation_config=genai.types.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=4000,
                )
            )
        
        # Parse the response
        response_text = response.text
        
        # Try to extract JSON from the response
        try:
            # Look for JSON content in the response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                analysis_json = json.loads(json_match.group())
            else:
                # If no JSON found, create a structured response
                analysis_json = {
                    "Functional": {
                        "Call_ID": f"VIDEO_{store_name.upper().replace(' ', '_')}",
                        "Call_Time": "Not extracted",
                        "Customer_Name": "Not extracted",
                        "Agent_Name": "Not extracted",
                        "Store_Location": store_name,
                        "Agent_Presentability": {"Score": 0, "Reason_for_Score": "Video analysis not available"},
                        "Agent_Video_Quality_Rating": 0,
                        "Agent_Audio_Quality_Rating": 0,
                        "Customer_Audio_Quality_Rating": 0,
                        "Call_Objective_Theme": "Not extracted"
                    },
                    "Customer_Information": {},
                    "Agent_Areas": {},
                    "Overall_Summary": {
                        "Chronological_Call_Summary": response_text,
                        "Agent_Handling_Summary": "Analysis pending full video processing",
                        "Customer_Satisfaction_Summary": "",
                        "Next_Action": ""
                    }
                }
        except json.JSONDecodeError:
            # If JSON parsing fails, wrap the response
            analysis_json = {
                "Functional": {
                    "Call_ID": f"VIDEO_{store_name.upper().replace(' ', '_')}",
                    "Store_Location": store_name,
                },
                "Overall_Summary": {
                    "Chronological_Call_Summary": response_text
                }
            }
        
        return analysis_json
        
    except Exception as e:
        print(f"Error analyzing video: {e}")
        raise Exception(f"Failed to analyze video: {str(e)}")


def get_all_video_reports_with_metadata():
    """Get all video reports with metadata from CSV"""
    csv_df = load_video_csv()
    analyses = load_all_video_analyses()
    
    reports = []
    for idx, row in csv_df.iterrows():
        report_id = f"video_{idx}"
        store_name = row.get('Store Name', 'Unknown')
        recording_url = row.get('Recording URL', '')
        duration = row.get('Duration', 'N/A')
        is_converted = row.get('is_converted', 0)
        
        # Check if analysis exists
        analysis = analyses.get(report_id)
        
        # Extract data from analysis for easy display
        call_time = 'N/A'
        product = None
        customer_name = None
        
        if analysis:
            functional = analysis.get('Functional', {})
            call_time = functional.get('Call_Time', 'N/A')
            product = functional.get('Product_of_Interest')
            customer_name = functional.get('Customer_Name')
        
        reports.append({
            "report_id": report_id,
            "store_name": store_name,
            "recording_url": recording_url,
            "duration": duration,
            "is_converted": bool(is_converted),
            "analyzed": analysis is not None,
            "call_time": call_time,
            "product": product,
            "customer_name": customer_name,
            "analysis_data": analysis
        })
    
    return reports
