# AI Fit Score vs Pipeline Decision - Conflation Issue

## 🐛 **Problem Statement**

**Issue:** AI fit score and pipeline decision are conflated — two grants with identical 95% fit scores receive different decisions (Apply vs Maybe)

**Root Cause:** The system conflates three separate concepts:
1. **AI Fit Score** (0-100 objective assessment)
2. **AI Verdict** (Strong Fit, Good Fit, etc.)
3. **User Decision** (Apply, Maybe, No, Rejected)

**Impact:** Decision logic is opaque, inconsistent, and confusing to users.

---

## 📊 **Current Implementation Analysis**

### **Location:** `src/app/api/grants/analyse/route.ts`

### **The Conflation (Lines 233-238):**

```typescript
// Only auto-set decision if the user hasn't manually chosen one
const currentDecision = (grant as Record<string, unknown>).decision as string | null;
const autoDecision = verdict === "Strong Fit" || verdict === "Good Fit" ? "Apply"
  : verdict === "Not Eligible" ? "No" : "Maybe";
const decision = currentDecision ?? autoDecision;
const decisionUpdate = currentDecision ? {} : { decision };
```

### **What This Does:**

1. **AI generates score** (0-100) based on 6 weighted dimensions
2. **Score maps to verdict** using hardcoded bands:
   ```typescript
   const SCORE_BANDS = [
     { min: 76, verdict: "Strong Fit" },    // 76-100
     { min: 56, verdict: "Good Fit" },      // 56-75
     { min: 36, verdict: "Possible Fit" },  // 36-55
     { min: 16, verdict: "Weak Fit" },      // 16-35
     { min: 0,  verdict: "Not Eligible" },  // 0-15
   ];
   ```

3. **Verdict auto-sets decision** (if not already set):
   ```typescript
   "Strong Fit" → "Apply"
   "Good Fit"   → "Apply"
   "Possible Fit" → "Maybe"
   "Weak Fit"   → "Maybe"
   "Not Eligible" → "No"
   ```

4. **Decision is saved to Grant.decision** (one-time only)

---

## 🚨 **Why This Causes the Reported Issue**

### **Scenario: Two grants with 95% fit score**

**Grant A:**
- AI analyzes → score: 95 → verdict: "Strong Fit" → auto-decision: "Apply"
- User never touches it
- **Shows:** 95% score, "Apply" decision ✅

**Grant B:**
- AI analyzes → score: 95 → verdict: "Strong Fit" → auto-decision: "Apply"
- User manually changes decision to "Maybe" (e.g., timeline concerns)
- AI re-runs (user clicks "Re-analyze")
- **Logic:** `currentDecision = "Maybe"` → `decisionUpdate = {}` → decision stays "Maybe"
- **Shows:** 95% score, "Maybe" decision ❌

**Result:** Identical 95% scores, different decisions → **Opaque and confusing**

---

## 🔍 **Root Cause Analysis**

### **Three Conflated Concepts:**

| Concept | What It Is | Who Sets It | Should Change? |
|---------|-----------|-------------|----------------|
| **aiScore** | 0-100 objective fit assessment | AI (always) | Yes (on re-analyze) |
| **aiVerdict** | Strong Fit, Good Fit, etc. | AI (derived from score) | Yes (on re-analyze) |
| **decision** | Apply, Maybe, No, Rejected | AI (first time) OR User (manual) | Only if user changes |

### **The Problem:**

1. **`decision` is overloaded** - It represents BOTH:
   - AI's recommendation (auto-set)
   - User's final decision (manual override)

2. **No way to distinguish** between:
   - "AI says Apply, user agrees" (implicit)
   - "AI says Apply, user overrode to Maybe" (explicit)

3. **Re-analysis doesn't update decision** - Once user touches it, AI recommendation is lost

4. **No audit trail** - Can't see:
   - What AI originally recommended
   - When user overrode it
   - Why decision differs from score

---

## 📐 **Proper Separation Design**

### **What Should Exist:**

```typescript
interface Grant {
  // AI Assessment (always updated on re-analyze)
  aiScore: number;           // 0-100 objective fit
  aiVerdict: string;         // "Strong Fit", "Good Fit", etc.
  aiRecommendation: string;  // "Apply", "Maybe", "No" (AI's suggestion)
  aiAnalysis: object;        // Full AI reasoning
  
  // User Decision (only changed by user)
  decision: string | null;   // "Apply", "Maybe", "No", "Rejected" (user's choice)
  decisionReason: string | null;  // Why user overrode AI (optional)
  decisionAt: Date | null;   // When user made decision
  
  // Derived
  isDecisionOverride: boolean;  // decision !== aiRecommendation
}
```

### **Clear Separation:**

| Field | Purpose | Updated By | Updated When |
|-------|---------|-----------|--------------|
| `aiScore` | Objective fit (0-100) | AI | Every analysis |
| `aiVerdict` | Fit category | AI (derived) | Every analysis |
| `aiRecommendation` | AI's suggested action | AI (derived) | Every analysis |
| `decision` | User's final choice | User | Manual change only |
| `decisionReason` | Why override | User | When overriding |

