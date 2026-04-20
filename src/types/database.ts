/** DB 스키마와 동기화. Supabase 연결 후 `npm run gen:types`로 덮어쓸 타입을 생성할 수 있음. */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      buyer_accounts: {
        Row: {
          id: string;
          label: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          label: string;
          user_id: string;
        };
        Update: {
          id?: string;
          label?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          product_name: string;
          is_processed: boolean;
          purchase_date: string;
          deposit_date: string | null;
          purchase_price_krw: number;
          deposit_amount_krw: number | null;
          profit_krw: number | null;
          is_item_delivered: boolean;
          deposit_memo: string | null;
          notes: string | null;
          product_url: string | null;
          scheduled_purchase_at: string | null;
          order_number: string | null;
          screenshot_storage_path: string | null;
          order_status: string | null;
          title: string | null;
          platform_id: string | null;
          payment_method_id: string | null;
          buyer_account_id: string | null;
          purchase_info_template_id: string | null;
          review_photo_count: number | null;
          review_char_count: number | null;
          ai_review: string | null;
          ai_review_user_prompt: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          product_name: string;
          is_processed?: boolean;
          purchase_date: string;
          deposit_date?: string | null;
          purchase_price_krw: number;
          deposit_amount_krw?: number | null;
          profit_krw?: number | null;
          is_item_delivered?: boolean;
          deposit_memo?: string | null;
          notes?: string | null;
          product_url?: string | null;
          scheduled_purchase_at?: string | null;
          order_number?: string | null;
          screenshot_storage_path?: string | null;
          order_status?: string | null;
          title?: string | null;
          platform_id?: string | null;
          payment_method_id?: string | null;
          buyer_account_id?: string | null;
          purchase_info_template_id?: string | null;
          review_photo_count?: number | null;
          review_char_count?: number | null;
          ai_review?: string | null;
          ai_review_user_prompt?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_name?: string;
          is_processed?: boolean;
          purchase_date?: string;
          deposit_date?: string | null;
          purchase_price_krw?: number;
          deposit_amount_krw?: number | null;
          profit_krw?: number | null;
          is_item_delivered?: boolean;
          deposit_memo?: string | null;
          notes?: string | null;
          product_url?: string | null;
          scheduled_purchase_at?: string | null;
          order_number?: string | null;
          screenshot_storage_path?: string | null;
          order_status?: string | null;
          title?: string | null;
          platform_id?: string | null;
          payment_method_id?: string | null;
          buyer_account_id?: string | null;
          purchase_info_template_id?: string | null;
          review_photo_count?: number | null;
          review_char_count?: number | null;
          ai_review?: string | null;
          ai_review_user_prompt?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_buyer_account_id_fkey";
            columns: ["buyer_account_id"];
            isOneToOne: false;
            referencedRelation: "buyer_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_purchase_info_template_id_fkey";
            columns: ["purchase_info_template_id"];
            isOneToOne: false;
            referencedRelation: "purchase_info_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_payment_method_id_fkey";
            columns: ["payment_method_id"];
            isOneToOne: false;
            referencedRelation: "payment_methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_platform_id_fkey";
            columns: ["platform_id"];
            isOneToOne: false;
            referencedRelation: "platforms";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_methods: {
        Row: {
          id: string;
          is_active: boolean;
          name: string;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          is_active?: boolean;
          name: string;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          is_active?: boolean;
          name?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      platforms: {
        Row: {
          id: string;
          is_active: boolean;
          name: string;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          is_active?: boolean;
          name: string;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          is_active?: boolean;
          name?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      purchase_info_templates: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          buyer_name: string | null;
          recipient_name: string | null;
          login_id: string | null;
          phone: string | null;
          address: string | null;
          bank_account_number: string | null;
          account_holder: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          buyer_name?: string | null;
          recipient_name?: string | null;
          login_id?: string | null;
          phone?: string | null;
          address?: string | null;
          bank_account_number?: string | null;
          account_holder?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          buyer_name?: string | null;
          recipient_name?: string | null;
          login_id?: string | null;
          phone?: string | null;
          address?: string | null;
          bank_account_number?: string | null;
          account_holder?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_ai_review_profiles: {
        Row: {
          user_id: string;
          gender: string | null;
          age_range: string | null;
          region: string | null;
          occupation: string | null;
          extra_context: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          gender?: string | null;
          age_range?: string | null;
          region?: string | null;
          occupation?: string | null;
          extra_context?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          gender?: string | null;
          age_range?: string | null;
          region?: string | null;
          occupation?: string | null;
          extra_context?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_item_settings: {
        Row: {
          is_hidden: boolean | null;
          item_type: string;
          target_id: string;
          user_id: string;
        };
        Insert: {
          is_hidden?: boolean | null;
          item_type: string;
          target_id: string;
          user_id: string;
        };
        Update: {
          is_hidden?: boolean | null;
          item_type?: string;
          target_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          email: string | null;
          name: string;
          user_id: string;
        };
        Insert: {
          email?: string | null;
          name?: string;
          user_id: string;
        };
        Update: {
          email?: string | null;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
