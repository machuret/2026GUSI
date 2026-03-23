-- Seed: GUSI Global Health — Partnership & Proposal Handover
-- Source: handover document parsed March 2026.
-- One row per funder/partner engagement.

INSERT INTO "GrantHistory" ("companyId","funderName","grantName","partnerOrg","region","outcome","amount","rejectionReason","notes","submittedAt") VALUES

-- ── AFRICA ──────────────────────────────────────────────────────────────────
('demo','Grand Challenges Canada','GCC Grant','SOFPOG (Ghana)','Africa','Won','$1.5M',NULL,'Primary field partner. Coordinated training deployment, payments, contracts, reporting. GCC extension secured Oct 2025. $1.5M follow-on possible for highest performers.','2023-01-01'),

('demo','Global Fund','Global Fund — Malaria/TB/HIV','Ghana College of Physicians and Surgeons','Africa','Rejected','$3M','Incomplete financial document','Joint proposal for Global Fund (Malaria, TB, HIV). Proposal submitted and rejected due to incomplete financial documentation.','2024-01-01'),

('demo','UNFPA','UNFPA Equalizer Challenge','Imagin(ED) (Ghana)','Africa','Rejected',NULL,NULL,'First licensing agreement with a local implementing partner. Joint UNFPA Equalizer Challenge proposal submitted. Rejected — no feedback received.','2024-01-01'),

('demo','Gates Foundation','Gates Pre-eclampsia Grant','Kenyatta University / Dr. Kahiga (Kenya)','Africa','Submitted',NULL,NULL,'Negotiated and signed MOU. Developed joint proposals for Gates Pre-eclampsia, HMB, EU Transformative Innovations. Drafted POCUS Integration Roadmap. Coordinated DeepEcho AI integration. Active — passed to Sheila.','2024-01-01'),

('demo','EU Transformative Innovations','EU Transformative Innovations','Kenyatta University / Dr. Kahiga (Kenya)','Africa','Submitted',NULL,NULL,'Joint proposal submitted as part of MOU partnership.','2024-01-01'),

('demo','BRIGHT Research Study','BRIGHT Research Study — POCUS','Nairobi City Government (Kenya)','Africa','Submitted',NULL,NULL,'Consortium partner for BRIGHT Research Study on POCUS in informal settler communities. Submitted with Kenyatta and GUSI.','2024-01-01'),

('demo','COMO Foundation','COMO Foundation Grant','MScan Uganda','Africa','Submitted','$2M',NULL,'Signed partnership agreement. Negotiated 10% device discount. MScan bundling GUSI training with device sales. Joint $2M COMO Foundation proposal submitted.','2024-01-01'),

('demo','AmplifyChange','AmplifyChange Grant','MARCH Health Initiatives (Nigeria)','Africa','Submitted',NULL,NULL,'Developed joint proposal for AmplifyChange.','2024-01-01'),

('demo','Embassy of Japan','Embassy of Japan Grant','MARCH Health Initiatives (Nigeria)','Africa','Rejected',NULL,'Incomplete documents','Joint EOJ grant proposal. Rejected due to incomplete documents from partner.','2024-01-01'),

('demo','Grand Challenges Nigeria','Grand Challenges Nigeria Grant','EHCON / Dr. Abiola Fasina-Ayoola (Nigeria)','Africa','Shortlisted','$35K',NULL,'Joint proposal. Shortlisted but not selected. Oyo State MOH relationship established.','2024-01-01'),

('demo','Grand Challenges Canada','GC Africa Proposal','Kamuzu University of Health Sciences / Dr. Banda-Katha (Malawi)','Africa','NotSubmitted',NULL,'Partner did not complete portal requirements on time','GC Africa proposal developed Nov 2023. Partner org did not complete portal requirements to meet deadline.','2023-11-01'),

('demo','Laerdal Foundation','Laerdal Foundation Grant','St. Anne''s Hospital / Theresa (Tanzania)','Africa','Pending','$100K',NULL,'Joint Laerdal Foundation proposal worth $100K. No update — partner wanted free Fellowships.','2024-01-01'),

