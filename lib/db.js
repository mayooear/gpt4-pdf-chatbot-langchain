import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be defined in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/*
SQL for creating the 'users' table in Supabase:

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  name text NULL,
  image text NULL,
  role text NOT NULL DEFAULT 'User'::text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email)
);

-- Optional: Enable Row Level Security (RLS) on the table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Optional: Create policies for RLS (examples below, adjust as needed)

-- Allow users to read their own data
CREATE POLICY "Allow individual user read access"
ON public.users
FOR SELECT
USING (auth.uid() = id); -- Assumes 'id' in your users table matches Supabase auth.uid()
                         -- If using NextAuth's user.id (which is token.sub from provider),
                         -- you might need a different way to link them or a different policy.
                         -- For NextAuth, you might manage access more at the application layer
                         -- or ensure the 'id' field is populated with auth.uid() if using Supabase Auth alongside NextAuth.

-- Allow users to update their own data
CREATE POLICY "Allow individual user update access"
ON public.users
FOR UPDATE
USING (auth.uid() = id);

-- For NextAuth-centric approach where Supabase is just a DB:
-- You might have simpler policies or manage access primarily through your API logic
-- if Supabase Auth isn't the primary driver for user identification in policies.

-- A common policy for users table when using NextAuth and Supabase as just a DB:
-- Allow authenticated users to read all users (or specific fields)
-- CREATE POLICY "Allow authenticated read access"
-- ON public.users FOR SELECT USING (auth.role() = 'authenticated');

-- It's crucial to align your RLS policies with how you identify and authenticate users
-- (Supabase Auth vs. NextAuth sessions).
-- If NextAuth is the sole auth system, your backend functions (using service_role key or specific user queries)
-- will interact with Supabase, and RLS might be simpler or focused on service-level access.

-- Don't forget to create a "createdAt" function if it doesn't exist or set default via now()
-- And an "updatedAt" trigger function:
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_updated_at();

*/

/**
 * Fetches a user by their email.
 * @param {string} email The user's email.
 * @returns {Promise<{data: object | null, error: object | null}>}
 */
export const getUserByEmail = async (email) => {
  if (!email) return { data: null, error: { message: 'Email is required.' } };
  return supabase.from('users').select('*').eq('email', email).single();
};

/**
 * Creates a new user.
 * @param {object} userData The user data (e.g., email, name, image, role).
 * @returns {Promise<{data: object | null, error: object | null}>}
 */
export const createUser = async (userData) => {
  if (!userData || !userData.email) {
    return { data: null, error: { message: 'User data with email is required.' } };
  }
  const defaultData = {
    role: 'User', // Default role
    ...userData,
  };
  return supabase.from('users').insert(defaultData).select().single();
};

/**
 * Updates a user's role.
 * @param {string} userId The ID of the user to update.
 * @param {string} role The new role.
 * @returns {Promise<{data: object | null, error: object | null}>}
 */
export const updateUserRole = async (userId, role) => {
  if (!userId || !role) {
    return { data: null, error: { message: 'User ID and role are required.' } };
  }
  return supabase.from('users').update({ role }).eq('id', userId).select().single();
};

/**
 * Upserts a user based on their email.
 * Creates them if they don't exist, or updates their name/image if they do.
 * This is useful in the NextAuth signIn callback.
 * @param {object} userProfile From NextAuth (user.email, user.name, user.image)
 * @returns {Promise<{data: object | null, error: object | null}>}
 */
export const upsertUser = async (userProfile) => {
  if (!userProfile || !userProfile.email) {
    return { data: null, error: { message: 'User profile with email is required.' } };
  }

  const { data: existingUser, error: fetchError } = await getUserByEmail(userProfile.email);

  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: row not found
    console.error('Error fetching user for upsert:', fetchError);
    return { data: null, error: fetchError };
  }

  if (existingUser) {
    // User exists, update name and image if they changed
    if (existingUser.name !== userProfile.name || existingUser.image !== userProfile.image) {
      const { data, error } = await supabase
        .from('users')
        .update({ name: userProfile.name, image: userProfile.image })
        .eq('email', userProfile.email)
        .select()
        .single();
      if (error) console.error('Error updating user:', error);
      return { data: data || existingUser, error }; // return updated or existing on error
    }
    return { data: existingUser, error: null }; // No changes needed
  } else {
    // User doesn't exist, create them
    const { data, error } = await createUser({
      email: userProfile.email,
      name: userProfile.name,
      image: userProfile.image,
      // role: 'User' // createUser will set default role
    });
    if (error) console.error('Error creating user:', error);
    return { data, error };
  }
};

