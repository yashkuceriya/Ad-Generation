"""Evaluation rubrics for ad copy and image scoring."""

# Dimension weights — Value Proposition highest because for SAT prep,
# the specific benefit claim is what differentiates from competitors.
# Brand Voice lowest because it's hardest to evaluate reliably via LLM.
DIMENSION_WEIGHTS = {
    "clarity": 0.20,
    "value_proposition": 0.25,
    "cta_strength": 0.20,
    "brand_voice": 0.15,
    "emotional_resonance": 0.20,
}

QUALITY_THRESHOLD = 7.0

DIMENSION_RUBRICS = {
    "clarity": {
        "name": "Clarity",
        "question": "Is the message immediately understandable?",
        "prompt": """Score this ad copy on CLARITY (1-10).

Clarity measures whether the reader can grasp the core message in under 3 seconds.

Scoring anchors:
- 1-2: Confusing, multiple competing messages, unclear what's being offered
- 3-4: Message exists but buried in wordiness or jargon
- 5-6: Main point is clear but requires re-reading to fully understand
- 7-8: Crystal clear single message, easy to understand on first read
- 9-10: Instantly understandable, zero ambiguity, message lands in <3 seconds

Ad Copy:
Primary Text: {primary_text}
Headline: {headline}
Description: {description}
CTA: {cta_button}

Audience: {audience_segment}
Campaign Goal: {campaign_goal}

CALIBRATION: A score of 7 means "good but with clear room for improvement." A 9+ should be rare — only for copy that genuinely could not be improved. Be precise: use the full 1-10 range, including decimals like 6.5 or 7.3. Do NOT default to 7-8 for everything.

Think step by step, then provide your score.

Respond in this exact JSON format:
{{"score": <float 1.0-10.0>, "rationale": "<your reasoning>", "confidence": <float 0.0-1.0>, "suggestions": ["<improvement 1>", "<improvement 2>"]}}""",
    },
    "value_proposition": {
        "name": "Value Proposition",
        "question": "Does it communicate a compelling, specific benefit?",
        "prompt": """Score this ad copy on VALUE PROPOSITION (1-10).

Value Proposition measures whether the benefit is specific, compelling, and differentiated.

Scoring anchors:
- 1-2: No clear benefit stated, or generic feature-focused ("we have tutors")
- 3-4: Vague benefit ("improve your scores") without specifics
- 5-6: Benefit is present but could be any competitor ("expert tutoring")
- 7-8: Specific, compelling benefit with clear offer AND a concrete outcome ("raise your SAT 200+ points with 1-on-1 expert tutoring") — must differentiate from generic competitors
- 8-9: Clear offer + specific benefit + differentiation from competitors (e.g., "1-on-1 expert tutors, not pre-recorded videos — avg 200-point gain")
- 9-10: Irresistible, differentiated benefit with proof AND scarcity ("Students average 210-point SAT improvement in 8 weeks — start free")

Ad Copy:
Primary Text: {primary_text}
Headline: {headline}
Description: {description}
CTA: {cta_button}

Audience: {audience_segment}
Campaign Goal: {campaign_goal}

CALIBRATION: A score of 7 means "good but with clear room for improvement." A 9+ should be rare — only for copy that genuinely could not be improved. Be precise: use the full 1-10 range, including decimals like 6.5 or 7.3. Do NOT default to 7-8 for everything.

Think step by step, then provide your score.

Respond in this exact JSON format:
{{"score": <float 1.0-10.0>, "rationale": "<your reasoning>", "confidence": <float 0.0-1.0>, "suggestions": ["<improvement 1>", "<improvement 2>"]}}""",
    },
    "cta_strength": {
        "name": "Call to Action",
        "question": "Is the next step clear, urgent, and low-friction?",
        "prompt": """Score this ad copy on CTA STRENGTH (1-10).

CTA Strength measures whether the call-to-action is clear, compelling, and low-friction.

Scoring anchors:
- 1-2: No CTA or completely vague ("learn more" with no context)
- 3-4: CTA exists but weak or high-friction ("call us to discuss options")
- 5-6: Decent CTA but lacks urgency or specificity ("sign up")
- 7-8: Clear, specific, low-friction CTA with urgency tied to SAT dates or limited availability — not generic scarcity ("Start your free practice test — March SAT is 90 days away")
- 9-10: Urgent, specific, irresistible CTA with real scarcity tied to test dates or enrollment caps ("Claim your free diagnostic — only 50 spots before the March SAT")

Ad Copy:
Primary Text: {primary_text}
Headline: {headline}
Description: {description}
CTA: {cta_button}

Audience: {audience_segment}
Campaign Goal: {campaign_goal}

CALIBRATION: A score of 7 means "good but with clear room for improvement." A 9+ should be rare — only for copy that genuinely could not be improved. Be precise: use the full 1-10 range, including decimals like 6.5 or 7.3. Do NOT default to 7-8 for everything.

Think step by step, then provide your score.

Respond in this exact JSON format:
{{"score": <float 1.0-10.0>, "rationale": "<your reasoning>", "confidence": <float 0.0-1.0>, "suggestions": ["<improvement 1>", "<improvement 2>"]}}""",
    },
    "brand_voice": {
        "name": "Brand Voice",
        "question": "Does it sound like Varsity Tutors?",
        "prompt": """Score this ad copy on BRAND VOICE alignment (1-10).

Brand Voice measures whether the copy sounds distinctly like Varsity Tutors.
Varsity Tutors voice: Empowering, knowledgeable, approachable, results-focused.
- Lead with outcomes, not features
- Confident but not arrogant
- Expert but not elitist
- Meet people where they are

Scoring anchors:
- 1-2: Could be any company, completely generic tone
- 3-4: Partially on-brand but inconsistent or off-tone (too salesy, too formal)
- 5-6: Generally appropriate but lacks distinctive brand personality
- 7-8: Clearly sounds like Varsity Tutors — empowering, knowledgeable, approachable
- 9-10: Perfectly on-brand, could not be mistaken for a competitor

Ad Copy:
Primary Text: {primary_text}
Headline: {headline}
Description: {description}
CTA: {cta_button}

Audience: {audience_segment}
Campaign Goal: {campaign_goal}

CALIBRATION: A score of 7 means "good but with clear room for improvement." A 9+ should be rare — only for copy that genuinely could not be improved. Be precise: use the full 1-10 range, including decimals like 6.5 or 7.3. Do NOT default to 7-8 for everything.

Think step by step, then provide your score.

Respond in this exact JSON format:
{{"score": <float 1.0-10.0>, "rationale": "<your reasoning>", "confidence": <float 0.0-1.0>, "suggestions": ["<improvement 1>", "<improvement 2>"]}}""",
    },
    "emotional_resonance": {
        "name": "Emotional Resonance",
        "question": "Does it tap into real motivation?",
        "prompt": """Score this ad copy on EMOTIONAL RESONANCE (1-10).

Emotional Resonance measures whether the copy connects with the reader's real emotions and motivations.

For SAT test prep, key emotional drivers are:
- Parents: anxiety about child's future, desire for best opportunities
- Students: test anxiety, dream school aspirations, confidence
- Families: overwhelm from choices, desire for proven results

Scoring anchors:
- 1-2: Flat, purely rational, no emotional connection
- 3-4: Attempts emotion but feels forced or generic
- 5-6: Some emotional resonance but doesn't fully land
- 7-8: Taps into real motivation, reader feels understood
- 9-10: Deeply resonant — reader thinks "this is exactly how I feel" (parent worry, student ambition, test anxiety)

Ad Copy:
Primary Text: {primary_text}
Headline: {headline}
Description: {description}
CTA: {cta_button}

Audience: {audience_segment}
Campaign Goal: {campaign_goal}

CALIBRATION: A score of 7 means "good but with clear room for improvement." A 9+ should be rare — only for copy that genuinely could not be improved. Be precise: use the full 1-10 range, including decimals like 6.5 or 7.3. Do NOT default to 7-8 for everything.

Think step by step, then provide your score.

Respond in this exact JSON format:
{{"score": <float 1.0-10.0>, "rationale": "<your reasoning>", "confidence": <float 0.0-1.0>, "suggestions": ["<improvement 1>", "<improvement 2>"]}}""",
    },
}