---

## 🎯 **Correct Logic**

### **On AI Analysis:**

```typescript
// 1. AI generates score
const score = 95;

// 2. Derive verdict from score
const verdict = verdictFromScore(score); // "Strong Fit"

// 3. Derive AI recommendation from verdict
const aiRecommendation = verdict === "Strong Fit" || verdict === "Good Fit" ? "Apply"
  : verdict === "Not Eligible" ? "No" : "Maybe";

// 4. Save AI assessment (always update)
await db.from("Grant").update({
  aiScore: score,
  aiVerdict: verdict,
  aiRecommendation: aiRecommendation,  // NEW FIELD
  aiAnalysis: analysis,
  updatedAt: new Date().toISOString(),
}).eq("id", grantId);

// 5. DO NOT touch user's decision
// User decision is separate and only changed by user
```

### **On User Decision Change:**

```typescript
// User clicks "Apply" button
await db.from("Grant").update({
  decision: "Apply",
  decisionReason: null,  // No override
  decisionAt: new Date().toISOString(),
}).eq("id", grantId);

// User clicks "Maybe" when AI says "Apply"
await db.from("Grant").update({
  decision: "Maybe",
  decisionReason: "Timeline too tight",  // User explains override
  decisionAt: new Date().toISOString(),
}).eq("id", grantId);
```

---

## 🎨 **UI Improvements**

### **Current UI (Confusing):**

```
Grant: Example Foundation
Score: 95% ⭐⭐⭐⭐⭐
Decision: Maybe [dropdown]
```

**Problem:** User sees 95% but "Maybe" decision → Why?

### **Improved UI (Clear):**

```
Grant: Example Foundation

AI Assessment:
  Score: 95% ⭐⭐⭐⭐⭐ (Strong Fit)
  AI Recommends: Apply ✓

Your Decision:
  [Apply] [Maybe] [No] [Rejected]
  
  ⚠️ You selected "Maybe" (AI recommends "Apply")
  Reason: Timeline too tight
```

**Benefits:**
- Clear separation between AI assessment and user decision
- User sees when they've overridden AI
- Reason field explains why override
- Re-analysis updates AI recommendation but preserves user decision

---

## 🔧 **Implementation Plan**

### **1. Database Migration**

```sql
-- Add new fields to Grant table
ALTER TABLE "Grant"
  ADD COLUMN IF NOT EXISTS "aiRecommendation" TEXT 
    CHECK ("aiRecommendation" IN ('Apply', 'Maybe', 'No')),
  ADD COLUMN IF NOT EXISTS "decisionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "decisionAt" TIMESTAMPTZ;

-- Backfill aiRecommendation from existing decision for grants with aiScore
UPDATE "Grant"
SET "aiRecommendation" = CASE
  WHEN "aiVerdict" IN ('Strong Fit', 'Good Fit') THEN 'Apply'
  WHEN "aiVerdict" = 'Not Eligible' THEN 'No'
  ELSE 'Maybe'
END
WHERE "aiScore" IS NOT NULL AND "aiRecommendation" IS NULL;

-- Create index for filtering by override status
CREATE INDEX IF NOT EXISTS "Grant_decision_override_idx" 
  ON "Grant" (("decision" IS DISTINCT FROM "aiRecommendation"));
```

### **2. Update API Route** (`src/app/api/grants/analyse/route.ts`)

```typescript
// Lines 233-238 - REPLACE WITH:

// Derive AI recommendation from verdict (always update)
const aiRecommendation = verdict === "Strong Fit" || verdict === "Good Fit" ? "Apply"
  : verdict === "Not Eligible" ? "No" : "Maybe";

// Update AI assessment fields (always)
const { error: updateErr } = await db.from("Grant").update({
  aiScore: score,
  aiVerdict: verdict,
  aiRecommendation: aiRecommendation,  // NEW: AI's suggestion
  aiAnalysis: analysis,
  updatedAt: new Date().toISOString(),
  // DO NOT update decision - that's user-controlled
}).eq("id", grantId);

// Return AI recommendation separately from decision
return NextResponse.json({ 
  success: true, 
  analysis: { ...analysis, verdict },
  aiRecommendation: aiRecommendation,  // NEW: Tell UI what AI recommends
});
```

### **3. Update TypeScript Interface** (`src/hooks/GrantsContext.tsx`)

```typescript
export interface Grant {
  // ... existing fields ...
  
  // AI Assessment
  aiScore?: number | null;
  aiVerdict?: string | null;
  aiRecommendation?: "Apply" | "Maybe" | "No" | null;  // NEW
  aiAnalysis?: Record<string, unknown> | null;
  
  // User Decision
  decision?: "Apply" | "Maybe" | "No" | "Rejected" | null;
  decisionReason?: string | null;  // NEW
  decisionAt?: string | null;      // NEW
}
```

### **4. Update UI Components**

**Show AI Recommendation vs User Decision:**