/*
SQL for creating the 'products' table:

CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text NULL,
  weight text NULL, -- Or numeric if standard unit
  claims jsonb NULL, -- Store as an array of strings or objects
  nutrition_info jsonb NULL, -- Store as a structured object
  image_url text NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_name_key UNIQUE (name) -- Assuming product names should be unique
);

-- Apply the updatedAt trigger
CREATE TRIGGER on_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE PROCEDURE public.handle_updated_at();

-- Optional: Enable Row Level Security (RLS) if needed, and define policies.
-- ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read access to products" ON public.products FOR SELECT USING (true);
-- CREATE POLICY "Allow admin write access to products" ON public.products FOR ALL USING (auth.role() = 'authenticated' AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'Admin'); -- Example if using Supabase Auth roles

SQL for creating the 'meta_ads' table:

CREATE TABLE public.meta_ads (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  campaign_name text NULL,
  ad_set_name text NULL, -- Added field
  ad_name text NULL, -- Added field
  date date NOT NULL,
  impressions integer NULL,
  clicks integer NULL,
  leads integer NULL, -- Or numeric if fractional leads are possible
  spend numeric NULL,
  -- It's good practice to have a unique constraint for the combination of fields
  -- that define a unique ad performance record for a given day.
  -- For example, if campaign_name, ad_set_name, ad_name, and date make a record unique:
  CONSTRAINT meta_ads_unique_performance_record UNIQUE (campaign_name, ad_set_name, ad_name, date),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_ads_pkey PRIMARY KEY (id)
);

-- Apply the updatedAt trigger
CREATE TRIGGER on_meta_ads_updated_at
BEFORE UPDATE ON public.meta_ads
FOR EACH ROW
EXECUTE PROCEDURE public.handle_updated_at();

-- Optional: Enable Row Level Security (RLS) if needed, and define policies.
-- ALTER TABLE public.meta_ads ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow admin read access to meta_ads" ON public.meta_ads FOR SELECT USING (auth.role() = 'authenticated' AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'Admin');
-- CREATE POLICY "Allow admin write access to meta_ads" ON public.meta_ads FOR ALL USING (auth.role() = 'authenticated' AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'Admin');

*/

/**
 * Batch upserts product data.
 * Uses 'name' as the conflict resolution column.
 * @param {Array<object>} productsData Array of product objects.
 * @returns {Promise<{data: Array<object> | null, error: object | null}>}
 */
export const upsertProducts = async (productsData) => {
  if (!productsData || productsData.length === 0) {
    return { data: [], error: null }; // Or an error if productsData is required to be non-empty
  }
  // Ensure all products have a 'name' for conflict resolution
  for (const product of productsData) {
    if (!product.name) {
      return { data: null, error: { message: 'All products must have a name for upsert.' } };
    }
  }
  return supabase.from('products').upsert(productsData, { onConflict: 'name' }).select();
};

/**
 * Batch upserts Meta Ads data.
 * Uses a composite unique constraint for conflict resolution.
 * The constraint 'meta_ads_unique_performance_record' should be defined on (campaign_name, ad_set_name, ad_name, date).
 * @param {Array<object>} adsData Array of ad data objects.
 * @returns {Promise<{data: Array<object> | null, error: object | null}>}
 */
export const upsertMetaAds = async (adsData) => {
  if (!adsData || adsData.length === 0) {
    return { data: [], error: null };
  }
  // Ensure required fields for the unique constraint are present
  for (const ad of adsData) {
    if (!ad.campaign_name || !ad.ad_set_name || !ad.ad_name || !ad.date) {
      return { data: null, error: { message: 'All ads must have campaign_name, ad_set_name, ad_name, and date for upsert.' } };
    }
  }
  // The onConflict option should match the name of your unique constraint.
  // If your constraint is named e.g. 'meta_ads_campaign_name_ad_set_name_ad_name_date_key', use that.
  // For this example, I'm using 'meta_ads_unique_performance_record' as defined in the SQL schema comment.
  return supabase.from('meta_ads').upsert(adsData, { onConflict: 'campaign_name,ad_set_name,ad_name,date', ignoreDuplicates: false }).select();
};

