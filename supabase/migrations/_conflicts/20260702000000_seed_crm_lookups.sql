-- Seed CRM lead statuses
INSERT INTO crm_lead_statuses (code, name, sort_order, is_active, category, description) VALUES
  ('new', 'New', 1, true, 'pipeline', 'Newly created lead'),
  ('contacted', 'Contacted', 2, true, 'pipeline', 'Initial contact made'),
  ('qualified', 'Qualified', 3, true, 'pipeline', 'Lead meets criteria'),
  ('proposal', 'Proposal', 4, true, 'pipeline', 'Proposal sent'),
  ('negotiation', 'Negotiation', 5, true, 'pipeline', 'In negotiation phase'),
  ('converted', 'Converted', 6, true, 'outcome', 'Successfully converted to member'),
  ('lost', 'Lost', 7, true, 'outcome', 'Lead lost or disqualified');

-- Seed CRM lead sources
INSERT INTO crm_lead_sources (code, name, is_active, description) VALUES
  ('website', 'Website', true, 'Lead from website form'),
  ('referral', 'Referral', true, 'Referred by existing member'),
  ('social_media', 'Social Media', true, 'Lead from social media'),
  ('walk_in', 'Walk-in', true, 'Walk-in inquiry'),
  ('phone', 'Phone', true, 'Phone inquiry'),
  ('event', 'Event', true, 'Lead from event'),
  ('advertisement', 'Advertisement', true, 'Lead from advertisement'),
  ('email', 'Email', true, 'Email inquiry'),
  ('partner', 'Partner', true, 'Partner referral');
