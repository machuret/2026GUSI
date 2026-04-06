-- ═══════════════════════════════════════════════════════════════════════════
-- BUDGET TEMPLATE SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Purpose: Provide real cost structure for grant budget generation
-- Problem: AI currently invents budget figures instead of using actual costs
-- Solution: Template with line items, unit costs, and default allocations
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Budget Line Items (reusable cost components) ───────────────────────────
CREATE TABLE IF NOT EXISTS "BudgetLineItem" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'Personnel',
    'Equipment & Materials',
    'Travel & Accommodation',
    'Professional Services',
    'Technology & Software',
    'Marketing & Communications',
    'Facilities & Overhead',
    'Training & Development',
    'Evaluation & Research',
    'Other Direct Costs'
  )),
  name TEXT NOT NULL,
  description TEXT,
  "unitType" TEXT NOT NULL CHECK ("unitType" IN (
    'hourly',
    'daily',
    'weekly',
    'monthly',
    'annual',
    'per_item',
    'per_participant',
    'percentage',
    'fixed'
  )),
  "unitCost" DECIMAL(10, 2) NOT NULL,
  "defaultQuantity" DECIMAL(10, 2),
  notes TEXT,
  active BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "BudgetLineItem_companyId_idx" 
  ON "BudgetLineItem" ("companyId");

CREATE INDEX IF NOT EXISTS "BudgetLineItem_category_idx" 
  ON "BudgetLineItem" (category);

-- ── Budget Templates (pre-configured budgets by grant type) ────────────────
CREATE TABLE IF NOT EXISTS "BudgetTemplate" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  "grantType" TEXT CHECK ("grantType" IN (
    'Technology & Innovation',
    'Research & Development',
    'Training & Capacity Building',
    'Community Development',
    'Health & Wellbeing',
    'Education & Youth',
    'Environment & Sustainability',
    'Economic Development',
    'Arts & Culture',
    'Housing & Infrastructure',
    'Emergency Relief',
    'Diversity & Inclusion',
    'General'
  )),
  "typicalAmount" TEXT,
  "overheadRate" DECIMAL(5, 2),
  allocations JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "BudgetTemplate_companyId_idx" 
  ON "BudgetTemplate" ("companyId");

CREATE INDEX IF NOT EXISTS "BudgetTemplate_grantType_idx" 
  ON "BudgetTemplate" ("grantType");

-- ── Insert GUSI's Actual Cost Structure ────────────────────────────────────

-- Personnel costs (based on typical Australian tech/education startup rates)
INSERT INTO "BudgetLineItem" ("companyId", category, name, description, "unitType", "unitCost", "defaultQuantity", notes) VALUES
  ('demo-company-id', 'Personnel', 'Senior Developer', 'Full-stack developer with 5+ years experience', 'hourly', 85.00, 160, 'Based on $140k annual salary + super'),
  ('demo-company-id', 'Personnel', 'Mid-Level Developer', 'Developer with 2-4 years experience', 'hourly', 65.00, 160, 'Based on $110k annual salary + super'),
  ('demo-company-id', 'Personnel', 'Junior Developer', 'Graduate or junior developer', 'hourly', 45.00, 160, 'Based on $75k annual salary + super'),
  ('demo-company-id', 'Personnel', 'Product Manager', 'Product strategy and roadmap', 'hourly', 75.00, 80, 'Based on $125k annual salary + super'),
  ('demo-company-id', 'Personnel', 'UX/UI Designer', 'User experience and interface design', 'hourly', 70.00, 120, 'Based on $115k annual salary + super'),
  ('demo-company-id', 'Personnel', 'Content Creator', 'Educational content development', 'hourly', 60.00, 100, 'Based on $100k annual salary + super'),
  ('demo-company-id', 'Personnel', 'Project Coordinator', 'Project management and administration', 'hourly', 55.00, 120, 'Based on $90k annual salary + super'),
  ('demo-company-id', 'Personnel', 'Community Manager', 'User engagement and support', 'hourly', 50.00, 100, 'Based on $85k annual salary + super'),
  ('demo-company-id', 'Personnel', 'Data Analyst', 'Analytics and reporting', 'hourly', 65.00, 80, 'Based on $110k annual salary + super'),
  ('demo-company-id', 'Personnel', 'Executive Director', 'Strategic leadership', 'hourly', 95.00, 40, 'Based on $160k annual salary + super');

