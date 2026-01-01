-- ============================================
-- PROMPTING IT - SUPABASE DATABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- Stores additional user information
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'creator', 'admin', 'owner')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- ============================================
-- SUBSCRIPTIONS TABLE
-- Stores user subscription information
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    prompts_limit INTEGER DEFAULT 25,
    prompts_used INTEGER DEFAULT 0,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Subscriptions policies
CREATE POLICY "Users can view their own subscription"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
    ON public.subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
    ON public.subscriptions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Admins can view all subscriptions"
    ON public.subscriptions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- ============================================
-- PROMPTS TABLE
-- Stores user-created prompts
-- ============================================
CREATE TABLE IF NOT EXISTS public.prompts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    category TEXT,
    tags TEXT[],
    version TEXT DEFAULT '1.0.0',
    is_public BOOLEAN DEFAULT FALSE,
    is_marketplace BOOLEAN DEFAULT FALSE,
    price DECIMAL(10, 2) DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    rating DECIMAL(2, 1) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

-- Prompts policies
CREATE POLICY "Users can view their own prompts"
    ON public.prompts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view public prompts"
    ON public.prompts FOR SELECT
    USING (is_public = TRUE);

CREATE POLICY "Users can insert their own prompts"
    ON public.prompts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prompts"
    ON public.prompts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prompts"
    ON public.prompts FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- PROMPT_VERSIONS TABLE
-- Stores version history for prompts
-- ============================================
CREATE TABLE IF NOT EXISTS public.prompt_versions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    prompt_id UUID REFERENCES public.prompts(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    content TEXT NOT NULL,
    change_notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;

-- Prompt versions policies
CREATE POLICY "Users can view versions of their prompts"
    ON public.prompt_versions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.prompts
            WHERE id = prompt_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert versions of their prompts"
    ON public.prompt_versions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.prompts
            WHERE id = prompt_id AND user_id = auth.uid()
        )
    );

