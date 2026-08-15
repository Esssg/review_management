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
      bank_account: {
        Row: {
          bank: string;
          bank_account_name: string;
          bank_account_number: string;
          bank_code: string;
          bank_password: string;
          id: number;
          resident_number: string;
          user_id: string;
        };
        Insert: {
          bank: string;
          bank_account_name: string;
          bank_account_number: string;
          bank_code: string;
          bank_password: string;
          id?: number;
          resident_number: string;
          user_id?: string;
        };
        Update: {
          bank?: string;
          bank_account_name?: string;
          bank_account_number?: string;
          bank_code?: string;
          bank_password?: string;
          id?: number;
          resident_number?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      bank_account_deposit: {
        Row: {
          amount: number;
          bank_account_id: number;
          bank_account_deposit_status: number;
          counterparty: string;
          date: string;
          time: string | null;
          id: number;
        };
        Insert: {
          amount: number;
          bank_account_id: number;
          bank_account_deposit_status?: number;
          counterparty: string;
          date: string;
          time?: string | null;
          id?: number;
        };
        Update: {
          amount?: number;
          bank_account_id?: number;
          bank_account_deposit_status?: number;
          counterparty?: string;
          date?: string;
          time?: string | null;
          id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "bank_account_deposit_bank_account_id_fkey";
            columns: ["bank_account_id"];
            isOneToOne: false;
            referencedRelation: "bank_account";
            referencedColumns: ["id"];
          },
        ];
      };
      buyer_accounts: {
        Row: {
          color: string;
          id: string;
          label: string;
          user_id: string;
        };
        Insert: {
          color?: string;
          id?: string;
          label: string;
          user_id: string;
        };
        Update: {
          color?: string;
          id?: string;
          label?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      crawl_orders: {
        Row: {
          id: string;
          user_id: string;
          crawl_order_status: number | null;
          created_at?: string | null;
          updated_at?: string | null;
          [key: string]: Json | undefined;
        };
        Insert: {
          id?: string;
          user_id?: string;
          crawl_order_status?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
          [key: string]: Json | undefined;
        };
        Update: {
          id?: string;
          user_id?: string;
          crawl_order_status?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
          [key: string]: Json | undefined;
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
          deleted_at: string | null;
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
          deleted_at?: string | null;
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
          deleted_at?: string | null;
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
      app_notifications: {
        Row: {
          id: string;
          user_id: string;
          order_id: string;
          group_id: string;
          notification_type: "purchase_10m" | "purchase_due";
          title: string;
          body: string;
          target_href: string;
          scheduled_for: string;
          sent_at: string | null;
          read_at: string | null;
          cancelled_at: string | null;
          delivery_attempts: number;
          last_attempt_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_id: string;
          group_id: string;
          notification_type: "purchase_10m" | "purchase_due";
          title: string;
          body: string;
          target_href: string;
          scheduled_for: string;
          sent_at?: string | null;
          read_at?: string | null;
          cancelled_at?: string | null;
          delivery_attempts?: number;
          last_attempt_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          order_id?: string;
          group_id?: string;
          notification_type?: "purchase_10m" | "purchase_due";
          title?: string;
          body?: string;
          target_href?: string;
          scheduled_for?: string;
          sent_at?: string | null;
          read_at?: string | null;
          cancelled_at?: string | null;
          delivery_attempts?: number;
          last_attempt_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "app_notifications_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_methods: {
        Row: {
          color: string;
          id: string;
          is_active: boolean;
          name: string;
          user_id: string | null;
        };
        Insert: {
          color?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          user_id?: string | null;
        };
        Update: {
          color?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          device_label: string | null;
          user_agent: string | null;
          enabled: boolean;
          created_at: string;
          updated_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          device_label?: string | null;
          user_agent?: string | null;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          device_label?: string | null;
          user_agent?: string | null;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
        };
        Relationships: [];
      };
      platform_accounts: {
        Row: {
          id: string;
          name: string;
          user_id: string;
          status: boolean;
          created_at?: string | null;
          updated_at?: string | null;
          [key: string]: Json | undefined;
        };
        Insert: {
          id?: string;
          name: string;
          user_id?: string;
          status?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
          [key: string]: Json | undefined;
        };
        Update: {
          id?: string;
          name?: string;
          user_id?: string;
          status?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
          [key: string]: Json | undefined;
        };
        Relationships: [];
      };
      platforms: {
        Row: {
          color: string;
          id: string;
          is_active: boolean;
          name: string;
          user_id: string | null;
        };
        Insert: {
          color?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          user_id?: string | null;
        };
        Update: {
          color?: string;
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
      saved_order_views: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          filters: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          filters?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          filters?: Json;
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
      user_order_drafts: {
        Row: {
          user_id: string;
          draft_data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          draft_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          draft_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          default_platform_id: string | null;
          default_payment_method_id: string | null;
          default_buyer_account_id: string | null;
          default_purchase_info_template_id: string | null;
          recent_platform_id: string | null;
          recent_payment_method_id: string | null;
          recent_buyer_account_id: string | null;
          recent_purchase_info_template_id: string | null;
          order_save_action: string;
          auto_advance_recommendations: boolean;
          ledger_density: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          default_platform_id?: string | null;
          default_payment_method_id?: string | null;
          default_buyer_account_id?: string | null;
          default_purchase_info_template_id?: string | null;
          recent_platform_id?: string | null;
          recent_payment_method_id?: string | null;
          recent_buyer_account_id?: string | null;
          recent_purchase_info_template_id?: string | null;
          order_save_action?: string;
          auto_advance_recommendations?: boolean;
          ledger_density?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          default_platform_id?: string | null;
          default_payment_method_id?: string | null;
          default_buyer_account_id?: string | null;
          default_purchase_info_template_id?: string | null;
          recent_platform_id?: string | null;
          recent_payment_method_id?: string | null;
          recent_buyer_account_id?: string | null;
          recent_purchase_info_template_id?: string | null;
          order_save_action?: string;
          auto_advance_recommendations?: boolean;
          ledger_density?: string;
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
          onboarding_completed_at: string | null;
          user_id: string;
        };
        Insert: {
          email?: string | null;
          name?: string;
          onboarding_completed_at?: string | null;
          user_id: string;
        };
        Update: {
          email?: string | null;
          name?: string;
          onboarding_completed_at?: string | null;
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