-- Equipment & Materials
INSERT INTO "BudgetLineItem" ("companyId", category, name, description, "unitType", "unitCost", "defaultQuantity", notes) VALUES
  ('demo-company-id', 'Equipment & Materials', 'MacBook Pro (Developer)', 'M3 Pro, 18GB RAM, 512GB SSD', 'per_item', 3499.00, 2, 'Standard developer workstation'),
  ('demo-company-id', 'Equipment & Materials', 'MacBook Air (General)', 'M2, 16GB RAM, 256GB SSD', 'per_item', 2199.00, 3, 'For non-developer staff'),
  ('demo-company-id', 'Equipment & Materials', 'External Monitor', '27" 4K display', 'per_item', 599.00, 5, 'Dual monitor setup'),
  ('demo-company-id', 'Equipment & Materials', 'Office Furniture Set', 'Desk, chair, accessories', 'per_item', 1200.00, 5, 'Ergonomic setup per person'),
  ('demo-company-id', 'Equipment & Materials', 'Microphone & Camera', 'For video content creation', 'per_item', 450.00, 2, 'Content production equipment'),
  ('demo-company-id', 'Equipment & Materials', 'iPad Pro', 'For user testing and demos', 'per_item', 1499.00, 3, 'User research and testing'),
  ('demo-company-id', 'Equipment & Materials', 'Educational Materials', 'Printed guides, workbooks', 'per_participant', 25.00, 100, 'Per learner/participant');

-- Technology & Software
INSERT INTO "BudgetLineItem" ("companyId", category, name, description, "unitType", "unitCost", "defaultQuantity", notes) VALUES
  ('demo-company-id', 'Technology & Software', 'Cloud Hosting (AWS/Vercel)', 'Production infrastructure', 'monthly', 850.00, 12, 'Includes CDN, database, storage'),
  ('demo-company-id', 'Technology & Software', 'Development Tools', 'GitHub, Figma, Linear, etc.', 'monthly', 350.00, 12, 'Team collaboration tools'),
  ('demo-company-id', 'Technology & Software', 'AI/ML Services', 'OpenAI API, analytics', 'monthly', 600.00, 12, 'AI features and processing'),
  ('demo-company-id', 'Technology & Software', 'Email & Communications', 'Google Workspace, Slack', 'monthly', 180.00, 12, '10 users'),
  ('demo-company-id', 'Technology & Software', 'Security & Monitoring', 'Datadog, Sentry, Auth0', 'monthly', 280.00, 12, 'Security and observability'),
  ('demo-company-id', 'Technology & Software', 'CRM & Marketing', 'HubSpot, Mailchimp', 'monthly', 220.00, 12, 'User engagement tools'),
  ('demo-company-id', 'Technology & Software', 'Video Conferencing', 'Zoom Pro', 'monthly', 45.00, 12, '3 licenses'),
  ('demo-company-id', 'Technology & Software', 'SSL Certificates', 'Wildcard SSL', 'annual', 299.00, 1, 'Security certificates');

-- Professional Services
INSERT INTO "BudgetLineItem" ("companyId", category, name, description, "unitType", "unitCost", "defaultQuantity", notes) VALUES
  ('demo-company-id', 'Professional Services', 'Legal Services', 'Contracts, compliance, IP', 'hourly', 350.00, 20, 'External legal counsel'),
  ('demo-company-id', 'Professional Services', 'Accounting & Bookkeeping', 'Financial management', 'monthly', 800.00, 12, 'External accountant'),
  ('demo-company-id', 'Professional Services', 'External Evaluator', 'Independent program evaluation', 'per_item', 8500.00, 1, 'Third-party evaluation'),
  ('demo-company-id', 'Professional Services', 'Graphic Designer', 'Brand and marketing materials', 'hourly', 95.00, 40, 'External contractor'),
  ('demo-company-id', 'Professional Services', 'Copywriter', 'Marketing and content', 'hourly', 85.00, 30, 'External contractor'),
  ('demo-company-id', 'Professional Services', 'IT Support', 'Technical support and maintenance', 'monthly', 450.00, 12, 'Managed IT services');

-- Travel & Accommodation
INSERT INTO "BudgetLineItem" ("companyId", category, name, description, "unitType", "unitCost", "defaultQuantity", notes) VALUES
  ('demo-company-id', 'Travel & Accommodation', 'Domestic Flight', 'Return economy flight within Australia', 'per_item', 450.00, 8, 'Average Sydney-Melbourne-Brisbane'),
  ('demo-company-id', 'Travel & Accommodation', 'International Flight', 'Return economy international', 'per_item', 1800.00, 2, 'Conference attendance'),
  ('demo-company-id', 'Travel & Accommodation', 'Hotel (per night)', 'Mid-range accommodation', 'per_item', 180.00, 20, 'Business travel'),
  ('demo-company-id', 'Travel & Accommodation', 'Meals & Incidentals', 'Per diem allowance', 'daily', 95.00, 30, 'ATO reasonable amounts'),
  ('demo-company-id', 'Travel & Accommodation', 'Ground Transport', 'Taxis, rideshare, parking', 'per_item', 60.00, 15, 'Local travel'),
  ('demo-company-id', 'Travel & Accommodation', 'Car Rental', 'Regional travel', 'daily', 85.00, 10, 'For regional workshops');

