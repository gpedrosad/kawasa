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
      contacts: {
        Row: {
          id: string;
          phone_number: string;
          wa_id: string | null;
          profile_name: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          phone_number: string;
          wa_id?: string | null;
          profile_name?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          phone_number?: string;
          wa_id?: string | null;
          profile_name?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          contact_id: string;
          phone_number_id: string | null;
          status: string;
          stage: string;
          last_message_at: string | null;
          last_inbound_at: string | null;
          last_outbound_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          contact_id: string;
          phone_number_id?: string | null;
          status?: string;
          stage?: string;
          last_message_at?: string | null;
          last_inbound_at?: string | null;
          last_outbound_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          phone_number_id?: string | null;
          status?: string;
          stage?: string;
          last_message_at?: string | null;
          last_inbound_at?: string | null;
          last_outbound_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          provider_message_id: string;
          conversation_id: string;
          contact_id: string | null;
          direction: "inbound" | "outbound";
          type: string;
          status: string;
          text: string | null;
          media: Json | null;
          context_message_id: string | null;
          occurred_at: string | null;
          raw: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_message_id: string;
          conversation_id: string;
          contact_id?: string | null;
          direction: "inbound" | "outbound";
          type?: string;
          status?: string;
          text?: string | null;
          media?: Json | null;
          context_message_id?: string | null;
          occurred_at?: string | null;
          raw?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_message_id?: string;
          conversation_id?: string;
          contact_id?: string | null;
          direction?: "inbound" | "outbound";
          type?: string;
          status?: string;
          text?: string | null;
          media?: Json | null;
          context_message_id?: string | null;
          occurred_at?: string | null;
          raw?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      ad_touches: {
        Row: {
          id: string;
          contact_id: string | null;
          conversation_id: string | null;
          message_id: string | null;
          source: string;
          channel: string;
          ctwa_clid: string | null;
          source_id: string | null;
          source_type: string | null;
          source_url: string | null;
          headline: string | null;
          body: string | null;
          media_type: string | null;
          campaign_id: string | null;
          adset_id: string | null;
          ad_id: string | null;
          utm: Json;
          raw: Json | null;
          touched_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id?: string | null;
          conversation_id?: string | null;
          message_id?: string | null;
          source?: string;
          channel?: string;
          ctwa_clid?: string | null;
          source_id?: string | null;
          source_type?: string | null;
          source_url?: string | null;
          headline?: string | null;
          body?: string | null;
          media_type?: string | null;
          campaign_id?: string | null;
          adset_id?: string | null;
          ad_id?: string | null;
          utm?: Json;
          raw?: Json | null;
          touched_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string | null;
          conversation_id?: string | null;
          message_id?: string | null;
          source?: string;
          channel?: string;
          ctwa_clid?: string | null;
          source_id?: string | null;
          source_type?: string | null;
          source_url?: string | null;
          headline?: string | null;
          body?: string | null;
          media_type?: string | null;
          campaign_id?: string | null;
          adset_id?: string | null;
          ad_id?: string | null;
          utm?: Json;
          raw?: Json | null;
          touched_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      conversions: {
        Row: {
          id: string;
          contact_id: string | null;
          conversation_id: string | null;
          ad_touch_id: string | null;
          event_name: string;
          event_id: string;
          event_time: string;
          value: number | null;
          currency: string;
          action_source: string;
          status: string;
          custom_data: Json;
          user_data: Json;
          meta_response: Json | null;
          error_message: string | null;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id?: string | null;
          conversation_id?: string | null;
          ad_touch_id?: string | null;
          event_name: string;
          event_id: string;
          event_time?: string;
          value?: number | null;
          currency?: string;
          action_source?: string;
          status?: string;
          custom_data?: Json;
          user_data?: Json;
          meta_response?: Json | null;
          error_message?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string | null;
          conversation_id?: string | null;
          ad_touch_id?: string | null;
          event_name?: string;
          event_id?: string;
          event_time?: string;
          value?: number | null;
          currency?: string;
          action_source?: string;
          status?: string;
          custom_data?: Json;
          user_data?: Json;
          meta_response?: Json | null;
          error_message?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type ConversationRow =
  Database["public"]["Tables"]["conversations"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
