export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      user_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          subscription_id: string | null;
          plan_id: string | null;
          plan_type: string | null;
          token_balance: number;
          tokens_used: number;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          next_reset_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription_id?: string | null;
          plan_id?: string | null;
          plan_type?: string | null;
          token_balance: number;
          tokens_used?: number;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          next_reset_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subscription_id?: string | null;
          plan_id?: string | null;
          plan_type?: string | null;
          token_balance?: number;
          tokens_used?: number;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          next_reset_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      token_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          transaction_type: string;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          transaction_type: string;
          description: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          transaction_type?: string;
          description?: string;
          created_at?: string;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
