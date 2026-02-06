INSERT INTO award_rules (id, title, event_id, enc_amount, max_count) VALUES
('award_1', 'Daily Login Bonus', 'daily_login', 10.00, NULL),
('award_2', 'First Purchase Reward', 'first_purchase', 50.00, 1),
('award_3', 'Referral Bonus', 'referral_complete', 25.00, 10),
('award_4', 'Profile Completion', 'profile_complete', 15.00, 1),
('award_5', 'Weekly Champion', 'weekly_champion', 100.00, NULL),
('award_6', 'Transaction Milestone', 'milestone_10_tx', 30.00, 1),
('award_7', 'Early Adopter', 'early_adopter', 200.00, 1),
('award_8', 'Community Star', 'community_star', 75.00, 5)
ON CONFLICT (id) DO NOTHING;