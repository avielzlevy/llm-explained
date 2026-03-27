"""
Generate semantic_map.json for the LLM Explained visualization.

This script:
1. Downloads all-MiniLM-L6-v2 (a fast, general-purpose sentence embedding model)
2. Embeds ~10,000 common English words
3. Runs PCA to project into 2D
4. Saves the 2D coordinates + PCA transform to public/semantic_map.json

Run once before starting the app:
  pip install sentence-transformers scikit-learn numpy
  python scripts/generate_semantic_map.py
"""

import json
import os
import numpy as np
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sentence_transformers import SentenceTransformer
import umap

# ---------------------------------------------------------------------------
# Word list — ~10k common English words covering broad semantic space
# ---------------------------------------------------------------------------

WORD_CATEGORIES = {
    "animals": [
        "dog", "cat", "bird", "fish", "horse", "cow", "pig", "sheep", "goat", "chicken",
        "duck", "rabbit", "mouse", "rat", "hamster", "guinea pig", "parrot", "turtle",
        "snake", "lizard", "frog", "toad", "salamander", "crocodile", "alligator",
        "elephant", "lion", "tiger", "leopard", "cheetah", "jaguar", "panther",
        "bear", "wolf", "fox", "deer", "moose", "elk", "bison", "buffalo",
        "giraffe", "zebra", "hippo", "rhino", "gorilla", "chimpanzee", "monkey",
        "dolphin", "whale", "shark", "octopus", "squid", "jellyfish", "crab", "lobster",
        "shrimp", "clam", "oyster", "mussel", "starfish", "seahorse", "eel",
        "eagle", "hawk", "owl", "falcon", "raven", "crow", "sparrow", "robin",
        "penguin", "flamingo", "peacock", "toucan", "parrot", "pigeon", "dove",
        "ant", "bee", "butterfly", "moth", "dragonfly", "beetle", "spider", "scorpion",
        "worm", "snail", "slug", "centipede", "mosquito", "fly", "wasp", "grasshopper",
        "panda", "koala", "kangaroo", "wallaby", "platypus", "otter", "seal", "walrus",
        "meerkat", "mongoose", "badger", "hedgehog", "porcupine", "armadillo",
    ],
    "emotions": [
        "happy", "sad", "angry", "fear", "joy", "love", "hate", "disgust", "surprise",
        "anticipation", "trust", "anxiety", "depression", "excitement", "boredom",
        "loneliness", "jealousy", "envy", "pride", "shame", "guilt", "embarrassment",
        "gratitude", "compassion", "empathy", "sympathy", "nostalgia", "melancholy",
        "euphoria", "contentment", "satisfaction", "frustration", "disappointment",
        "hope", "despair", "confusion", "curiosity", "wonder", "awe", "admiration",
        "contempt", "grief", "sorrow", "rage", "fury", "panic", "terror", "dread",
        "relief", "serenity", "tranquility", "bliss", "ecstasy", "misery", "agony",
        "courage", "confidence", "insecurity", "doubt", "nervousness", "stress",
        "cheerful", "gloomy", "optimistic", "pessimistic", "enthusiastic", "apathetic",
    ],
    "technology": [
        "computer", "laptop", "phone", "tablet", "keyboard", "mouse", "monitor", "printer",
        "internet", "wifi", "bluetooth", "server", "network", "database", "cloud",
        "software", "hardware", "algorithm", "code", "programming", "javascript", "python",
        "java", "cpp", "rust", "typescript", "html", "css", "react", "vue", "angular",
        "api", "rest", "graphql", "json", "xml", "http", "tcp", "dns", "ssl",
        "machine learning", "artificial intelligence", "neural network", "deep learning",
        "transformer", "llm", "gpt", "embedding", "vector", "attention", "token",
        "robot", "drone", "satellite", "rocket", "spacecraft", "telescope",
        "battery", "solar panel", "electric car", "semiconductor", "chip", "gpu", "cpu",
        "blockchain", "cryptocurrency", "bitcoin", "encryption", "cybersecurity",
        "smartphone", "smartwatch", "vr", "ar", "metaverse", "gaming", "console",
        "app", "startup", "tech", "innovation", "automation", "data", "analytics",
        "operating system", "linux", "windows", "macos", "android", "ios",
        "repository", "git", "docker", "kubernetes", "devops", "agile", "scrum",
    ],
    "food": [
        "apple", "banana", "orange", "grape", "strawberry", "blueberry", "cherry",
        "watermelon", "mango", "pineapple", "peach", "pear", "plum", "lemon", "lime",
        "bread", "butter", "cheese", "milk", "cream", "yogurt", "egg", "bacon",
        "chicken", "beef", "pork", "lamb", "salmon", "tuna", "shrimp", "lobster",
        "rice", "pasta", "noodle", "pizza", "burger", "sandwich", "taco", "burrito",
        "soup", "salad", "steak", "sushi", "ramen", "curry", "stew", "roast",
        "chocolate", "cake", "cookie", "pie", "ice cream", "candy", "sugar", "honey",
        "coffee", "tea", "juice", "water", "soda", "beer", "wine", "cocktail",
        "salt", "pepper", "garlic", "onion", "tomato", "potato", "carrot", "broccoli",
        "spinach", "kale", "lettuce", "cucumber", "mushroom", "corn", "beans", "peas",
        "olive oil", "vinegar", "mustard", "ketchup", "mayonnaise", "sauce", "spice",
        "breakfast", "lunch", "dinner", "snack", "meal", "recipe", "cook", "bake",
        "restaurant", "cafe", "kitchen", "chef", "feast", "diet", "nutrition",
    ],
    "nature": [
        "tree", "forest", "mountain", "river", "ocean", "lake", "beach", "desert",
        "jungle", "meadow", "valley", "canyon", "cliff", "island", "volcano", "glacier",
        "sun", "moon", "star", "cloud", "rain", "snow", "wind", "storm", "thunder",
        "lightning", "rainbow", "fog", "mist", "ice", "fire", "water", "earth", "air",
        "flower", "grass", "leaf", "seed", "root", "bark", "branch", "twig", "vine",
        "rose", "tulip", "sunflower", "daisy", "orchid", "lily", "lavender", "fern",
        "oak", "pine", "maple", "birch", "willow", "palm", "bamboo", "cactus",
        "rock", "stone", "sand", "mud", "soil", "clay", "crystal", "gem", "mineral",
        "gold", "silver", "diamond", "emerald", "ruby", "sapphire", "pearl", "coral",
        "spring", "summer", "autumn", "winter", "sunrise", "sunset", "twilight", "dawn",
        "ecosystem", "habitat", "climate", "weather", "atmosphere", "oxygen", "carbon",
        "photosynthesis", "evolution", "biodiversity", "extinction", "conservation",
    ],
    "space": [
        "space", "galaxy", "universe", "cosmos", "nebula", "supernova", "blackhole",
        "asteroid", "comet", "meteor", "planet", "orbit", "gravity", "light",
        "sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune",
        "moon", "titan", "europa", "ganymede", "io", "pluto", "ceres",
        "milky way", "andromeda", "quasar", "pulsar", "neutron star", "white dwarf",
        "telescope", "hubble", "james webb", "nasa", "esa", "spacex", "rocket",
        "astronaut", "cosmonaut", "spacewalk", "launch", "orbit", "mission", "probe",
        "dark matter", "dark energy", "relativity", "quantum", "wormhole", "dimension",
        "extraterrestrial", "alien", "ufo", "seti", "signal", "interstellar",
        "exoplanet", "habitable zone", "atmosphere", "radiation", "magnetic field",
    ],
    "body_health": [
        "heart", "brain", "lung", "liver", "kidney", "stomach", "muscle", "bone",
        "blood", "skin", "eye", "ear", "nose", "mouth", "hand", "foot", "arm", "leg",
        "spine", "nerve", "vein", "artery", "cell", "gene", "dna", "protein",
        "health", "medicine", "doctor", "nurse", "hospital", "surgery", "therapy",
        "vaccine", "virus", "bacteria", "infection", "immune system", "antibody",
        "cancer", "diabetes", "heart disease", "obesity", "depression", "anxiety",
        "fitness", "exercise", "yoga", "meditation", "diet", "sleep", "stress",
        "pain", "fever", "headache", "fatigue", "nausea", "injury", "wound", "scar",
        "pregnancy", "birth", "growth", "aging", "death", "consciousness", "memory",
    ],
    "society_culture": [
        "family", "friend", "love", "marriage", "divorce", "child", "parent", "sibling",
        "community", "society", "culture", "tradition", "religion", "faith", "church",
        "government", "politics", "democracy", "law", "justice", "freedom", "rights",
        "war", "peace", "conflict", "revolution", "protest", "movement", "activism",
        "race", "ethnicity", "gender", "identity", "diversity", "equality", "inclusion",
        "education", "school", "university", "teacher", "student", "learning", "knowledge",
        "art", "music", "literature", "poetry", "painting", "sculpture", "film", "theater",
        "sport", "football", "basketball", "soccer", "tennis", "swimming", "running",
        "economy", "money", "wealth", "poverty", "trade", "market", "bank", "investment",
        "media", "news", "journalism", "social media", "propaganda", "censorship",
        "history", "civilization", "empire", "colonialism", "revolution", "renaissance",
        "language", "communication", "writing", "reading", "publishing", "library",
    ],
    "abstract": [
        "time", "space", "energy", "power", "force", "change", "growth", "decay",
        "beginning", "end", "past", "present", "future", "eternity", "infinity",
        "truth", "lie", "good", "evil", "beauty", "ugliness", "justice", "injustice",
        "order", "chaos", "balance", "harmony", "conflict", "resolution", "paradox",
        "reality", "illusion", "perception", "consciousness", "thought", "idea", "concept",
        "logic", "reason", "intuition", "creativity", "imagination", "inspiration",
        "success", "failure", "risk", "opportunity", "challenge", "solution", "problem",
        "meaning", "purpose", "value", "belief", "philosophy", "ethics", "morality",
        "pattern", "structure", "system", "complexity", "simplicity", "emergence",
        "cause", "effect", "probability", "certainty", "uncertainty", "randomness",
        "memory", "forgetting", "learning", "wisdom", "intelligence", "consciousness",
        "freedom", "constraint", "choice", "destiny", "luck", "fate", "coincidence",
    ],
    "verbs_actions": [
        "run", "walk", "jump", "swim", "fly", "climb", "fall", "rise", "move", "stop",
        "think", "feel", "see", "hear", "touch", "taste", "smell", "speak", "listen",
        "create", "destroy", "build", "break", "fix", "change", "grow", "shrink",
        "open", "close", "push", "pull", "lift", "drop", "throw", "catch", "hold",
        "eat", "drink", "sleep", "wake", "breathe", "laugh", "cry", "smile", "frown",
        "work", "play", "rest", "learn", "teach", "help", "hurt", "love", "hate",
        "give", "take", "buy", "sell", "find", "lose", "win", "fail", "try", "quit",
        "start", "finish", "continue", "pause", "wait", "rush", "delay", "plan",
        "decide", "choose", "refuse", "accept", "agree", "disagree", "argue", "debate",
        "write", "read", "draw", "paint", "sing", "dance", "play", "watch", "listen",
        "travel", "arrive", "leave", "return", "explore", "discover", "invent", "innovate",
    ],
    "adjectives": [
        "big", "small", "tall", "short", "wide", "narrow", "thick", "thin", "heavy", "light",
        "fast", "slow", "strong", "weak", "hard", "soft", "rough", "smooth", "sharp", "dull",
        "hot", "cold", "warm", "cool", "wet", "dry", "bright", "dark", "loud", "quiet",
        "old", "new", "young", "ancient", "modern", "fresh", "stale", "alive", "dead",
        "good", "bad", "beautiful", "ugly", "clean", "dirty", "rich", "poor", "smart", "foolish",
        "happy", "sad", "angry", "calm", "excited", "bored", "scared", "brave", "kind", "cruel",
        "honest", "deceptive", "generous", "selfish", "patient", "impatient", "careful", "reckless",
        "complex", "simple", "clear", "confusing", "obvious", "mysterious", "familiar", "strange",
        "important", "trivial", "urgent", "casual", "formal", "informal", "serious", "funny",
        "real", "fake", "possible", "impossible", "necessary", "optional", "visible", "invisible",
    ],
    "places": [
        "home", "house", "apartment", "building", "room", "kitchen", "bedroom", "bathroom",
        "office", "school", "hospital", "church", "museum", "library", "stadium", "theater",
        "store", "market", "mall", "restaurant", "cafe", "bar", "hotel", "airport", "station",
        "park", "garden", "playground", "beach", "forest", "mountain", "city", "town", "village",
        "country", "continent", "world", "universe", "street", "road", "bridge", "tunnel",
        "usa", "china", "india", "russia", "brazil", "japan", "germany", "france", "uk",
        "new york", "london", "paris", "tokyo", "beijing", "moscow", "sydney", "dubai",
        "africa", "europe", "asia", "america", "australia", "arctic", "antarctic",
        "border", "territory", "region", "district", "neighborhood", "suburb", "downtown",
    ],
    "science_math": [
        "physics", "chemistry", "biology", "mathematics", "statistics", "geometry", "algebra",
        "calculus", "probability", "number", "equation", "formula", "theorem", "proof",
        "hypothesis", "experiment", "observation", "data", "analysis", "conclusion",
        "atom", "molecule", "element", "compound", "reaction", "energy", "mass", "force",
        "velocity", "acceleration", "momentum", "gravity", "magnetism", "electricity",
        "wave", "frequency", "amplitude", "resonance", "quantum", "relativity",
        "evolution", "genetics", "cell", "organism", "species", "ecosystem", "entropy",
        "temperature", "pressure", "volume", "density", "viscosity", "conductivity",
        "acid", "base", "salt", "oxidation", "reduction", "catalyst", "polymer",
        "circle", "square", "triangle", "sphere", "cube", "cylinder", "angle", "area",
        "infinity", "zero", "negative", "positive", "prime", "rational", "irrational",
    ],
    "misc_common": [
        "thing", "object", "item", "stuff", "matter", "case", "point", "fact", "reason",
        "way", "method", "process", "step", "stage", "level", "degree", "amount", "number",
        "part", "piece", "section", "group", "set", "list", "order", "series", "sequence",
        "type", "kind", "form", "shape", "size", "color", "red", "blue", "green", "yellow",
        "black", "white", "gray", "purple", "orange", "pink", "brown", "gold", "silver",
        "day", "night", "morning", "afternoon", "evening", "hour", "minute", "second",
        "week", "month", "year", "decade", "century", "moment", "period", "era", "age",
        "north", "south", "east", "west", "up", "down", "left", "right", "center", "edge",
        "front", "back", "inside", "outside", "above", "below", "near", "far", "between",
        "yes", "no", "maybe", "always", "never", "sometimes", "often", "rarely",
        "first", "last", "next", "previous", "current", "former", "latter", "both",
        "more", "less", "most", "least", "many", "few", "some", "all", "none", "any",
        "very", "quite", "rather", "slightly", "extremely", "almost", "exactly", "only",
        "also", "too", "even", "just", "still", "already", "yet", "soon", "now", "then",
    ],
}