/*
SQL for creating the 'app_settings' table:

CREATE TABLE public.app_settings (
  key text NOT NULL,
  value jsonb NULL, -- Using jsonb to allow for various data types
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_pkey PRIMARY KEY (key)
);

-- Apply the updatedAt trigger (assuming handle_updated_at function is already created from users table setup)
CREATE TRIGGER on_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE PROCEDURE public.handle_updated_at();

-- Optional: RLS (Admins can manage settings, authenticated users might read some)
-- ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow admin access to app_settings" ON public.app_settings FOR ALL USING (auth.role() = 'authenticated' AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'Admin');
-- CREATE POLICY "Allow authenticated users to read app_settings" ON public.app_settings FOR SELECT USING (auth.role() = 'authenticated');

*/

/**
 * Fetches all application settings.
 * @returns {Promise<{data: Record<string, any> | null, error: object | null}>} Object where keys are setting keys and values are setting values.
 */
export const getAllAppSettings = async () => {
  const { data, error } = await supabase.from('app_settings').select('key, value');
  if (error) return { data: null, error };
  if (!data) return { data: {}, error: null };

  // Transform the array of {key, value} objects into a single object
  const settings = data.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});
  return { data: settings, error: null };
};

/**
 * Updates multiple application settings.
 * @param {Record<string, any>} settingsToUpdate Object containing key-value pairs of settings.
 * @returns {Promise<{data: Array<object> | null, error: object | null}>}
 */
export const updateAppSettings = async (settingsToUpdate) => {
  if (typeof settingsToUpdate !== 'object' || settingsToUpdate === null || Object.keys(settingsToUpdate).length === 0) {
    return { data: null, error: { message: 'Invalid or empty settings object provided.' }};
  }

  const upsertData = Object.entries(settingsToUpdate).map(([key, value]) => ({
    key,
    value,
  }));

  // Upsert based on the 'key' column
  return supabase.from('app_settings').upsert(upsertData, { onConflict: 'key' }).select();
};

/**
 * Fetches all users from the database.
 * @param {object} [options] Options for pagination.
 * @param {number} [options.page=1] The page number to fetch.
 * @param {number} [options.limit=10] The number of items per page.
 * @returns {Promise<{data: Array<object> | null, count: number | null, error: object | null}>}
 */
export const getAllUsers = async ({ page = 1, limit = 10 } = {}) => {
  const offset = (page - 1) * limit;
  return supabase
    .from('users')
    .select('*', { count: 'exact' }) // Request total count
    .order('createdAt', { ascending: false })
    .range(offset, offset + limit - 1);
};

/**
 * Fetches a user by their ID.
 * @param {string} userId The user's ID.
 * @returns {Promise<{data: object | null, error: object | null}>}
 */
export const getUserById = async (userId) => {
  if (!userId) return { data: null, error: { message: 'User ID is required.' } };
  return supabase.from('users').select('*').eq('id', userId).single();
};

/*
SQL for creating the 'leads' table:

CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NULL, -- Nullable for public widget, references public.users(id)
  question text NOT NULL,
  response text NULL, -- The LLM's answer
  source text NULL, -- e.g., 'seller-chat', 'public-widget'
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  -- "updatedAt" timestamptz NOT NULL DEFAULT now(), -- Not typically needed for leads unless they are updated
  CONSTRAINT leads_pkey PRIMARY KEY (id),
  CONSTRAINT leads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL -- Optional: what happens if user is deleted
);

-- Optional: Indexes for querying
CREATE INDEX idx_leads_user_id ON public.leads(user_id);
CREATE INDEX idx_leads_created_at ON public.leads("createdAt");

-- RLS for leads (example: users can see their own leads, admins can see all)
-- ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow users to see their own leads" ON public.leads FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Allow admins to see all leads" ON public.leads FOR SELECT USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'Admin');
-- For inserts, ensure the user_id is set correctly or allow anonymous inserts if user_id is nullable.
-- CREATE POLICY "Allow authenticated users to insert their own leads" ON public.leads FOR INSERT WITH CHECK (auth.uid() = user_id);
-- If allowing public widget inserts where user_id is NULL:
-- CREATE POLICY "Allow public inserts for leads" ON public.leads FOR INSERT WITH CHECK (user_id IS NULL);


*/

/**
 * Logs a lead (question and optionally response) to the database.
 * @param {object} leadData The lead data.
 * @param {string} [leadData.user_id] The ID of the user asking the question (if authenticated).
 * @param {string} leadData.question The question asked by the user.
 * @param {string} [leadData.response] The response provided by the LLM.
 * @param {string} [leadData.source] The source of the lead (e.g., 'seller-chat').
 * @returns {Promise<{data: object | null, error: object | null}>}
 */