('demo','AJA Foundation','AJA Foundation Grant','Philip Kadzuwa / Kanenje Medical Clinics (Malawi)','Africa','Pending','$100K',NULL,'Advised on AJA Foundation grant for mobile ultrasound scanning for PLHIV in Chitipa. Joint proposal submitted. No outcome update.','2024-01-01'),

('demo','DFAT','DFAT Joint Proposal','DRC / Nancy','Africa','Submitted',NULL,NULL,'DFAT joint proposal submitted. DRC partner submitted a proposal with another training partner. GUSI only as advisor. Partner wants free service instead.','2024-01-01'),

('demo','Lemonaid Foundation','Lemonaid & Charitea Foundation','Elimisha Health / Othniel Nimbabazi (Rwanda)','Africa','Pending',NULL,NULL,'Joint proposal developed with MScan. Submitted for Lemonaid and Charitea Foundation. No update.','2024-01-01'),

('demo','Charitea Foundation','Lemonaid & Charitea Foundation','Elimisha Health / Othniel Nimbabazi (Rwanda)','Africa','Pending',NULL,NULL,'Joint proposal developed with MScan. Submitted for Lemonaid and Charitea Foundation. No update.','2024-01-01'),

-- ── SOUTHEAST ASIA ──────────────────────────────────────────────────────────
('demo','Pfizer','Pfizer POCUS for LRTI','Chulalongkorn University (Thailand)','Southeast Asia','Rejected',NULL,'Likely bad product fit — POCUS for upper respiratory','Developed joint Pfizer proposal for cluster RCT on POCUS for LRTI detection in infants. Rejected.','2024-01-01'),

-- ── PHILIPPINES ─────────────────────────────────────────────────────────────
('demo','Macquarie Group Foundation','Macquarie Grant — AI for Women''s Health','FTW Foundation','Philippines','Pending',NULL,NULL,'Agreed to submit pitch for Macquarie Grant on AI for Women''s Health. Submitted. No update.','2024-01-01'),

('demo','PCSO','PCSO Grant — Maternal Health','Cosmos Medical / GE Philippines','Philippines','Pending',NULL,NULL,'Subcontractor quote submitted for maternal health project. PCSO grant proposal developed. No update on outcome.','2025-01-01'),

('demo','US ASEAN Smart Cities Program','US ASEAN Smart Cities Program','GUSI Philippines','Philippines','Submitted','$400K',NULL,'Supported US ASEAN Smart Cities Program proposal. No outcome recorded.','2024-01-01'),

('demo','AirAsia','AirAsia Mobile Ultrasound Officers','GUSI Philippines','Philippines','Rejected',NULL,NULL,'AirAsia Mobile Ultrasound Officers pilot in Leyte submitted. Rejected.','2024-01-01'),

-- ── EUROPE ──────────────────────────────────────────────────────────────────
('demo','Proparco','Proparco Co-financing','Pascual / Sonoscanner (EU)','Europe','Exploratory',NULL,NULL,'Identified Proparco and develoPPP co-financing facilities for device deals. Exploratory — Danish partner still needed.','2025-01-01'),

('demo','Novo Nordisk Foundation','Novo Nordisk Grant','Pascual / Sonoscanner (EU)','Europe','Exploratory',NULL,NULL,'Sent Novo Nordisk leads contingent on Danish institution partner. Exploratory — Danish partner still needed.','2025-01-01'),

-- ── NORTH AMERICA ───────────────────────────────────────────────────────────
('demo','Gates Foundation','Gates Pre-eclampsia Consortium','DeepEcho (AI)','North America','Rejected',NULL,'Competitive field — entire maternal health sector applied. DeepEcho won with AI layer. Product positioning gap.','Integrated into Gates Pre-eclampsia consortium bid. Gates bid submitted. DeepEcho won.','2024-01-01'),

('demo','Grand Challenges Nigeria','Grand Challenges Nigeria — DeepEcho','DeepEcho (AI)','North America','Rejected',NULL,NULL,'Consortium bid for Grand Challenges Nigeria — lost.','2024-01-01'),

('demo','USAID EDGE Fund','USAID EDGE Fund — POCUS Access Fund','GE Healthcare','North America','Pending',NULL,'No response. USAID ceased operations.','EOI submitted December 2024. POCUS Access Fund concept. Follow-up sent to Karis McGill USAID Ghana. No reply.','2024-12-01'),