def get_all_words():
    words = []
    for category_words in WORD_CATEGORIES.values():
        words.extend(category_words)
    # Deduplicate while preserving order
    seen = set()
    unique = []
    for w in words:
        if w not in seen:
            seen.add(w)
            unique.append(w)
    return unique

def main():
    words = get_all_words()
    print(f"Total words: {len(words)}")

    print("Loading model all-MiniLM-L6-v2...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    print("Embedding words (this may take a minute)...")
    embeddings = model.encode(words, batch_size=256, show_progress_bar=True)
    print(f"Embeddings shape: {embeddings.shape}")

    # Step 1: PCA to 32D — used for k-NN lookup of new embeddings in JS
    PCA_DIMS = 32
    print(f"Running PCA to {PCA_DIMS}D...")
    pca = PCA(n_components=PCA_DIMS, random_state=42)
    coords_pca = pca.fit_transform(embeddings)  # [N, 32]

    # Step 2: UMAP from 32D to 3D — depth separates overlapping clusters
    print("Running UMAP to 3D (this takes ~30s)...")
    reducer = umap.UMAP(
        n_components=3,
        n_neighbors=15,
        min_dist=0.1,
        spread=3.0,
        metric="euclidean",
        random_state=42,
    )
    coords_3d = reducer.fit_transform(coords_pca)  # [N, 3]

    # Normalize each axis to [-1, 1]
    for i in range(3):
        col = coords_3d[:, i]
        max_abs = float(np.abs(col).max())
        if max_abs > 0:
            coords_3d[:, i] = col / max_abs

    # Select landmark words: one representative per cluster, spread across the space
    print("Selecting landmarks...")
    N_LANDMARKS = 40
    kmeans = KMeans(n_clusters=N_LANDMARKS, random_state=42, n_init=10)
    cluster_labels = kmeans.fit_predict(coords_3d)
    landmark_indices = set()
    for c in range(N_LANDMARKS):
        idxs = np.where(cluster_labels == c)[0]
        center = kmeans.cluster_centers_[c]
        dists = np.linalg.norm(coords_3d[idxs] - center, axis=1)
        landmark_indices.add(int(idxs[np.argmin(dists)]))

    # Round word PCA vectors to 5 decimal places to reduce JSON size
    word_vectors = np.round(coords_pca, 5).tolist()

    print("Saving semantic_map.json...")
    output = {
        "words": [
            {
                "word": word,
                "x": float(coords_3d[i, 0]),
                "y": float(coords_3d[i, 1]),
                "z": float(coords_3d[i, 2]),
                "landmark": i in landmark_indices,
            }
            for i, word in enumerate(words)
        ],
        # Projection params used by JS to place new embeddings via k-NN interpolation:
        # 1. Project new 384D embedding → 32D PCA space
        # 2. Find k nearest neighbors in 32D using word_vectors
        # 3. Interpolate their UMAP 2D coords (inverse-distance weighted)
        "projection": {
            "pca_mean": pca.mean_.tolist(),
            "pca_components": [np.round(c, 6).tolist() for c in pca.components_],
            "word_vectors": word_vectors,  # [N, 32] — for k-NN distance lookup
        },
    }

    out_path = os.path.join(os.path.dirname(__file__), "..", "public", "semantic_map.json")
    out_path = os.path.abspath(out_path)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    with open(out_path, "w") as f:
        json.dump(output, f)

    print(f"Saved to {out_path}")
    print(f"PCA explained variance (32D): {pca.explained_variance_ratio_.sum():.3f}")
    print("Done!")

if __name__ == "__main__":
    main()
