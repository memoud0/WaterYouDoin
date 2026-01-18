from featurize import extract_features

tests = [
    "What's the capital of Japan?",
    "whats the capital of japan??",
    "okkk",
    "Syntax for a JavaScript arrow function",
    "debug why my react rerenders infinitely",
]

for t in tests:
    norm, f = extract_features(t)
    print("RAW:", t)
    print("NORM:", norm)
    print("VEC :", f.to_vector())
    print()