```tsx
// src/app/grants/components/GrantRow.tsx (or similar)

{grant.aiRecommendation && (
  <div className="ai-recommendation">
    <span className="label">AI Recommends:</span>
    <span className={`badge ${grant.aiRecommendation.toLowerCase()}`}>
      {grant.aiRecommendation}
    </span>
  </div>
)}

{grant.decision && grant.decision !== grant.aiRecommendation && (
  <div className="override-warning">
    ⚠️ You overrode AI recommendation
    {grant.decisionReason && <span>: {grant.decisionReason}</span>}
  </div>
)}
```

**Add Decision Reason Input:**

```tsx
<select 
  value={grant.decision ?? ""} 
  onChange={(e) => handleDecisionChange(e.target.value)}
>
  <option value="">No decision</option>
  <option value="Apply">Apply</option>
  <option value="Maybe">Maybe</option>
  <option value="No">No</option>
  <option value="Rejected">Rejected</option>
</select>

{grant.decision !== grant.aiRecommendation && (
  <input
    type="text"
    placeholder="Why override AI recommendation?"
    value={grant.decisionReason ?? ""}
    onChange={(e) => handleReasonChange(e.target.value)}
  />
)}
```

---

## 📊 **Before vs After**

### **Before (Conflated):**

```typescript
// Grant A
{
  aiScore: 95,
  aiVerdict: "Strong Fit",
  decision: "Apply",  // Auto-set by AI
}

// Grant B (user overrode)
{
  aiScore: 95,
  aiVerdict: "Strong Fit",
  decision: "Maybe",  // User changed, but why? Unknown.
}

// Problem: Can't tell if decision is AI or user choice
```

### **After (Separated):**

```typescript
// Grant A (user agrees with AI)
{
  aiScore: 95,
  aiVerdict: "Strong Fit",
  aiRecommendation: "Apply",  // AI says
  decision: "Apply",           // User agrees
  decisionReason: null,
  decisionAt: "2026-04-06T10:00:00Z",
}

// Grant B (user overrides AI)
{
  aiScore: 95,
  aiVerdict: "Strong Fit",
  aiRecommendation: "Apply",  // AI says
  decision: "Maybe",           // User overrides
  decisionReason: "Timeline too tight - need 3 months prep",
  decisionAt: "2026-04-06T10:05:00Z",
}

// Clear: AI recommendation vs user decision, with reason
```

---

## 🎯 **Benefits of Separation**

1. **Transparency:** Users see what AI recommends vs what they decided
2. **Consistency:** Same score always gives same AI recommendation
3. **Auditability:** Can track when/why users override AI
4. **Re-analysis:** AI can update recommendation without overwriting user decision
5. **Filtering:** Can find grants where user overrode AI (potential issues)
6. **Learning:** Can analyze override patterns to improve AI

---

## 📈 **Metrics to Track**

After implementing separation:

```sql
-- Override rate
SELECT 
  COUNT(*) FILTER (WHERE "decision" IS DISTINCT FROM "aiRecommendation") * 100.0 / COUNT(*) as override_rate
FROM "Grant"
WHERE "aiRecommendation" IS NOT NULL;

-- Most common overrides
SELECT 
  "aiRecommendation",
  "decision",
  COUNT(*) as count
FROM "Grant"
WHERE "decision" IS DISTINCT FROM "aiRecommendation"
GROUP BY "aiRecommendation", "decision"
ORDER BY count DESC;

-- Override reasons
SELECT 
  "decisionReason",
  COUNT(*) as count
FROM "Grant"
WHERE "decision" IS DISTINCT FROM "aiRecommendation"
  AND "decisionReason" IS NOT NULL
GROUP BY "decisionReason"
ORDER BY count DESC;
```

---

## 🐛 **Related Issues**

This conflation issue is related to:

1. **Pipeline Status Issue** - Decision auto-sets crmStatus, compounding confusion
2. **No Audit Trail** - Can't see decision history
3. **No Explanation** - Users don't know why AI recommended X
4. **Opaque Logic** - Score→Verdict→Decision mapping is hidden

All of these should be addressed together for a coherent grant workflow.

---

## ✅ **Acceptance Criteria**

Fix is complete when:

1. ✅ `aiRecommendation` field exists and is populated
2. ✅ AI analysis updates `aiRecommendation` but never touches `decision`
3. ✅ User decision changes update `decision`, `decisionReason`, `decisionAt`
4. ✅ UI clearly shows AI recommendation vs user decision
5. ✅ UI highlights when user overrides AI
6. ✅ UI allows user to explain override with `decisionReason`
7. ✅ Re-analysis updates AI recommendation but preserves user decision
8. ✅ Two grants with 95% score always get same AI recommendation
9. ✅ Can filter grants by override status
10. ✅ Can analyze override patterns

---

## 🎓 **Lessons Learned**

1. **Don't conflate AI suggestions with user decisions** - They're separate concepts
2. **Always provide transparency** - Show AI reasoning and user overrides
3. **Preserve user intent** - Don't overwrite manual changes
4. **Track decision history** - Audit trail is essential
5. **Explain discrepancies** - If score and decision don't match, explain why

---

**Status:** Documented, ready for implementation  
**Priority:** High (affects user trust and decision-making)  
**Estimated Effort:** 4-6 hours (migration + API + UI + testing)