-- ── GRANTS WON ──────────────────────────────────────────────────────────────
('demo','Grand Challenges Canada','GCC Grant — Scale Up','SOFPOG / AMPATH (Ghana)','Africa','Won',NULL,NULL,'Proposal developed 2023 with AMPATH/Daria. GUSI as subcontractor, SOFPOG as prime. Full proposal, budget, implementation plan. GCC extension secured Oct 2025 — new money. $1.5M follow-on possible.','2023-01-01'),

('demo','CHS Kenya','CHS Kenya Bid',NULL,'Africa','Won',NULL,NULL,'Submitted proposal. Won the bid. Details with Kenya team.','2024-01-01'),

('demo','Josetta Fund','Josetta Fund — $30K',NULL,'North America','Won','$30K',NULL,'Initial outreach Nov-Dec 2025. $30K ask. CONVERTED.','2025-11-01'),

-- ── DID NOT PROCEED / UNSUCCESSFUL ──────────────────────────────────────────
('demo','NSF','NSF AI Grant',NULL,'North America','NotSubmitted','$250K','Requires American team members — structural barrier, not eligible','Shortlisted. GUSI as prime. Structural barrier prevented full submission.','2024-01-01'),

('demo','MIT Solve','MIT Solve — OB POCUS','AMPATH','North America','Rejected',NULL,NULL,'Submitted with AMPATH as prime. Rejected.','2024-01-01'),

('demo','GSMA','GSMA Grant',NULL,'Global','Rejected',NULL,NULL,'Application submitted. Rejected.','2024-01-01'),

('demo','Sorensen','Sorensen Grant',NULL,'Global','Rejected',NULL,NULL,'Proposal submitted. Rejected.','2024-01-01'),

('demo','Visa Foundation','Visa Foundation Grant',NULL,'Global','Rejected',NULL,NULL,'Application submitted. Rejected.','2024-01-01'),

('demo','Laerdal Foundation','Laerdal Foundation Grant — Direct',NULL,'Global','NotSubmitted',NULL,'Portal locked before submission — no suitable partner secured','Proposal drafted April 2024. Portal locked before submission. Foundation offered to re-open. Deadline twice yearly (April/October).','2024-04-01'),

('demo','Merck Corporate Foundation','Merck Corporate Foundation Grant','SOFPOG (Ghana)','Africa','NotSubmitted',NULL,'Portal required internal sponsor not mentioned in RFP','Proposal completed with SOFPOG. Portal required internal sponsor. Not submitted. Strategy adjusted — outreach first before submitting to corporate foundations.','2024-01-01'),

('demo','Grand Challenges Nigeria','Grand Challenges Nigeria — EHCON','EHCON / Dr. Abiola Fasina-Ayoola (Nigeria)','Africa','Shortlisted','$35K',NULL,'Joint proposal. Shortlisted. Not selected.','2024-01-01'),

('demo','JICA','MARCH Health JICA Grant','MARCH Health Initiatives (Nigeria)','Africa','Rejected',NULL,'Partner did not complete required documents','Joint proposal submitted. Partner compliance failure.','2024-01-01'),

('demo','MacArthur Foundation','MacArthur Foundation Grant',NULL,'North America','NotSubmitted',NULL,'Requires $5M annual org budget minimum — org too small','Screened out. Structural barrier.','2024-01-01'),

('demo','Elma Philanthropies','Elma Philanthropies Grant',NULL,'Global','NotSubmitted',NULL,'Only funds by government request','Outreach completed. Structural barrier.','2024-01-01'),

('demo','Lever for Change','Lever for Change Grant',NULL,'Global','NotSubmitted',NULL,'Requires proof of 1 million people reached — evidence base not yet at threshold','Screened. Structural barrier.','2024-01-01'),

('demo','Global Health Funders','Global Health Funders.org Proposal',NULL,'Global','Pending','$200K',NULL,'Outreach submitted. No response.','2024-01-01'),

-- ── PIPELINE — PENDING OUTCOME ───────────────────────────────────────────────
('demo','Small Foundation Rwanda','Rwanda Small Foundation','Othniel / Elimisha Health (Rwanda)','Africa','Pending',NULL,NULL,'Joint proposal submitted. No update.','2025-01-01'),

