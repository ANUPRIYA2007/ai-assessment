"""
ProctorForge AI - AI Twin Orchestration Service
Uses Claude to analyze session data, classify risk, and generate interventions.
"""
import json
from typing import Optional


async def analyze_session(session_data: dict) -> dict:
    """
    Send structured session data to Claude for risk analysis.
    Returns risk classification, intervention text, trust adjustment, and reasoning.
    
    Falls back to rule-based analysis if API is unavailable.
    """
    try:
        import anthropic
        from config import settings

        if not settings.ANTHROPIC_API_KEY or settings.ANTHROPIC_API_KEY == "your-anthropic-api-key-here":
            return _rule_based_analysis(session_data)

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        prompt = f"""You are an AI proctoring assistant analyzing a student's exam session in real-time.

Analyze the following session data and provide:
1. Risk classification: low, medium, high, or critical
2. A brief intervention message if needed 
3. A challenge prompt if risk is medium or higher
4. Trust score adjustment (-20 to +5)
5. Detailed reasoning trace

Session Data:
{json.dumps(session_data, indent=2)}

Respond in JSON format:
{{
    "risk_level": "low|medium|high|critical",
    "intervention_text": "message to student or null",
    "challenge_prompt": "challenge question or null",
    "trust_adjustment": number,
    "reasoning": "detailed explanation"
}}"""

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        result = json.loads(response.content[0].text)
        return result

    except Exception as e:
        # Fallback to rule-based
        return _rule_based_analysis(session_data)


def _rule_based_analysis(session_data: dict) -> dict:
    """Rule-based fallback when Claude API is unavailable."""
    risk_score = 0

    # Tab switches
    tab_switches = session_data.get("tab_switch_count", 0)
    if tab_switches > 5:
        risk_score += 30
    elif tab_switches > 2:
        risk_score += 15

    # Paste size
    paste_size = session_data.get("paste_size", 0)
    if paste_size > 500:
        risk_score += 25
    elif paste_size > 100:
        risk_score += 10

    # Typing speed
    wpm = session_data.get("typing_speed", 0)
    if wpm > 150:
        risk_score += 20
    elif wpm > 100:
        risk_score += 10

    # Gaze deviation
    if session_data.get("gaze_deviation"):
        risk_score += 15

    # Voice match
    voice_score = session_data.get("voice_match_score", 1.0)
    if voice_score < 0.7:
        risk_score += 25

    # Backspace ratio
    backspace_ratio = session_data.get("backspace_ratio", 0.05)
    if backspace_ratio < 0.01:
        risk_score += 15  # Suspiciously low

    # Code entropy
    entropy = session_data.get("code_entropy", 0.5)
    if entropy > 0.95:
        risk_score += 10

    # Classify risk
    if risk_score >= 60:
        risk_level = "critical"
        intervention_text = "Your session has been flagged for multiple anomalies. Please stay focused on your exam."
        challenge_prompt = "Please explain your approach to the current problem in your own words."
        trust_adjustment = -15
    elif risk_score >= 40:
        risk_level = "high"
        intervention_text = "Several unusual activities detected. Please ensure you're following exam rules."
        challenge_prompt = "Can you walk through the logic of your most recent code change?"
        trust_adjustment = -10
    elif risk_score >= 20:
        risk_level = "medium"
        intervention_text = "Minor irregularities detected. Please remain focused."
        challenge_prompt = None
        trust_adjustment = -5
    else:
        risk_level = "low"
        intervention_text = None
        challenge_prompt = None
        trust_adjustment = 0

    return {
        "risk_level": risk_level,
        "intervention_text": intervention_text,
        "challenge_prompt": challenge_prompt,
        "trust_adjustment": trust_adjustment,
        "reasoning": f"Rule-based analysis. Risk score: {risk_score}/100. "
                     f"Factors: tabs={tab_switches}, paste={paste_size}, "
                     f"wpm={wpm}, gaze={'deviated' if session_data.get('gaze_deviation') else 'normal'}, "
                     f"voice={voice_score:.2f}, backspace_ratio={backspace_ratio:.3f}",
    }
