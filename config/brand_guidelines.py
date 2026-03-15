"""Varsity Tutors (Nerdy) brand guidelines for ad generation."""

BRAND_NAME = "Varsity Tutors"
PARENT_COMPANY = "Nerdy"

BRAND_VOICE = {
    "tone": "Expert but approachable — never condescending, always encouraging",
    "principles": [
        "Lead with outcomes, not features",
        "Confident but not arrogant",
        "Expert but not elitist",
        "Meet people where they are",
    ],
    "dos": [
        "Use specific numbers and outcomes (e.g., '200+ point improvement')",
        "Address the emotional reality of test prep stress",
        "Highlight personalization and 1-on-1 attention",
        "Include social proof when possible",
        "Use active, direct language",
    ],
    "donts": [
        "Don't use jargon or overly academic language",
        "Don't use corporate jargon or buzzwords",
        "Don't make guarantees without disclaimers",
        "Don't talk down to students or parents",
        "Don't be generic — always be specific",
        "Don't use fear-based messaging without offering hope and a path forward",
    ],
    "proof_points": [
        "50,000+ students helped",
        "Avg 200-point SAT improvement",
        "1-on-1 expert tutoring (not pre-recorded videos)",
    ],
    "voice_examples": [
        "Good: 'Your SAT score doesn't define you — but the right prep can open doors you didn't know existed.'",
        "Good: '50,000 students raised their SAT scores with a tutor who gets them. Your kid could be next.'",
        "Bad: 'Varsity Tutors leverages cutting-edge pedagogical methodologies to optimize student outcomes.'",
    ],
}

APPROVED_CTAS = [
    "Get Started",
    "Start Your Free Trial",
    "Book a Free Session",
    "Start Practicing Free",
    "See Your Score Prediction",
    "Claim Your Spot",
    "Learn More",
    "Sign Up",
    "Get Started Free",
    "Book a Free Diagnostic",
]

AUDIENCE_PROFILES = {
    "parents": {
        "description": "Parents anxious about college admissions, ages 35-55",
        "pain_points": [
            "Worried child won't get into desired college",
            "Overwhelmed by test prep options",
            "Concerned about ROI on tutoring investment",
            "Anxiety about SAT deadlines approaching",
        ],
        "motivators": [
            "Child's success and future",
            "Concrete score improvement evidence",
            "Expert guidance they can trust",
            "Flexible scheduling around busy family life",
        ],
        "messaging_angle": "Your child deserves expert guidance for their future",
    },
    "students": {
        "description": "High school students (grades 9-12) stressed about scores",
        "pain_points": [
            "Test anxiety and performance pressure",
            "Don't know where to start with prep",
            "Bored by traditional study methods",
            "Comparing scores with peers",
        ],
        "motivators": [
            "Getting into dream school",
            "Feeling confident and prepared",
            "Personalized learning (not one-size-fits-all)",
            "Quick, visible progress",
        ],
        "messaging_angle": "You've got this — with the right prep, your dream score is within reach",
    },
    "families": {
        "description": "Families comparing prep options (Princeton Review, Kaplan, Khan Academy, Chegg)",
        "pain_points": [
            "Too many options, hard to compare",
            "Expensive programs with unclear results",
            "Generic programs that don't adapt",
            "Uncertainty about which approach works",
        ],
        "motivators": [
            "Clear ROI and proven results",
            "Personalized vs cookie-cutter approach",
            "Free trial to reduce risk",
            "Trusted platform with real reviews",
        ],
        "messaging_angle": "Why families choose Varsity Tutors over the rest",
    },
}

PRODUCT_OFFERS = [
    "Free SAT diagnostic assessment",
    "1-on-1 SAT tutoring sessions",
    "SAT prep free trial",
    "Personalized SAT study plan",
    "SAT score improvement guarantee program",
]

IMAGE_GUIDELINES = {
    "style": "Clean, modern, aspirational. Authentic photography over stock. Natural lighting, warm tones.",
    "colors": "Blue (#1A73E8 primary), white and bright backgrounds, warm accent colors",
    "subjects": [
        "A diverse group of confident high school students celebrating with SAT score results, bright classroom setting with natural light, one student holding a paper showing 1400+ score",
        "A parent and teenager having a genuine warm moment at a kitchen table with a laptop open to a tutoring session, morning sunlight streaming in, both smiling",
        "A focused student with headphones studying on a laptop in a bright modern café, books and notes around them, looking determined and confident",
        "A young tutor and diverse student in an engaging 1-on-1 session, gesturing at a whiteboard with SAT math problems, both leaning in and energized",
        "A graduating student in cap and gown hugging their parent, overlaid with subtle before/after SAT score graphics (1050 → 1400), celebration confetti",
        "A diverse group of students in a bright study room giving each other high fives, laptops open, sticky notes on wall behind them, energy and teamwork",
        "Close-up of a student's confident face looking up from a test paper, pen in hand, soft background blur, natural warm lighting, subtle smile of determination",
        "Split-screen style: left side shows stressed student surrounded by messy books, right side shows same student confidently studying with a tutor on clean desk",
    ],
    "avoid": [
        "Stock photo clichés (pointing at screens, fake smiles, sterile environments)",
        "Cluttered compositions with too many elements",
        "Excessive text overlay (headline only, 5-8 words max)",
        "Dark, gloomy, or cold imagery",
        "Overly corporate or institutional settings",
    ],
}
