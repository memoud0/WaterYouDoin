// extension/core/classify/__tests__/factualOrNot.test.ts
import { describe, it, expect } from "vitest";
import { factualOrNot } from "../factualOrNot";
import { normalize } from "../../utils/text";
import { fnv1a32 } from "../../utils/hash";
import { classifyComposite } from "../segments";

type Class = "FACTUAL" | "LOW_VALUE" | "REASONING";

function assertEq(prompt: string, actual: Class, expected: Class, resultObj: unknown) {
  expect(
    actual,
    `Prompt: "${prompt}"\nExpected: ${expected}\nGot: ${actual}\nResult:\n${JSON.stringify(resultObj, null, 2)}`
  ).toBe(expected);
}

function assertIn(prompt: string, actual: Class, allowed: Class[], resultObj: unknown) {
  expect(
    allowed,
    `Prompt: "${prompt}"\nExpected one of: ${allowed.join(", ")}\nGot: ${actual}\nResult:\n${JSON.stringify(resultObj, null, 2)}`
  ).toContain(actual);
}

// ------------------- TEST DATA (150+ prompts) -------------------

const MUST_FACTUAL: string[] = [
  // Classic WH lookups
  "What is the capital of Japan?",
  "What is the capital of Canada?",
  "What is the capital of Brazil?",
  "What is the capital of Australia?",
  "What is the capital of Germany?",
  "What is the capital of France?",
  "What is the capital of Italy?",
  "What is the capital of Spain?",
  "What is the capital of Mexico?",
  "What is the capital of Argentina?",

  "Who is Ada Lovelace?",
  "Who is Alan Turing?",
  "Who is Grace Hopper?",
  "Who is Linus Torvalds?",
  "Who is Margaret Hamilton?",
  "Who is Tim Berners-Lee?",
  "Who is Guido van Rossum?",
  "Who is Dennis Ritchie?",
  "Who is Ken Thompson?",
  "Who is James Gosling?",

  "When was React released?",
  "When was Java released?",
  "When was Python created?",
  "When was TypeScript released?",
  "When was Linux created?",
  "When was Git created?",
  "When was Docker first released?",
  "When was Kubernetes released?",
  "When was HTTP/2 standardized?",
  "When was HTML5 finalized?",

  // Define / meaning
  "Define dependency injection",
  "Define polymorphism",
  "Define encapsulation",
  "Define recursion",
  "Define memoization",
  "Meaning of polymorphism",
  "Meaning of idempotent",
  "Definition of REST",
  "Definition of CAP theorem",
  "Meaning of OAuth",

  // “What does X mean”
  "What does HTTP 404 mean?",
  "What does HTTP 500 mean?",
  "What does DNS stand for?",
  "What does JWT stand for?",
  "What does CORS mean?",
  "What does SQL stand for?",
  "What does CI/CD mean?",
  "What does UTF-8 mean?",
  "What does SHA-256 mean?",
  "What does JSON mean?",

  // Lookup noun-of forms
  "Population of Canada",
  "Population of Japan",
  "Population of France",
  "Timezone of Montreal",
  "Timezone of Tokyo",
  "Timezone of London",
  "Release date of TypeScript",
  "Release date of Java",
  "Syntax for a Python list comprehension",
  "Syntax for a JavaScript arrow function",

  // “How many / how much” factual
  "How many bytes are in a kilobyte?",
  "How many bits are in a byte?",
  "How many seconds in a day?",
  "How many milliseconds in a second?",
  "How much is 1 GB in MB?",
  "How many bits in IPv4 address?",
  "How many bits in IPv6 address?",
  "How many days in a leap year?",
  "How many minutes in an hour?",
  "How much is 1 TB in GB?",

  // Quick factual “what is”
  "What is TCP?",
  "What is UDP?",
  "What is DNS?",
  "What is HTTP?",
  "What is HTTPS?",
  "What is TLS?",
  "What is SSH?",
  "What is OAuth?",
  "What is OpenID Connect?",
  "What is a CDN?",
];

const MUST_LOW_VALUE: string[] = [
  "hi",
  "hello",
  "hey",
  "yo",
  "thanks",
  "thank you",
  "thx",
  "ok",
  "okay",
  "k",
  "cool",
  "nice",
  "lol",
  "lmao",
  "got it",
  "makes sense",
  "awesome",
  "👍",
  "??",
  "...",
  "!!!",
  "   ",
  "\n\n",
  "😂",
  "🔥",
  "✅",
  "—",
  ".",
];