IMAGE_RUBRIC = {
    "prompt": """Evaluate this ad creative image for a Varsity Tutors SAT prep Facebook/Instagram ad.

The ad copy it accompanies:
Primary Text: {primary_text}
Headline: {headline}

Brand guidelines:
- Style: Clean, modern, aspirational
- Colors: Blue (#1A73E8 primary), white backgrounds, warm accents
- Subjects: Diverse students, positive moods, learning environments
- Avoid: Stock clichés, clutter, too much text overlay, dark imagery

Score on three dimensions (1-10 each):

1. BRAND CONSISTENCY: Does it match Varsity Tutors visual identity?
   - 1-3: Wrong colors, off-brand style, no visual identity match
   - 4-5: Some brand elements but inconsistent
   - 6-7: Generally on-brand, recognizable style
   - 8-9: Strong brand match, professional quality
   - 10: Perfect brand alignment

2. ENGAGEMENT POTENTIAL: Would this stop someone scrolling on Facebook/Instagram?
   - 1-3: Boring, generic, would be skipped instantly
   - 4-5: Somewhat interesting but forgettable
   - 6-7: Catches attention, decent visual appeal
   - 8-9: Compelling, thumb-stopping quality
   - 10: Impossible to scroll past

3. TEXT-IMAGE ALIGNMENT: Does the image complement and reinforce the ad copy message?
   - 1-3: Image contradicts or is irrelevant to the copy
   - 4-5: Loosely related but not reinforcing
   - 6-7: Good match, image supports the message
   - 8-9: Image and copy work as a cohesive unit
   - 10: Perfect synergy between visual and text

IMAGE TECHNICAL QUALITY: Penalize blurry, low-resolution, pixelated, or artifacted images. A sharp, clear image with crisp details should score higher than a conceptually good but technically poor one. Deduct at least 1-2 points from each dimension if the image suffers from soft focus, visible noise, or compression artifacts.

CALIBRATION: Use the full 1-10 range with decimals. A score of 7 means "good with clear room for improvement." 9+ should be rare. Be specific in suggestions — name exact visual elements to change.

Respond in this exact JSON format:
{{"brand_consistency": <float>, "engagement_potential": <float>, "text_image_alignment": <float>, "rationale": "<reasoning>", "suggestions": ["<improvement 1>", "<improvement 2>"]}}""",
}
