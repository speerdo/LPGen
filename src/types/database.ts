export interface Project {
  id: string;
  user_id: string;
  name: string;
  status: 'draft' | 'final';
  website_url: string | null;
  created_at: string;
  updated_at: string;
  settings: ProjectSettings;
  html_content?: string;
  thumbnail_url: string | null;
}

export interface Version {
  id: string;
  project_id: string;
  version_number: number;
  html_content: string | null;
  css_content: string | null;
  marketing_content: string | null;
  prompt_instructions: string | null;
  created_at: string;
  created_by: string;
  is_current: boolean;
  settings?: WebsiteStyle;
}

export interface Asset {
  id: string;
  project_id: string;
  version_id: string | null;
  type: 'image' | 'font' | 'logo' | 'screenshot';
  url: string;
  local_path: string | null;
  created_at: string;
}

export interface ProjectSettings {
  use_lorem_ipsum?: boolean;
  extracted_styles?: WebsiteStyle;
  deployment?: {
    platform: 'webflow' | 'custom';
    settings: Record<string, unknown>;
  };
}

export interface WebsiteStyle {
  colors?: string[];
  fonts?: string[];
  images?: string[];
  logo?: string;
  screenshot?: string;
  metaDescription?: string;
  headings?: string[];
  styles?: {
    layout: {
      maxWidth: string;
      containerPadding: string;
      gridGap: string;
    };
    buttonStyles: Array<{
      backgroundColor: string;
      color: string;
      padding: string;
      borderRadius: string;
    }>;
    headerStyles: Array<{
      fontFamily: string;
      fontSize: string;
      fontWeight: string;
      color: string;
    }>;
    gradients: string[];
    shadows: string[];
  };
  dominantColor?: string;
  primaryFont?: string;
}

export type UserSubscription = {
  id: string;
  user_id: string;
  plan_type: 'free' | 'premium' | 'enterprise';
  token_balance: number;
  tokens_used: number;
  next_reset_date: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  created_at: string;
  updated_at: string;
};