export const logLead = async (leadData) => {
  if (!leadData || !leadData.question) {
    return { data: null, error: { message: 'Question is required to log a lead.' } };
  }

  const dataToInsert = {
    user_id: leadData.user_id || null,
    question: leadData.question,
    response: leadData.response || null,
    source: leadData.source || 'unknown',
    // createdAt is handled by defaultValue in DB
  };

  return supabase.from('leads').insert(dataToInsert).select().single();
};

// Reporting specific functions

/**
 * Gets the total count of leads, optionally within a date range.
 * @param {object} [options] Optional parameters.
 * @param {string} [options.startDateISO] ISO string for start date (inclusive).
 * @param {string} [options.endDateISO] ISO string for end date (inclusive).
 * @returns {Promise<{count: number | null, error: object | null}>}
 */
export const getTotalLeadsCount = async (options = {}) => {
  const { startDateISO, endDateISO } = options;
  let query = supabase.from('leads').select('*', { count: 'exact', head: true });

  if (startDateISO && endDateISO) {
    query = query.gte('createdAt', startDateISO).lte('createdAt', endDateISO);
  } else if (startDateISO) {
    query = query.gte('createdAt', startDateISO);
  } else if (endDateISO) {
    query = query.lte('createdAt', endDateISO);
  }

  const { count, error } = await query;
  return { count, error };
};

/**
 * Gets the top N most frequently asked questions from the leads table, optionally within a date range.
 * @param {number} [limit=5] Number of top questions to return.
 * @param {object} [options] Optional parameters.
 * @param {string} [options.startDateISO] ISO string for start date (inclusive).
 * @param {string} [options.endDateISO] ISO string for end date (inclusive).
 * @returns {Promise<{data: Array<{question: string, count: number}> | null, error: object | null}>}
 */