-- Training & Development
INSERT INTO "BudgetLineItem" ("companyId", category, name, description, "unitType", "unitCost", "defaultQuantity", notes) VALUES
  ('demo-company-id', 'Training & Development', 'Conference Registration', 'Industry conference attendance', 'per_item', 850.00, 4, 'Professional development'),
  ('demo-company-id', 'Training & Development', 'Online Course', 'Udemy, Coursera, etc.', 'per_item', 120.00, 10, 'Team skill development'),
  ('demo-company-id', 'Training & Development', 'Workshop Facilitation', 'External facilitator', 'daily', 1200.00, 5, 'Team workshops'),
  ('demo-company-id', 'Training & Development', 'Certification Exam', 'Professional certifications', 'per_item', 450.00, 3, 'Industry certifications');

-- Marketing & Communications
INSERT INTO "BudgetLineItem" ("companyId", category, name, description, "unitType", "unitCost", "defaultQuantity", notes) VALUES
  ('demo-company-id', 'Marketing & Communications', 'Digital Advertising', 'Google Ads, social media', 'monthly', 1200.00, 12, 'User acquisition'),
  ('demo-company-id', 'Marketing & Communications', 'Video Production', 'Professional video content', 'per_item', 3500.00, 4, 'Explainer videos, testimonials'),
  ('demo-company-id', 'Marketing & Communications', 'Photography', 'Professional photos', 'per_item', 800.00, 2, 'Marketing materials'),
  ('demo-company-id', 'Marketing & Communications', 'Print Materials', 'Brochures, posters, banners', 'per_item', 450.00, 5, 'Event materials'),
  ('demo-company-id', 'Marketing & Communications', 'Website Maintenance', 'Updates and improvements', 'monthly', 350.00, 12, 'Ongoing website work');

-- Facilities & Overhead
INSERT INTO "BudgetLineItem" ("companyId", category, name, description, "unitType", "unitCost", "defaultQuantity", notes) VALUES
  ('demo-company-id', 'Facilities & Overhead', 'Office Rent', 'Co-working space', 'monthly', 2800.00, 12, '10 desks @ $280/desk'),
  ('demo-company-id', 'Facilities & Overhead', 'Utilities', 'Internet, phone, electricity', 'monthly', 350.00, 12, 'Office utilities'),
  ('demo-company-id', 'Facilities & Overhead', 'Insurance', 'Professional indemnity, public liability', 'annual', 3200.00, 1, 'Business insurance'),
  ('demo-company-id', 'Facilities & Overhead', 'Office Supplies', 'Stationery, consumables', 'monthly', 180.00, 12, 'General supplies'),
  ('demo-company-id', 'Facilities & Overhead', 'Cleaning Services', 'Office cleaning', 'monthly', 220.00, 12, 'Weekly cleaning');

-- Evaluation & Research
INSERT INTO "BudgetLineItem" ("companyId", category, name, description, "unitType", "unitCost", "defaultQuantity", notes) VALUES
  ('demo-company-id', 'Evaluation & Research', 'Survey Platform', 'Qualtrics, SurveyMonkey', 'annual', 1200.00, 1, 'User research tools'),
  ('demo-company-id', 'Evaluation & Research', 'User Testing', 'Participant incentives', 'per_participant', 50.00, 40, 'User research sessions'),
  ('demo-company-id', 'Evaluation & Research', 'Data Collection Tools', 'Analytics and tracking', 'monthly', 180.00, 12, 'Research infrastructure'),
  ('demo-company-id', 'Evaluation & Research', 'Research Assistant', 'Part-time research support', 'hourly', 45.00, 200, 'Data collection and analysis');

-- ── Create Default Budget Templates ────────────────────────────────────────

-- Technology & Innovation Template
INSERT INTO "BudgetTemplate" ("companyId", name, description, "grantType", "typicalAmount", "overheadRate", allocations) VALUES
  ('demo-company-id', 
   'Technology Development Grant', 
   'For building new digital products or platforms',
   'Technology & Innovation',
   '$50,000 - $200,000',
   15.00,
   '[
     {"category": "Personnel", "percentage": 55, "notes": "Development team (senior dev, mid dev, product manager)"},
     {"category": "Technology & Software", "percentage": 15, "notes": "Cloud hosting, dev tools, AI services"},
     {"category": "Equipment & Materials", "percentage": 8, "notes": "Developer workstations and monitors"},
     {"category": "Professional Services", "percentage": 7, "notes": "External evaluation, legal"},
     {"category": "Evaluation & Research", "percentage": 5, "notes": "User testing and research"},
     {"category": "Marketing & Communications", "percentage": 5, "notes": "Product launch and user acquisition"},
     {"category": "Facilities & Overhead", "percentage": 5, "notes": "Office space and utilities"}
   ]'::jsonb);