-- ── FOUNDATION OUTREACH PIPELINE Nov-Dec 2025 ────────────────────────────────
('demo','Imago Dei Fund','Imago Dei Fund — $30K',NULL,'North America','Pending','$30K',NULL,'Initial outreach November 2025. No response recorded.','2025-11-01'),
('demo','Mai Family Foundation','Mai Family Foundation — $30K',NULL,'North America','Pending','$30K',NULL,'Initial outreach November 2025. No response recorded.','2025-11-01'),
('demo','Lester Fund Inc','Lester Fund — $30K',NULL,'North America','Pending','$30K',NULL,'Initial outreach November 2025. No response recorded.','2025-11-01'),
('demo','Rugged Elegance Foundation','Rugged Elegance Foundation — $30K',NULL,'North America','Pending','$30K',NULL,'Initial outreach November 2025. No response recorded.','2025-11-01'),
('demo','Natembea Foundation','Natembea Foundation — $30K',NULL,'North America','Pending','$30K',NULL,'Initial outreach November 2025. No response recorded.','2025-11-01'),
('demo','Betterworld Trust','Betterworld Trust — $30K',NULL,'North America','Pending','$30K',NULL,'Initial outreach November 2025. No response recorded.','2025-11-01'),
('demo','Walker Family Foundation','Walker Family Foundation — $30K',NULL,'North America','Pending','$30K',NULL,'Initial outreach November 2025. No response recorded.','2025-11-01'),
('demo','Greenbaum Foundation','Greenbaum Foundation — $30K',NULL,'North America','Pending','$30K',NULL,'Initial outreach November 2025. No response recorded.','2025-11-01'),
('demo','Goggio Family Foundation','Goggio Family Foundation — $30K',NULL,'North America','Pending','$30K',NULL,'Initial outreach November 2025. No response recorded.','2025-11-01'),
('demo','Roots & Wings Foundation','Roots & Wings Foundation — $30K',NULL,'North America','Pending','$30K',NULL,'Initial outreach November 2025. No response recorded.','2025-11-01'),
('demo','Godley Family Foundation','Godley Family Foundation — $30K',NULL,'North America','Pending','$30K',NULL,'Initial outreach November 2025. No response recorded.','2025-11-01'),
('demo','Dr Scholl Foundation','Dr Scholl Foundation — $30K',NULL,'North America','Pending','$30K',NULL,'Initial outreach December 2025. No response recorded.','2025-12-01'),
('demo','Stewardship Foundation','Stewardship Foundation — $30K',NULL,'North America','Pending','$30K',NULL,'Initial outreach December 2025. No response recorded.','2025-12-01'),

-- ── LARGER FUNDERS PIPELINE ──────────────────────────────────────────────────
('demo','CRI Health','CRI Health Cultivation',NULL,'North America','Active','$100K',NULL,'Outreach and cultivation. In cultivation. $100K ask.','2025-01-01'),
('demo','Verge HealthTech Fund','Verge HealthTech Fund',NULL,'North America','Exploratory',NULL,NULL,'Identified as potential funder. Mena sent email. No response.','2025-01-01'),
('demo','Grand Challenges Canada','GCC Scale-up — $1.5M Follow-on','SOFPOG (Ghana)','Africa','Active','$1.5M',NULL,'Positioning for $1.5M follow-on grant based on Cohort 1 and 2 performance data. High priority.','2026-01-01'),
('demo','Beginnings Fund','Beginnings Fund — Ghana Follow-on',NULL,'Africa','Exploratory',NULL,NULL,'Identified with Dr. George for Ghana follow-on strategy. Prefer to work through government. GHS already informed.','2025-01-01'),

-- ── REALIZE IMPACT ───────────────────────────────────────────────────────────
('demo','Realize Impact','Fiscal Sponsorship — GUSI',NULL,'North America','Won',NULL,NULL,'Secured fiscal sponsorship for GUSI Global Health. Negotiated contract. Resolved taxation complications. Designed Northern Ghana program. Set up ACH/wire and online donate button. US tax-deductible donations enabled.','2025-01-01');