export const getTopQuestions = async (limit = 5, options = {}) => {
  const { startDateISO, endDateISO } = options;
  // RPC function is highly recommended for this. The JS implementation below is inefficient.
  // Example RPC call (if function `get_top_questions_in_range` is created):
  // const { data, error } = await supabase.rpc('get_top_questions_in_range', {
  //   limit_count: limit,
  //   start_date_param: startDateISO,
  //   end_date_param: endDateISO
  // });
  // return {data, error};

  // Fallback JS implementation (inefficient for large datasets)
  let query = supabase.from('leads').select('question');
  if (startDateISO && endDateISO) {
    query = query.gte('createdAt', startDateISO).lte('createdAt', endDateISO);
  } else if (startDateISO) {
    query = query.gte('createdAt', startDateISO);
  } else if (endDateISO) {
    query = query.lte('createdAt', endDateISO);
  }

  const { data, error } = await query;
  // Creating a DB function `get_top_questions(limit_count INT)` would be more robust.
  //
  // CREATE OR REPLACE FUNCTION get_top_questions(limit_count INT)
  // RETURNS TABLE(question_text TEXT, occurrences BIGINT) AS $$
  // BEGIN
  //   RETURN QUERY
  //   SELECT
  //     question,
  //     COUNT(*) AS question_count
  //   FROM
  //     public.leads
  //   GROUP BY
  //     question
  //   ORDER BY
  //     question_count DESC
  //   LIMIT
  //     limit_count;
  // END;
  // $$ LANGUAGE plpgsql;
  //
  // Then call it: const { data, error } = await supabase.rpc('get_top_questions', { limit_count: limit });

  // For now, fetching raw data and processing in JS (less efficient for large datasets):
  // const { data, error } = await supabase.from('leads').select('question'); // This was the redundant line
  if (error) return { data: null, error }; // error is from the query above
  if (!data) return { data: [], error: null }; // data is from the query above

  const questionCounts = data.reduce((acc, lead) => {
    const question = lead.question.trim().toLowerCase(); // Normalize
    acc[question] = (acc[question] || 0) + 1;
    return acc;
  }, {});

  const sortedQuestions = Object.entries(questionCounts)
    .map(([question, count]) => ({ question, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return { data: sortedQuestions, error: null };
};


/**
 * Gets the number of leads per week for the last N weeks.
 * @param {number} [weeks=12] Number of weeks to fetch data for.
 * @returns {Promise<{data: Array<{week_start_date: string, count: number}> | null, error: object | null}>}
 */
export const getWeeklyLeadsTrend = async (weeks = 12) => {
  // This also typically requires date truncation and grouping, best done with a DB function or view.
  // Supabase JS client might require RPC for this too.
  //
  // CREATE OR REPLACE FUNCTION get_weekly_leads(num_weeks INT)
  // RETURNS TABLE(week_start TEXT, lead_count BIGINT) AS $$
  // BEGIN
  //   RETURN QUERY
  //   SELECT
  //     to_char(date_trunc('week', "createdAt"), 'YYYY-MM-DD') AS week_start_date,
  //     COUNT(*) AS weekly_leads_count
  //   FROM
  //     public.leads
  //   WHERE
  //     "createdAt" >= date_trunc('week', NOW() - (num_weeks || ' weeks')::interval)
  //   GROUP BY
  //     week_start_date
  //   ORDER BY
  //     week_start_date ASC;
  // END;
  // $$ LANGUAGE plpgsql;
  //
  // Then call: const { data, error } = await supabase.rpc('get_weekly_leads', { num_weeks: weeks });

  // Simpler JS implementation for now (less efficient, fetches more data then processes):
  // Calculate the date N weeks ago
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - weeks * 7);

  const { data, error } = await supabase
    .from('leads')
    .select('createdAt')
    .gte('createdAt', startDate.toISOString());

  if (error) return { data: null, error };
  if (!data) return { data: [], error: null };

  const weeklyData = data.reduce((acc, lead) => {
    const leadDate = new Date(lead.createdAt);
    const dayOfWeek = leadDate.getUTCDay(); // Sunday = 0, Monday = 1, etc.
    // Calculate the start of the week (assuming week starts on Sunday for simplicity here)
    const weekStart = new Date(leadDate);
    weekStart.setUTCDate(leadDate.getUTCDate() - dayOfWeek);
    const weekStartDateString = weekStart.toISOString().split('T')[0];

    acc[weekStartDateString] = (acc[weekStartDateString] || 0) + 1;
    return acc;
  }, {});

  const trendData = Object.entries(weeklyData)
    .map(([week_start_date, count]) => ({ week_start_date, count }))
    .sort((a, b) => new Date(a.week_start_date) - new Date(b.week_start_date));

  return { data: trendData, error: null };
};


/**
 * Fetches a summary of Meta Ads performance, optionally within a date range.
 * @param {object} [options] Optional parameters.
 * @param {string} [options.startDateISO] ISO string for start date (inclusive, applies to ad 'date' field).
 * @param {string} [options.endDateISO] ISO string for end date (inclusive, applies to ad 'date' field).
 * @returns {Promise<{data: object | null, error: object | null}>}
 */
export const getMetaAdsSummary = async (options = {}) => {
  const { startDateISO, endDateISO } = options;
  let query = supabase.from('meta_ads').select('spend, impressions, clicks, leads');

  if (startDateISO && endDateISO) {
    query = query.gte('date', startDateISO).lte('date', endDateISO);
  } else if (startDateISO) {
    query = query.gte('date', startDateISO);
  } else if (endDateISO) {
    query = query.lte('date', endDateISO);
  }

  const { data, error } = await query;

  if (error) return { data: null, error };
  if (!data || data.length === 0) return { data: { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalLeads: 0, avgCPL: 0, avgCTR: 0 }, error: null };

  const summary = data.reduce((acc, ad) => {
    acc.totalSpend += ad.spend || 0;
    acc.totalImpressions += ad.impressions || 0;
    acc.totalClicks += ad.clicks || 0;
    acc.totalLeads += ad.leads || 0;
    return acc;
  }, { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalLeads: 0 });

  summary.avgCPL = summary.totalLeads > 0 ? summary.totalSpend / summary.totalLeads : 0;
  summary.avgCTR = summary.totalImpressions > 0 ? summary.totalClicks / summary.totalImpressions : 0;

  return { data: summary, error: null };
};


/**
 * Fetches all Meta Ads campaign data, potentially with calculated metrics.
 * @returns {Promise<{data: Array<object> | null, error: object | null}>}
 */
export const getAllMetaAdsCampaignData = async () => {
  const { data, error } = await supabase
    .from('meta_ads')
    .select('*') // Select all fields
    .order('date', { ascending: false }); // Example ordering

  if (error) return { data: null, error };

  // Calculate metrics like CTR, CPL per row if needed, or do it on client-side
  const processedData = data?.map(ad => ({
    ...ad,
    ctr: ad.impressions > 0 ? (ad.clicks / ad.impressions) : 0,
    cpl: ad.leads > 0 ? (ad.spend / ad.leads) : 0,
  })) || [];

  return { data: processedData, error: null };
};