-- Training & Capacity Building Template
INSERT INTO "BudgetTemplate" ("companyId", name, description, "grantType", "typicalAmount", "overheadRate", allocations) VALUES
  ('demo-company-id',
   'Training Program Grant',
   'For delivering educational programs and workshops',
   'Training & Capacity Building',
   '$30,000 - $100,000',
   12.00,
   '[
     {"category": "Personnel", "percentage": 50, "notes": "Content creators, facilitators, project coordinator"},
     {"category": "Equipment & Materials", "percentage": 15, "notes": "Educational materials, participant resources"},
     {"category": "Technology & Software", "percentage": 10, "notes": "Learning management system, video conferencing"},
     {"category": "Training & Development", "percentage": 8, "notes": "Facilitator training and certification"},
     {"category": "Travel & Accommodation", "percentage": 7, "notes": "Regional delivery, facilitator travel"},
     {"category": "Evaluation & Research", "percentage": 5, "notes": "Program evaluation and impact measurement"},
     {"category": "Facilities & Overhead", "percentage": 5, "notes": "Venue hire, utilities"}
   ]'::jsonb);

-- Research & Development Template
INSERT INTO "BudgetTemplate" ("companyId", name, description, "grantType", "typicalAmount", "overheadRate", allocations) VALUES
  ('demo-company-id',
   'Research Project Grant',
   'For research and evidence-building projects',
   'Research & Development',
   '$40,000 - $150,000',
   18.00,
   '[
     {"category": "Personnel", "percentage": 60, "notes": "Research team, data analysts"},
     {"category": "Evaluation & Research", "percentage": 15, "notes": "Research tools, participant incentives, external evaluator"},
     {"category": "Technology & Software", "percentage": 8, "notes": "Data collection and analysis tools"},
     {"category": "Professional Services", "percentage": 7, "notes": "Statistical consultant, peer review"},
     {"category": "Travel & Accommodation", "percentage": 5, "notes": "Conference presentations, fieldwork"},
     {"category": "Facilities & Overhead", "percentage": 5, "notes": "Research facilities"}
   ]'::jsonb);

-- Community Development Template
INSERT INTO "BudgetTemplate" ("companyId", name, description, "grantType", "typicalAmount", "overheadRate", allocations) VALUES
  ('demo-company-id',
   'Community Program Grant',
   'For community engagement and development programs',
   'Community Development',
   '$25,000 - $80,000',
   10.00,
   '[
     {"category": "Personnel", "percentage": 45, "notes": "Community managers, project coordinators"},
     {"category": "Equipment & Materials", "percentage": 20, "notes": "Program materials, participant resources"},
     {"category": "Marketing & Communications", "percentage": 10, "notes": "Community outreach, event promotion"},
     {"category": "Travel & Accommodation", "percentage": 10, "notes": "Regional visits, community events"},
     {"category": "Professional Services", "percentage": 5, "notes": "External facilitators"},
     {"category": "Evaluation & Research", "percentage": 5, "notes": "Impact measurement"},
     {"category": "Facilities & Overhead", "percentage": 5, "notes": "Venue hire, utilities"}
   ]'::jsonb);

-- General/Flexible Template
INSERT INTO "BudgetTemplate" ("companyId", name, description, "grantType", "typicalAmount", "overheadRate", allocations) VALUES
  ('demo-company-id',
   'General Operating Grant',
   'Flexible template for various grant types',
   'General',
   '$20,000 - $100,000',
   15.00,
   '[
     {"category": "Personnel", "percentage": 50, "notes": "Core team salaries"},
     {"category": "Technology & Software", "percentage": 12, "notes": "Essential software and infrastructure"},
     {"category": "Equipment & Materials", "percentage": 10, "notes": "Equipment and supplies"},
     {"category": "Professional Services", "percentage": 8, "notes": "Accounting, legal, consulting"},
     {"category": "Marketing & Communications", "percentage": 7, "notes": "Outreach and communications"},
     {"category": "Evaluation & Research", "percentage": 5, "notes": "Impact measurement"},
     {"category": "Travel & Accommodation", "percentage": 3, "notes": "Essential travel"},
     {"category": "Facilities & Overhead", "percentage": 5, "notes": "Office and utilities"}
   ]'::jsonb);

-- ── Verification Query ─────────────────────────────────────────────────────
SELECT 
  'Line Items' as type,
  category,
  COUNT(*) as count,
  SUM("unitCost") as total_unit_costs
FROM "BudgetLineItem"
WHERE "companyId" = 'demo-company-id'
GROUP BY category
ORDER BY category;

SELECT
  'Templates' as type,
  "grantType",
  name,
  "typicalAmount",
  "overheadRate"
FROM "BudgetTemplate"
WHERE "companyId" = 'demo-company-id'
ORDER BY "grantType";