const MUST_REASONING: string[] = [
  // Compare / tradeoffs
  "Compare Redux vs Zustand for a large React app and explain tradeoffs",
  "Compare Postgres vs MySQL for write-heavy workloads",
  "Compare REST vs GraphQL for a mobile client and explain pros/cons",
  "Compare server-side rendering vs client-side rendering",
  "Compare OAuth vs SAML for enterprise auth",

  // Design / architecture
  "Design a caching strategy for this API with rate limiting",
  "Design a state machine for a checkout flow with retries",
  "Design a database schema for a multi-tenant SaaS",
  "Architect a file upload pipeline with virus scanning",
  "Propose an architecture for real-time chat with websockets",
  "Design an observability strategy (logs/metrics/tracing) for microservices",
  "Design a queue-based worker system for image processing",
  "Design a sharding strategy for a growing user table",
  "Design a feature-flag system with gradual rollout",
  "Design a robust retry strategy with exponential backoff",

  // Implement/build
  "Implement a binary search tree in TypeScript and explain complexity",
  "Implement rate limiting (token bucket) in Node.js",
  "Implement debouncing in JavaScript and show an example",
  "Build a CLI tool that parses args and writes a config file",
  "Write a function that deep-merges two objects without mutation",
  "Build a React hook for polling with cancellation",
  "Implement a simple pub/sub in TypeScript",
  "Write an LRU cache class in TypeScript",
  "Build a small parser for arithmetic expressions",
  "Implement Dijkstra's algorithm and explain it",

  // Debug/fix/optimize
  "Help me debug why my React component re-renders infinitely",
  "Fix this TypeError: Cannot read properties of undefined — why is it happening?",
  "Debug why my fetch request is being blocked by CORS",
  "Optimize this SQL query and explain the indexing strategy",
  "Refactor this function for readability and performance",
  "My Node process memory keeps growing; how do I debug a leak?",
  "Why is my Docker image so large and how can I reduce it?",
  "My Kubernetes pod keeps crashing (CrashLoopBackOff); how do I troubleshoot?",
  "My tests are flaky in CI but not locally; what should I check?",
  "I get a segmentation fault in C; what debugging steps should I take?",

  // Code-heavy
  `What is wrong with this code?
\`\`\`ts
function f(){ return foo.bar.baz }
\`\`\`
It throws TypeError.`,
  `Debug this error:
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    print(x.y)
AttributeError: 'NoneType' object has no attribute 'y'`,
  `Refactor this:
\`\`\`js
for (var i=0;i<a.length;i++){ for (var j=0;j<b.length;j++){ if(a[i]===b[j]){ out.push(a[i]) } } }
\`\`\``,
  `I have this SQL:
SELECT * FROM users u JOIN orders o ON u.id=o.user_id WHERE o.created_at > NOW() - interval '7 days';
How do I make it faster?`,
  `My React hook:
\`\`\`tsx
useEffect(() => { setCount(count+1) }, [count])
\`\`\`
Why is it looping?`,
];

const EDGE_NOT_LOW_VALUE: string[] = [
  "jwt exp?",
  "oauth flow?",
  "cors?",
  "tcp handshake?",
  "dns ttl?",
  "http 418?",
  "etag?",
  "grpc?",
  "css grid gap?",
  "ts generics?",
  "regex lookbehind?",
  "ssh keys?",
  "docker compose?",
  "k8s ingress?",
  "sqlite pragma?",
  "git rebase?",
  "npm audit?",
  "python venv?",
  "react memo?",
  "sql join?",
  "utf-8?",
  "sha-256?",
  "base64?",
  "gzip?",
  "protobuf?",
];

// ------------------- PER-PROMPT TESTS (150+ individual tests) -------------------

describe("factualOrNot() classification (big suite, per-prompt)", () => {
  it.each(MUST_FACTUAL)("FACTUAL: %s", (prompt) => {
    const r = factualOrNot(prompt);
    assertEq(prompt, r.classification, "FACTUAL", r);
  });

  it.each(MUST_LOW_VALUE)("LOW_VALUE: %s", (prompt) => {
    const r = factualOrNot(prompt);
    assertEq(prompt, r.classification, "LOW_VALUE", r);
  });

  it.each(MUST_REASONING)("REASONING: %s", (prompt) => {
    const r = factualOrNot(prompt);
    assertEq(prompt, r.classification, "REASONING", r);
  });

  it.each(EDGE_NOT_LOW_VALUE)("NOT LOW_VALUE (edge): %s", (prompt) => {
    const r = factualOrNot(prompt);
    assertIn(prompt, r.classification, ["FACTUAL", "REASONING"], r);
  });

  it("duplicate check returns LOW_VALUE within window", () => {
    const prompt = "Why is my React hook causing an infinite loop?";
    const h = fnv1a32(normalize(prompt));

    const r2 = factualOrNot(prompt, {
      lastHash: h,
      lastTimestamp: 1000,
      nowTimestamp: 2000,
      duplicateWindowMs: 8000,
    });

    expect(
      r2.classification,
      `Duplicate test failed.\nPrompt: "${prompt}"\nResult:\n${JSON.stringify(r2, null, 2)}`
    ).toBe("LOW_VALUE");
    expect(r2.signals).toContain("duplicate_prompt");
  });

  it("duplicate check blocks same normalized content quickly (whitespace/punct variants)", () => {
    const promptA = "  Thanks!!  ";
    const promptB = "thanks";
    const h = fnv1a32(normalize(promptA));

    const r = factualOrNot(promptB, {
      lastHash: h,
      lastTimestamp: 10,
      nowTimestamp: 2000,
      duplicateWindowMs: 8000,
    });

    expect(
      r.classification,
      `Duplicate variant test failed.\nA: "${promptA}"\nB: "${promptB}"\nResult:\n${JSON.stringify(r, null, 2)}`
    ).toBe("LOW_VALUE");
    expect(r.signals).toContain("duplicate_prompt");
  });

  it("composite classifier still flags duplicates across multi-sentence prompt", () => {
    const prompt = "Thanks! Now, compare Redis vs Kafka and explain.";
    const hash = fnv1a32(normalize(prompt));

    const r = classifyComposite(prompt, {
      lastHash: hash,
      lastTimestamp: 1000,
      nowTimestamp: 2000,
      duplicateWindowMs: 8000,
      modelWeights: undefined,
    });

    expect(r.classification).toBe("LOW_VALUE");
    expect(r.signals).toContain("duplicate_prompt");
  });
});