-- ============================================
-- PURCHASES TABLE
-- Stores marketplace purchases
-- ============================================
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    prompt_id UUID REFERENCES public.prompts(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    platform_fee DECIMAL(10, 2) DEFAULT 0,
    seller_revenue DECIMAL(10, 2) DEFAULT 0,
    stripe_payment_id TEXT,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Purchases policies
CREATE POLICY "Buyers can view their purchases"
    ON public.purchases FOR SELECT
    USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can view their sales"
    ON public.purchases FOR SELECT
    USING (auth.uid() = seller_id);

-- ============================================
-- API_KEYS TABLE
-- Stores user API keys
-- ============================================
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    permissions TEXT[] DEFAULT '{"read"}',
    rate_limit INTEGER DEFAULT 100,
    calls_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- API keys policies
CREATE POLICY "Users can view their own API keys"
    ON public.api_keys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own API keys"
    ON public.api_keys FOR ALL
    USING (auth.uid() = user_id);

-- ============================================
-- ACTIVITY_LOG TABLE
-- Stores user activity for analytics
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Activity log policies
CREATE POLICY "Users can view their own activity"
    ON public.activity_log FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity"
    ON public.activity_log FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins can view all activity"
    ON public.activity_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "Admins can insert any activity"
    ON public.activity_log FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, email, first_name, last_name)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name'
    );

    -- Create subscription with trial
    INSERT INTO public.subscriptions (user_id, tier, status, trial_ends_at)
    VALUES (
        NEW.id,
        'free',
        'trialing',
        NOW() + INTERVAL '14 days'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update subscription usage
CREATE OR REPLACE FUNCTION public.increment_prompt_usage(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.subscriptions
    SET prompts_used = prompts_used + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly usage
CREATE OR REPLACE FUNCTION public.reset_monthly_usage()
RETURNS VOID AS $$
BEGIN
    UPDATE public.subscriptions
    SET prompts_used = 0,
        updated_at = NOW()
    WHERE tier = 'free';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON public.subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_prompts_user ON public.prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_public ON public.prompts(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_prompts_marketplace ON public.prompts(is_marketplace) WHERE is_marketplace = TRUE;
CREATE INDEX IF NOT EXISTS idx_prompts_category ON public.prompts(category);
CREATE INDEX IF NOT EXISTS idx_purchases_buyer ON public.purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_seller ON public.purchases(seller_id);
CREATE INDEX IF NOT EXISTS idx_purchases_prompt ON public.purchases(prompt_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_prompt ON public.reviews(prompt_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_user ON public.payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON public.newsletter_subscribers(email);

-- ============================================
-- ADDITIONAL FUNCTIONS
-- ============================================

-- Function to update prompt rating when a review is added
CREATE OR REPLACE FUNCTION public.update_prompt_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.prompts
    SET rating = (
        SELECT ROUND(AVG(rating)::numeric, 1)
        FROM public.reviews
        WHERE prompt_id = COALESCE(NEW.prompt_id, OLD.prompt_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.prompt_id, OLD.prompt_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update rating on review change
DROP TRIGGER IF EXISTS on_review_change ON public.reviews;
CREATE TRIGGER on_review_change
    AFTER INSERT OR UPDATE OR DELETE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_prompt_rating();

-- Function to record a purchase and update sales count
CREATE OR REPLACE FUNCTION public.record_purchase(
    p_buyer_id UUID,
    p_prompt_id UUID,
    p_amount DECIMAL,
    p_stripe_payment_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_seller_id UUID;
    v_platform_fee DECIMAL;
    v_seller_revenue DECIMAL;
    v_purchase_id UUID;
BEGIN
    -- Get seller from prompt
    SELECT user_id INTO v_seller_id FROM public.prompts WHERE id = p_prompt_id;
    
    -- Calculate fees (20% platform fee, 80% to seller)
    v_platform_fee := ROUND(p_amount * 0.20, 2);
    v_seller_revenue := p_amount - v_platform_fee;
    
    -- Create purchase record
    INSERT INTO public.purchases (
        buyer_id, seller_id, prompt_id, amount, 
        platform_fee, seller_revenue, stripe_payment_id, status
    ) VALUES (
        p_buyer_id, v_seller_id, p_prompt_id, p_amount,
        v_platform_fee, v_seller_revenue, p_stripe_payment_id, 'completed'
    ) RETURNING id INTO v_purchase_id;
    
    -- Update prompt sales count
    UPDATE public.prompts
    SET sales_count = sales_count + 1, updated_at = NOW()
    WHERE id = p_prompt_id;
    
    -- Update creator earnings
    INSERT INTO public.creator_earnings (user_id, total_earnings, pending_payout, last_sale_at)
    VALUES (v_seller_id, v_seller_revenue, v_seller_revenue, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        total_earnings = creator_earnings.total_earnings + v_seller_revenue,
        pending_payout = creator_earnings.pending_payout + v_seller_revenue,
        last_sale_at = NOW(),
        updated_at = NOW();
    
    RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process a payout
CREATE OR REPLACE FUNCTION public.process_payout(
    p_payout_id UUID,
    p_stripe_transfer_id TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'completed'
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_amount DECIMAL;
BEGIN
    -- Get payout details
    SELECT user_id, amount INTO v_user_id, v_amount
    FROM public.payouts WHERE id = p_payout_id;
    
    -- Update payout status
    UPDATE public.payouts
    SET status = p_status,
        stripe_transfer_id = p_stripe_transfer_id,
        processed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_payout_id;
    
    -- If completed, update creator earnings
    IF p_status = 'completed' THEN
        UPDATE public.creator_earnings
        SET pending_payout = pending_payout - v_amount,
            total_paid_out = total_paid_out + v_amount,
            updated_at = NOW()
        WHERE user_id = v_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has purchased a prompt
CREATE OR REPLACE FUNCTION public.has_purchased(p_user_id UUID, p_prompt_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.purchases
        WHERE buyer_id = p_user_id 
        AND prompt_id = p_prompt_id 
        AND status = 'completed'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- REVIEWS TABLE
-- Stores prompt reviews and ratings
-- ============================================
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    prompt_id UUID REFERENCES public.prompts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    content TEXT,
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(prompt_id, user_id) -- One review per user per prompt
);

-- Enable Row Level Security
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Reviews policies
CREATE POLICY "Anyone can view reviews"
    ON public.reviews FOR SELECT
    USING (TRUE);

CREATE POLICY "Users can create reviews for prompts they purchased"
    ON public.reviews FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.purchases
            WHERE buyer_id = auth.uid() AND prompt_id = reviews.prompt_id
        )
    );

CREATE POLICY "Users can update their own reviews"
    ON public.reviews FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
    ON public.reviews FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- PAYOUTS TABLE
-- Stores creator payout requests and history
-- ============================================
CREATE TABLE IF NOT EXISTS public.payouts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    stripe_transfer_id TEXT,
    stripe_payout_id TEXT,
    payout_method TEXT DEFAULT 'stripe' CHECK (payout_method IN ('stripe', 'paypal', 'bank_transfer')),
    notes TEXT,
    processed_at TIMESTAMPTZ,
    processed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Payouts policies
CREATE POLICY "Users can view their own payouts"
    ON public.payouts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can request payouts"
    ON public.payouts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all payouts"
    ON public.payouts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "Admins can update payouts"
    ON public.payouts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- ============================================
-- NEWSLETTER_SUBSCRIBERS TABLE
-- Stores newsletter subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    source TEXT DEFAULT 'landing_page',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Newsletter policies - anyone can subscribe, only admins can view all
CREATE POLICY "Anyone can subscribe to newsletter"
    ON public.newsletter_subscribers FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY "Admins can view all subscribers"
    ON public.newsletter_subscribers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "Admins can manage subscribers"
    ON public.newsletter_subscribers FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- ============================================
-- CREATOR_EARNINGS TABLE
-- Tracks accumulated creator earnings
-- ============================================
CREATE TABLE IF NOT EXISTS public.creator_earnings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    total_earnings DECIMAL(10, 2) DEFAULT 0,
    pending_payout DECIMAL(10, 2) DEFAULT 0,
    total_paid_out DECIMAL(10, 2) DEFAULT 0,
    last_sale_at TIMESTAMPTZ,
    stripe_connect_id TEXT,
    stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
    payout_threshold DECIMAL(10, 2) DEFAULT 50.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;

-- Creator earnings policies
CREATE POLICY "Users can view their own earnings"
    ON public.creator_earnings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own earnings settings"
    ON public.creator_earnings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all earnings"
    ON public.creator_earnings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- ============================================
-- SETTINGS TABLE
-- Stores system-wide settings (owner credentials, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Settings policies - Only admins/owners can view/modify
CREATE POLICY "Admins can view settings"
    ON public.settings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "Admins can manage settings"
    ON public.settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- SECURITY NOTE: Owner credentials should be set via SQL after initial setup:
-- INSERT INTO public.settings (key, value, description) VALUES 
--   ('owner_email', 'your-owner-email@example.com', 'Owner account email'),
--   ('owner_password', 'your-secure-password', 'Owner account password')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================
-- Note: Run this after creating a test user through the UI

-- To set a user as owner, run:
-- UPDATE public.profiles SET role = 'owner' WHERE email = 'your-email@example.com';
